import "server-only";
import {
  computeDaySummary,
  computeFieldSession,
  summarizePeriod,
  type FieldSessionSummary,
  type PeriodTotals,
} from "./attendance";
import { dateRange, monthBounds } from "./datetime";
import {
  getDayRows,
  getEmployeeById,
  getHolidaySet,
  getSettingsResolver,
  listEmployees,
  getErrandSummaryMap,
  listFieldTasks,
} from "./db";
import type { AttendanceDayRow, DaySummary, Employee, FieldTask, WorkSettings } from "./types";

export type ReportRow = {
  employeeId: string;
  empCode: string;
  fullName: string;
  department: string | null;
  branchName: string | null;
  /** ชื่อกะที่ใช้คำนวณวันนั้น (จากตารางเวร หรือกะสาขา) */
  scheduleName: string;
  /** สถานที่นอกสาขาที่ไปประจำวันนั้น (ตามตารางเวร) */
  siteName: string | null;
  summary: DaySummary;
  photos: {
    check_in: string | null;
    break_out: string | null;
    break_in: string | null;
    check_out: string | null;
  };
  hasManual: boolean;
};

function emptyDayRow(emp: Employee, workDate: string, branchName: string | null): AttendanceDayRow {
  return {
    employee_id: emp.id,
    emp_code: emp.emp_code,
    full_name: emp.full_name,
    department: emp.department_name ?? null,
    work_date: workDate,
    check_in_at: null,
    break_out_at: null,
    break_in_at: null,
    check_out_at: null,
    check_in_photo: null,
    break_out_photo: null,
    break_in_photo: null,
    check_out_photo: null,
    punch_count: 0,
    has_manual: false,
    branch_id: emp.branch_id,
    branch_code: null,
    branch_name: branchName,
  };
}

function toReportRow(
  row: AttendanceDayRow,
  settings: WorkSettings,
  holidays: Set<string>,
  isDayOff: boolean,
  siteName: string | null = null,
  errand: { minutes: number; rounds: number } = { minutes: 0, rounds: 0 },
): ReportRow {
  return {
    employeeId: row.employee_id,
    empCode: row.emp_code,
    fullName: row.full_name,
    department: row.department,
    branchName: row.branch_name,
    scheduleName: isDayOff ? "หยุดเวร" : settings.schedule_name,
    siteName,
    summary: computeDaySummary(
      { ...row, errand_minutes: errand.minutes, errand_rounds: errand.rounds },
      settings,
      holidays.has(row.work_date),
      isDayOff,
    ),
    photos: {
      check_in: row.check_in_photo,
      break_out: row.break_out_photo,
      break_in: row.break_in_photo,
      check_out: row.check_out_photo,
    },
    hasManual: row.has_manual,
  };
}

/** รายงานรายบุคคล: ทุกวันในช่วงที่เลือก (เติมวันที่ไม่มีการลงเวลาให้ครบ) */
export async function buildEmployeeReport(params: {
  employeeId: string;
  from: string;
  to: string;
  /** ใช้เลือกวันหยุด/ค่าตั้งต้นของบริษัทให้ถูกชุด */
  companyId?: string | null;
}): Promise<{
  employee: Employee | null;
  settings: WorkSettings;
  rows: ReportRow[];
  totals: PeriodTotals;
  /** งานนอกสถานที่ของคนนี้ในช่วงเดียวกัน */
  fieldRows: FieldReportRow[];
}> {
  const [employee, holidays, dayRows, resolver] = await Promise.all([
    getEmployeeById(params.employeeId),
    getHolidaySet(params.from, params.to, params.companyId),
    getDayRows({ from: params.from, to: params.to, employeeId: params.employeeId }),
    getSettingsResolver(params.companyId, { from: params.from, to: params.to }),
  ]);
  const errands = await getErrandSummaryMap({ from: params.from, to: params.to, employeeIds: [params.employeeId] });

  const byDate = new Map(dayRows.map((r) => [r.work_date, r]));
  const rows: ReportRow[] = [];
  const settings = resolver.resolve(employee?.branch_id);

  if (employee) {
    const branchName = employee.branch_id
      ? (resolver.branches.get(employee.branch_id)?.name ?? null)
      : null;
    for (const date of dateRange(params.from, params.to)) {
      const row = byDate.get(date) ?? emptyDayRow(employee, date, branchName);
      rows.push(
        toReportRow(
          row,
          resolver.resolve(row.branch_id, employee.id, date),
          holidays,
          resolver.isDayOff(employee.id, date),
          resolver.siteNameOf(employee.id, date),
          errands.get(`${employee.id}|${date}`),
        ),
      );
    }
  }

  const totals = summarizePeriod(rows.map((r) => r.summary));
  const fieldRows = await buildFieldRows({ from: params.from, to: params.to, employeeId: params.employeeId });
  totals.fieldMinutes = sumCountedMinutes(fieldRows);

  return { employee, settings, rows, totals, fieldRows };
}

/** รายงานรายวัน: พนักงานที่ยังทำงานอยู่ทุกคนของวันที่เลือก (กรองตามสาขาได้) */
export async function buildDailyReport(
  date: string,
  branchId?: string,
  companyId?: string | null,
): Promise<{
  settings: WorkSettings;
  rows: ReportRow[];
  totals: PeriodTotals;
}> {
  const [employees, holidays, dayRows, resolver] = await Promise.all([
    listEmployees({ activeOnly: true, branchId, companyId }),
    getHolidaySet(date, date, companyId),
    getDayRows({ from: date, to: date, branchId, companyId }),
    getSettingsResolver(companyId, { from: date, to: date }),
  ]);
  const errands = await getErrandSummaryMap({ from: date, to: date, employeeIds: employees.map((e) => e.id) });

  const byEmployee = new Map(dayRows.map((r) => [r.employee_id, r]));
  const rows = employees.map((emp) => {
    const row =
      byEmployee.get(emp.id) ??
      emptyDayRow(
        emp,
        date,
        emp.branch_id ? (resolver.branches.get(emp.branch_id)?.name ?? null) : null,
      );
    return toReportRow(
      row,
      resolver.resolve(row.branch_id, emp.id, date),
      holidays,
      resolver.isDayOff(emp.id, date),
      resolver.siteNameOf(emp.id, date),
      errands.get(`${emp.id}|${date}`),
    );
  });

  return {
    settings: resolver.resolve(branchId),
    rows,
    totals: summarizePeriod(rows.map((r) => r.summary)),
  };
}

export type MonthlyEmployeeRow = {
  employee: Employee;
  byDate: Map<string, DaySummary>;
  totals: PeriodTotals;
};

/** รายงานรายเดือน: ตาราง พนักงาน × วันที่ (กรองตามสาขาได้) */
export async function buildMonthlyReport(
  year: number,
  month: number,
  branchId?: string,
  companyId?: string | null,
): Promise<{
  settings: WorkSettings;
  dates: string[];
  holidays: Set<string>;
  employees: MonthlyEmployeeRow[];
}> {
  const { from, to } = monthBounds(year, month);
  const [employees, holidays, dayRows, resolver] = await Promise.all([
    listEmployees({ activeOnly: true, branchId, companyId }),
    getHolidaySet(from, to, companyId),
    getDayRows({ from, to, branchId, companyId }),
    getSettingsResolver(companyId, { from, to }),
  ]);

  const dates = dateRange(from, to);
  const rowsByEmp = new Map<string, Map<string, AttendanceDayRow>>();
  for (const r of dayRows) {
    if (!rowsByEmp.has(r.employee_id)) rowsByEmp.set(r.employee_id, new Map());
    rowsByEmp.get(r.employee_id)!.set(r.work_date, r);
  }

  // ชั่วโมงงานพิเศษของทั้งเดือน คำนวณครั้งเดียวจากภารกิจทั้งหมดในช่วง
  const errands = await getErrandSummaryMap({ from, to, employeeIds: employees.map((e) => e.id) });
  const fieldRows = await buildFieldRows({ from, to, companyId, branchId });
  const fieldByEmp = new Map<string, number>();
  for (const r of fieldRows) {
    fieldByEmp.set(r.employeeId, (fieldByEmp.get(r.employeeId) ?? 0) + r.session.countedMinutes);
  }

  const result: MonthlyEmployeeRow[] = employees.map((emp) => {
    const byDate = new Map<string, DaySummary>();
    for (const date of dates) {
      const row = rowsByEmp.get(emp.id)?.get(date) ?? emptyDayRow(emp, date, null);
      // กะอาจต่างกันทุกวันตามตารางเวร จึง resolve ทีละวัน (ข้อมูลถูก preload ไว้แล้ว ไม่ยิงฐานข้อมูลซ้ำ)
      const daySettings = resolver.resolve(row.branch_id ?? emp.branch_id, emp.id, date);
      const errand = errands.get(`${emp.id}|${date}`);
      byDate.set(
        date,
        computeDaySummary(
          { ...row, errand_minutes: errand?.minutes ?? 0, errand_rounds: errand?.rounds ?? 0 },
          daySettings,
          holidays.has(date),
          resolver.isDayOff(emp.id, date),
        ),
      );
    }
    const totals = summarizePeriod([...byDate.values()]);
    totals.fieldMinutes = fieldByEmp.get(emp.id) ?? 0;
    return { employee: emp, byDate, totals };
  });

  return {
    settings: resolver.resolve(branchId),
    dates,
    holidays,
    employees: result,
  };
}

// ---------- งานนอกสถานที่ ----------

/** 1 แถว = สมาชิก 1 คนในภารกิจ 1 งาน */
export type FieldReportRow = {
  task: FieldTask;
  employeeId: string;
  empCode: string;
  fullName: string;
  session: FieldSessionSummary;
  startAt: string | null;
  endAt: string | null;
  startPhoto: string | null;
  endPhoto: string | null;
  hasManual: boolean;
};

function sumCountedMinutes(rows: FieldReportRow[]): number {
  return rows.reduce((sum, r) => sum + r.session.countedMinutes, 0);
}

/** แตกภารกิจเป็นแถวต่อคน พร้อมสรุปเริ่ม/จบ/นาที */
export async function buildFieldRows(params: {
  from: string;
  to: string;
  companyId?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  typeId?: string | null;
}): Promise<FieldReportRow[]> {
  const tasks = await listFieldTasks(params);
  const rows: FieldReportRow[] = [];
  for (const task of tasks) {
    for (const m of task.members) {
      if (params.employeeId && m.employee_id !== params.employeeId) continue;
      if (params.branchId && m.branch_id !== params.branchId) continue;
      rows.push({
        task,
        employeeId: m.employee_id,
        empCode: m.emp_code,
        fullName: m.full_name,
        session: computeFieldSession({
          workDate: task.work_date,
          startAt: m.start?.punched_at,
          endAt: m.end?.punched_at,
          plannedStart: task.planned_start,
          countsHours: task.counts_hours,
        }),
        startAt: m.start?.punched_at ?? null,
        endAt: m.end?.punched_at ?? null,
        startPhoto: m.start?.photo_path ?? null,
        endPhoto: m.end?.photo_path ?? null,
        hasManual: Boolean(m.start?.is_manual || m.end?.is_manual),
      });
    }
  }
  return rows;
}

/** รายงานงานนอกสถานที่ + สรุปชั่วโมงงานพิเศษต่อคน */
export async function buildFieldReport(params: {
  from: string;
  to: string;
  companyId?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  typeId?: string | null;
}): Promise<{
  rows: FieldReportRow[];
  perEmployee: { employeeId: string; empCode: string; fullName: string; tasks: number; minutes: number }[];
  totalMinutes: number;
}> {
  const rows = await buildFieldRows(params);
  const byEmp = new Map<string, { employeeId: string; empCode: string; fullName: string; tasks: number; minutes: number }>();
  for (const r of rows) {
    const cur = byEmp.get(r.employeeId) ?? {
      employeeId: r.employeeId,
      empCode: r.empCode,
      fullName: r.fullName,
      tasks: 0,
      minutes: 0,
    };
    cur.tasks += 1;
    cur.minutes += r.session.countedMinutes;
    byEmp.set(r.employeeId, cur);
  }
  const perEmployee = [...byEmp.values()].sort((a, b) => a.empCode.localeCompare(b.empCode));
  return { rows, perEmployee, totalMinutes: sumCountedMinutes(rows) };
}

import "server-only";
import { computeDaySummary, summarizePeriod, type PeriodTotals } from "./attendance";
import { dateRange, monthBounds } from "./datetime";
import {
  getDayRows,
  getEmployeeById,
  getHolidaySet,
  getSettingsResolver,
  listEmployees,
} from "./db";
import type { AttendanceDayRow, DaySummary, Employee, WorkSettings } from "./types";

export type ReportRow = {
  employeeId: string;
  empCode: string;
  fullName: string;
  department: string | null;
  branchName: string | null;
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
): ReportRow {
  return {
    employeeId: row.employee_id,
    empCode: row.emp_code,
    fullName: row.full_name,
    department: row.department,
    branchName: row.branch_name,
    summary: computeDaySummary(row, settings, holidays.has(row.work_date)),
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
}): Promise<{
  employee: Employee | null;
  settings: WorkSettings;
  rows: ReportRow[];
  totals: PeriodTotals;
}> {
  const [employee, holidays, dayRows, resolver] = await Promise.all([
    getEmployeeById(params.employeeId),
    getHolidaySet(params.from, params.to),
    getDayRows({ from: params.from, to: params.to, employeeId: params.employeeId }),
    getSettingsResolver(),
  ]);

  const byDate = new Map(dayRows.map((r) => [r.work_date, r]));
  const rows: ReportRow[] = [];
  const settings = resolver.resolve(employee?.branch_id);

  if (employee) {
    const branchName = employee.branch_id
      ? (resolver.branches.get(employee.branch_id)?.name ?? null)
      : null;
    for (const date of dateRange(params.from, params.to)) {
      const row = byDate.get(date) ?? emptyDayRow(employee, date, branchName);
      rows.push(toReportRow(row, resolver.resolve(row.branch_id), holidays));
    }
  }

  return { employee, settings, rows, totals: summarizePeriod(rows.map((r) => r.summary)) };
}

/** รายงานรายวัน: พนักงานที่ยังทำงานอยู่ทุกคนของวันที่เลือก (กรองตามสาขาได้) */
export async function buildDailyReport(
  date: string,
  branchId?: string,
): Promise<{
  settings: WorkSettings;
  rows: ReportRow[];
  totals: PeriodTotals;
}> {
  const [employees, holidays, dayRows, resolver] = await Promise.all([
    listEmployees({ activeOnly: true, branchId }),
    getHolidaySet(date, date),
    getDayRows({ from: date, to: date, branchId }),
    getSettingsResolver(),
  ]);

  const byEmployee = new Map(dayRows.map((r) => [r.employee_id, r]));
  const rows = employees.map((emp) => {
    const row =
      byEmployee.get(emp.id) ??
      emptyDayRow(
        emp,
        date,
        emp.branch_id ? (resolver.branches.get(emp.branch_id)?.name ?? null) : null,
      );
    return toReportRow(row, resolver.resolve(row.branch_id), holidays);
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
): Promise<{
  settings: WorkSettings;
  dates: string[];
  holidays: Set<string>;
  employees: MonthlyEmployeeRow[];
}> {
  const { from, to } = monthBounds(year, month);
  const [employees, holidays, dayRows, resolver] = await Promise.all([
    listEmployees({ activeOnly: true, branchId }),
    getHolidaySet(from, to),
    getDayRows({ from, to, branchId }),
    getSettingsResolver(),
  ]);

  const dates = dateRange(from, to);
  const rowsByEmp = new Map<string, Map<string, AttendanceDayRow>>();
  for (const r of dayRows) {
    if (!rowsByEmp.has(r.employee_id)) rowsByEmp.set(r.employee_id, new Map());
    rowsByEmp.get(r.employee_id)!.set(r.work_date, r);
  }

  const result: MonthlyEmployeeRow[] = employees.map((emp) => {
    const empSettings = resolver.resolve(emp.branch_id);
    const byDate = new Map<string, DaySummary>();
    for (const date of dates) {
      const row = rowsByEmp.get(emp.id)?.get(date) ?? emptyDayRow(emp, date, null);
      byDate.set(date, computeDaySummary(row, empSettings, holidays.has(date)));
    }
    return { employee: emp, byDate, totals: summarizePeriod([...byDate.values()]) };
  });

  return {
    settings: resolver.resolve(branchId),
    dates,
    holidays,
    employees: result,
  };
}

import "server-only";
import { computeDaySummary, groupErrandRounds } from "./attendance";
import { listCompanies } from "./core-db";
import { addDays, dateRange, workDateOf } from "./datetime";
import {
  getDayRows,
  getErrandSummaryMap,
  getHolidaySet,
  getLeaveDayMap,
  getSettingsResolver,
  listBranches,
  listEmployees,
  listErrandPunchesOfDate,
  listFieldTasks,
} from "./db";
import { buildDailyReport, buildMonthlyReport } from "./reports";
import type { Employee } from "./types";

/**
 * ข้อมูลสำหรับจอ War Room ของระบบลงเวลา
 * เน้นตอบคำถามที่หัวหน้าต้องรู้ "ตอนนี้": ใครยังไม่มา ใครสาย ใครออกไปข้างนอกอยู่
 * แล้วค่อยเป็นภาพรวมของวันและแนวโน้มย้อนหลัง
 */

export type WallPerson = {
  employeeId: string;
  empCode: string;
  payrollCode: string | null;
  fullName: string;
  branchName: string | null;
  companyName: string | null;
  detail: string;
};

export type WallDimItem = {
  key: string;
  label: string;
  staff: number;
  arrived: number;
  late: number;
  absent: number;
  incomplete: number;
  lateMinutes: number;
  workMinutes: number;
};

export type WallDim = "branch" | "company" | "department" | "position";

/** day = ภาพสดของวันนี้ · month = สะสมทั้งเดือน (นับเป็น คน-วัน) */
export type WallMode = "day" | "month";

export type AttendanceWall = {
  generatedAt: string;
  mode: WallMode;
  date: string;
  isToday: boolean;
  /** ช่วงที่นับจริง — โหมดเดือนตัดที่วันนี้ วันข้างหน้ายังไม่นับ */
  period: { from: string; to: string; label: string };
  scope: { companyName: string | null; branchName: string | null };
  totals: {
    staff: number;
    arrived: number;
    notArrived: number;
    overdue: number;
    late: number;
    lateMinutes: number;
    incomplete: number;
    absent: number;
    off: number;
    holiday: number;
    /** ลาและได้รับอนุมัติแล้ว — ไม่ต้องตามตัว */
    onLeave: number;
    complete: number;
    onErrand: number;
    onField: number;
    overBreakMinutes: number;
    workMinutes: number;
    otMinutes: number;
  };
  dims: Record<WallDim, { title: string; items: WallDimItem[] }>;
  notArrived: WallPerson[];
  late: WallPerson[];
  onLeave: WallPerson[];
  /** อันดับคนที่ต้องดูแลในโหมดเดือน (โหมดวันเป็นลิสต์ว่าง) */
  ranks: {
    late: WallPerson[];
    absent: WallPerson[];
    leave: WallPerson[];
    overBreak: WallPerson[];
  };
  onErrand: WallPerson[];
  onField: WallPerson[];
  trend: { date: string; arrived: number; late: number; absent: number; incomplete: number }[];
  companies: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};

const DIM_TITLE: Record<WallDim, string> = {
  branch: "แยกตามสาขา",
  company: "แยกตามบริษัท",
  department: "แยกตามแผนก",
  position: "แยกตามตำแหน่ง",
};

/** นาทีตั้งแต่เวลา ISO จนถึงตอนนี้ */
function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function buildAttendanceWall(params: {
  mode?: WallMode;
  /** โหมดเดือน: YYYY-MM (ไม่ส่งมา = เดือนของวันที่เลือก) */
  month?: string;
  date?: string;
  companyId?: string | null;
  branchId?: string | null;
  /** ขอบเขตสาขาของผู้ใช้ (null = ทุกสาขา) */
  branchScope?: Set<string> | null;
  now?: Date;
}): Promise<AttendanceWall> {
  const now = params.now ?? new Date();
  const today = workDateOf(now);
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const isToday = date === today;
  if (params.mode === "month") return buildMonthWall({ ...params, now, today, date });
  const inScope = (branchId: string | null) =>
    !params.branchScope || (branchId !== null && params.branchScope.has(branchId));

  const [report, allBranches, companies, errandPunches, fieldTasks, employees] = await Promise.all([
    buildDailyReport(date, params.branchId ?? undefined, params.companyId),
    listBranches(true, params.companyId),
    listCompanies(true),
    listErrandPunchesOfDate(date),
    listFieldTasks({ from: date, to: date, companyId: params.companyId }),
    listEmployees({ activeOnly: true, companyId: params.companyId }),
  ]);

  const rows = report.rows.filter((r) => inScope(r.branchId));
  const branches = allBranches.filter((b) => inScope(b.id));
  const employeeById = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const person = (r: (typeof rows)[number], detail: string): WallPerson => ({
    employeeId: r.employeeId,
    empCode: r.empCode,
    payrollCode: r.payrollCode,
    fullName: r.fullName,
    branchName: r.branchName,
    companyName: r.companyName,
    detail,
  });

  // ---------- ยอดรวมของวัน ----------
  const totals = {
    staff: rows.length,
    arrived: 0,
    notArrived: 0,
    overdue: 0,
    late: 0,
    lateMinutes: 0,
    incomplete: 0,
    absent: 0,
    off: 0,
    holiday: 0,
    onLeave: 0,
    complete: 0,
    onErrand: 0,
    onField: 0,
    overBreakMinutes: 0,
    workMinutes: 0,
    otMinutes: 0,
  };

  const notArrived: WallPerson[] = [];
  const late: WallPerson[] = [];
  const onLeave: WallPerson[] = [];

  for (const r of rows) {
    const s = r.summary;
    if (s.checkInAt) totals.arrived += 1;
    if (s.status === "complete") totals.complete += 1;
    if (s.status === "incomplete") totals.incomplete += 1;
    if (s.status === "absent") totals.absent += 1;
    if (s.status === "off") totals.off += 1;
    if (s.status === "holiday") totals.holiday += 1;
    if (s.status === "leave") {
      totals.onLeave += 1;
      onLeave.push(person(r, s.leaveTypeName ?? "ลา"));
    }
    totals.lateMinutes += s.lateMinutes;
    totals.overBreakMinutes += s.overBreakMinutes;
    totals.workMinutes += s.workMinutes;
    totals.otMinutes += s.otMinutes;

    if (s.lateMinutes > 0) {
      totals.late += 1;
      late.push(person(r, `เข้า ${s.checkInAt ? hhmm(s.checkInAt) : "-"} · สาย ${s.lateMinutes} นาที`));
    }

    // ยังไม่มา = ไม่มีเวลาเข้างาน และวันนั้นไม่ใช่วันหยุด/หยุดเวร/วันลาที่อนุมัติแล้ว
    if (!s.checkInAt && s.status !== "holiday" && s.status !== "off" && s.status !== "leave") {
      totals.notArrived += 1;
      // เลยเวลาเข้างานมาตรฐานแล้วหรือยัง (ดูเฉพาะวันนี้ ย้อนหลังถือว่าเลยหมดแล้ว)
      const overdue = !isToday || hhmm(now.toISOString()) > r.workStart;
      if (overdue) totals.overdue += 1;
      notArrived.push(person(r, `เข้างาน ${r.workStart}${overdue ? " · เลยเวลาแล้ว" : ""}`));
    }
  }

  // ---------- กำลังออกไปทำธุระตอนนี้ ----------
  const onErrand: WallPerson[] = [];
  const byEmployee = new Map<string, typeof errandPunches>();
  for (const p of errandPunches) {
    byEmployee.set(p.employee_id, [...(byEmployee.get(p.employee_id) ?? []), p]);
  }
  const rowByEmployee = new Map(rows.map((r) => [r.employeeId, r]));
  for (const [employeeId, punches] of byEmployee) {
    const open = groupErrandRounds(punches).find((round) => round.isOpen);
    const row = rowByEmployee.get(employeeId);
    if (!open?.out || !row) continue;
    onErrand.push(
      person(
        row,
        `ออกตั้งแต่ ${hhmm(open.out.punched_at)} · ${minutesSince(open.out.punched_at, now)} นาที${
          open.reason ? ` · ${open.reason}` : ""
        }`,
      ),
    );
  }
  totals.onErrand = onErrand.length;

  // ---------- กำลังทำงานนอกสถานที่ ----------
  const onField: WallPerson[] = [];
  for (const task of fieldTasks) {
    for (const m of task.members) {
      if (!m.start || m.end) continue;
      const row = rowByEmployee.get(m.employee_id);
      const emp = employeeById.get(m.employee_id);
      if (!row && !emp) continue;
      if (!row && emp && !inScope(emp.branch_id)) continue;
      onField.push({
        employeeId: m.employee_id,
        empCode: m.emp_code,
        payrollCode: emp?.payroll_code ?? null,
        fullName: m.full_name,
        branchName: row?.branchName ?? emp?.branch_name ?? null,
        companyName: row?.companyName ?? null,
        detail: `${task.type_name} · ${task.site_name ?? task.place_text ?? "-"} · เริ่ม ${hhmm(m.start.punched_at)}`,
      });
    }
  }
  totals.onField = onField.length;

  // ---------- แยกตามมิติ ----------
  const emptyItem = (key: string, label: string): WallDimItem => ({
    key,
    label,
    staff: 0,
    arrived: 0,
    late: 0,
    absent: 0,
    incomplete: 0,
    lateMinutes: 0,
    workMinutes: 0,
  });

  const dimKey: Record<WallDim, (r: (typeof rows)[number]) => { key: string; label: string }> = {
    branch: (r) => ({ key: r.branchId ?? "none", label: r.branchName ?? "ไม่ระบุสาขา" }),
    company: (r) => ({ key: r.companyName ?? "none", label: r.companyName ?? "ไม่ระบุบริษัท" }),
    department: (r) => ({ key: r.department ?? "none", label: r.department ?? "ไม่ระบุแผนก" }),
    position: (r) => {
      const name = employeeById.get(r.employeeId)?.position_name ?? null;
      return { key: name ?? "none", label: name ?? "ไม่ระบุตำแหน่ง" };
    },
  };

  const dims = {} as AttendanceWall["dims"];
  for (const dim of Object.keys(dimKey) as WallDim[]) {
    const map = new Map<string, WallDimItem>();
    for (const r of rows) {
      const { key, label } = dimKey[dim](r);
      const item = map.get(key) ?? emptyItem(key, label);
      item.staff += 1;
      if (r.summary.checkInAt) item.arrived += 1;
      if (r.summary.lateMinutes > 0) item.late += 1;
      if (r.summary.status === "absent") item.absent += 1;
      if (r.summary.status === "incomplete") item.incomplete += 1;
      item.lateMinutes += r.summary.lateMinutes;
      item.workMinutes += r.summary.workMinutes;
      map.set(key, item);
    }
    dims[dim] = { title: DIM_TITLE[dim], items: [...map.values()] };
  }

  // ---------- แนวโน้ม 14 วันย้อนหลัง ----------
  const trend = await buildTrend({
    from: addDays(date, -13),
    to: date,
    companyId: params.companyId,
    branchId: params.branchId,
    branchScope: params.branchScope,
  });

  return {
    generatedAt: now.toISOString(),
    mode: "day" as const,
    date,
    isToday,
    period: { from: date, to: date, label: thaiDate(date) },
    scope: {
      companyName: companies.find((c) => c.id === params.companyId)?.name ?? null,
      branchName: branches.find((b) => b.id === params.branchId)?.name ?? null,
    },
    totals,
    dims,
    notArrived: notArrived.sort((a, b) => a.empCode.localeCompare(b.empCode)),
    late: late.sort((a, b) => b.detail.localeCompare(a.detail)),
    onLeave: onLeave.sort((a, b) => a.empCode.localeCompare(b.empCode)),
    ranks: { late: [], absent: [], leave: [], overBreak: [] },
    onErrand,
    onField,
    trend,
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
  };
}

/** ชื่อเดือนไทยแบบเต็ม ใช้เป็นหัวเรื่องของช่วงที่ดู */
const TH_MONTH_NAME = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTH_NAME[m - 1]} ${y + 543}`;
}

/**
 * โหมดเดือน: สะสมทั้งเดือนจนถึงวันนี้ ตัวเลขเป็น คน-วัน ไม่ใช่จำนวนคน
 * (พนักงาน 1 คนที่สาย 3 วัน นับเป็น 3)
 * ใช้ข้อมูลชุดเดียวกับรายงานรายเดือน ตัวเลขบนจอกับในรายงานจึงตรงกันเสมอ
 */
async function buildMonthWall(params: {
  month?: string;
  date: string;
  today: string;
  now: Date;
  companyId?: string | null;
  branchId?: string | null;
  branchScope?: Set<string> | null;
}): Promise<AttendanceWall> {
  const { now, today, date } = params;
  const ym =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : date.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const inScope = (branchId: string | null) =>
    !params.branchScope || (branchId !== null && params.branchScope.has(branchId));

  const [report, allBranches, companies] = await Promise.all([
    buildMonthlyReport(year, month, params.branchId ?? undefined, params.companyId),
    listBranches(true, params.companyId),
    listCompanies(true),
  ]);

  const people = report.employees.filter((r) => inScope(r.employee.branch_id));
  const branches = allBranches.filter((b) => inScope(b.id));
  const from = report.dates[0] ?? date;
  const monthEnd = report.dates[report.dates.length - 1] ?? date;
  const to = monthEnd < today ? monthEnd : today;

  const totals: AttendanceWall["totals"] = {
    staff: people.length,
    arrived: 0,
    notArrived: 0,
    overdue: 0,
    late: 0,
    lateMinutes: 0,
    incomplete: 0,
    absent: 0,
    off: 0,
    holiday: 0,
    onLeave: 0,
    complete: 0,
    onErrand: 0,
    onField: 0,
    overBreakMinutes: 0,
    workMinutes: 0,
    otMinutes: 0,
  };

  for (const r of people) {
    const t = r.totals;
    totals.arrived += t.workedDays;
    totals.complete += t.completeDays;
    totals.incomplete += t.incompleteDays;
    totals.absent += t.absentDays;
    totals.onLeave += t.leaveDays;
    totals.off += t.offDays;
    totals.late += t.lateDays;
    totals.lateMinutes += t.lateMinutes;
    totals.overBreakMinutes += t.overBreakMinutes;
    totals.workMinutes += t.workMinutes;
    totals.otMinutes += t.otMinutes;
  }

  const person = (r: (typeof people)[number], detail: string): WallPerson => ({
    employeeId: r.employee.id,
    empCode: r.employee.emp_code,
    payrollCode: r.employee.payroll_code,
    fullName: r.employee.full_name,
    branchName: r.employee.branch_name ?? null,
    companyName: r.companyName,
    detail,
  });

  // อันดับคนที่ต้องดูแล — เอาเฉพาะคนที่มีตัวเลขจริง จะได้ไม่มีรายชื่อศูนย์มาปน
  const rankBy = (
    value: (r: (typeof people)[number]) => number,
    detail: (r: (typeof people)[number]) => string,
  ): WallPerson[] =>
    people
      .filter((r) => value(r) > 0)
      .sort((a, b) => value(b) - value(a))
      .slice(0, 15)
      .map((r) => person(r, detail(r)));

  const ranks = {
    late: rankBy(
      (r) => r.totals.lateDays,
      (r) => `สาย ${r.totals.lateDays} วัน · รวม ${r.totals.lateMinutes} นาที`,
    ),
    absent: rankBy((r) => r.totals.absentDays, (r) => `ขาดงาน ${r.totals.absentDays} วัน`),
    leave: rankBy((r) => r.totals.leaveDays, (r) => `ลา ${r.totals.leaveDays} วัน`),
    overBreak: rankBy(
      (r) => r.totals.overBreakMinutes,
      (r) => `พักเกิน ${r.totals.overBreakMinutes} นาที · ${r.totals.overBreakDays} วัน`,
    ),
  };

  // ---------- แยกตามมิติ (คน-วัน) ----------
  const dimKey: Record<WallDim, (r: (typeof people)[number]) => { key: string; label: string }> = {
    branch: (r) => ({
      key: r.employee.branch_id ?? "none",
      label: r.employee.branch_name ?? "ไม่ระบุสาขา",
    }),
    company: (r) => ({ key: r.companyName ?? "none", label: r.companyName ?? "ไม่ระบุบริษัท" }),
    department: (r) => ({
      key: r.employee.department_name ?? "none",
      label: r.employee.department_name ?? "ไม่ระบุแผนก",
    }),
    position: (r) => ({
      key: r.employee.position_name ?? "none",
      label: r.employee.position_name ?? "ไม่ระบุตำแหน่ง",
    }),
  };

  const dims = {} as AttendanceWall["dims"];
  for (const dim of Object.keys(dimKey) as WallDim[]) {
    const map = new Map<string, WallDimItem>();
    for (const r of people) {
      const { key, label } = dimKey[dim](r);
      const item = map.get(key) ?? {
        key,
        label,
        staff: 0,
        arrived: 0,
        late: 0,
        absent: 0,
        incomplete: 0,
        lateMinutes: 0,
        workMinutes: 0,
      };
      // โหมดเดือนเทียบ "วันที่มาจริง" กับ "วันที่ต้องมา" แถบจึงเป็นอัตราการมาทำงาน
      item.staff += r.totals.workedDays + r.totals.absentDays;
      item.arrived += r.totals.workedDays;
      item.late += r.totals.lateDays;
      item.absent += r.totals.absentDays;
      item.incomplete += r.totals.incompleteDays;
      item.lateMinutes += r.totals.lateMinutes;
      item.workMinutes += r.totals.workMinutes;
      map.set(key, item);
    }
    dims[dim] = { title: DIM_TITLE[dim], items: [...map.values()] };
  }

  const trend = await buildTrend({
    from,
    to,
    companyId: params.companyId,
    branchId: params.branchId,
    branchScope: params.branchScope,
  });

  const isThisMonth = ym === today.slice(0, 7);
  return {
    generatedAt: now.toISOString(),
    mode: "month" as const,
    date,
    isToday: isThisMonth,
    period: {
      from,
      to,
      label: `${TH_MONTH_NAME[month - 1]} ${year + 543}${isThisMonth ? ` (ถึง ${thaiDate(to)})` : ""}`,
    },
    scope: {
      companyName: companies.find((c) => c.id === params.companyId)?.name ?? null,
      branchName: branches.find((b) => b.id === params.branchId)?.name ?? null,
    },
    totals,
    dims,
    notArrived: [],
    late: [],
    onLeave: [],
    onErrand: [],
    onField: [],
    ranks,
    trend,
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
  };
}

/**
 * นับสถานะรายวันย้อนหลังหลายวันในครั้งเดียว
 * ดึง view + ตารางเวร + วันหยุดครั้งเดียวแล้วคำนวณในหน่วยความจำ ไม่ยิงฐานข้อมูลทีละวัน
 */
async function buildTrend(params: {
  from: string;
  to: string;
  companyId?: string | null;
  branchId?: string | null;
  branchScope?: Set<string> | null;
}): Promise<AttendanceWall["trend"]> {
  const { from, to } = params;
  const [employees, holidays, dayRows, resolver, errands] = await Promise.all([
    listEmployees({ activeOnly: true, branchId: params.branchId ?? undefined, companyId: params.companyId }),
    getHolidaySet(from, to, params.companyId),
    getDayRows({ from, to, branchId: params.branchId ?? undefined, companyId: params.companyId }),
    getSettingsResolver(params.companyId, { from, to }),
    getErrandSummaryMap({ from, to }),
  ]);
  const leaves = await getLeaveDayMap({ from, to, companyId: params.companyId });

  const scoped = employees.filter(
    (e) => !params.branchScope || (e.branch_id !== null && params.branchScope.has(e.branch_id)),
  );
  const rowsByKey = new Map(dayRows.map((r) => [`${r.employee_id}|${r.work_date}`, r]));

  return dateRange(from, to).map((date) => {
    const day = { date, arrived: 0, late: 0, absent: 0, incomplete: 0 };
    for (const emp of scoped) {
      const row = rowsByKey.get(`${emp.id}|${date}`);
      const errand = errands.get(`${emp.id}|${date}`);
      const summary = computeDaySummary(
        {
          work_date: date,
          check_in_at: row?.check_in_at ?? null,
          break_out_at: row?.break_out_at ?? null,
          break_in_at: row?.break_in_at ?? null,
          check_out_at: row?.check_out_at ?? null,
          errand_minutes: errand?.minutes ?? 0,
          errand_rounds: errand?.rounds ?? 0,
        },
        resolver.resolve(row?.branch_id ?? emp.branch_id, emp.id, date),
        holidays.has(date),
        resolver.isDayOff(emp.id, date),
        leaves.get(`${emp.id}|${date}`) ?? null,
      );
      if (summary.checkInAt) day.arrived += 1;
      if (summary.lateMinutes > 0) day.late += 1;
      if (summary.status === "absent") day.absent += 1;
      if (summary.status === "incomplete") day.incomplete += 1;
    }
    return day;
  });
}

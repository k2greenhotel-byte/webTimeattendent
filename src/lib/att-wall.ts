import "server-only";
import { computeDaySummary, groupErrandRounds } from "./attendance";
import { listCompanies } from "./core-db";
import { addDays, dateRange, workDateOf } from "./datetime";
import {
  getDayRows,
  getErrandSummaryMap,
  getHolidaySet,
  getSettingsResolver,
  listBranches,
  listEmployees,
  listErrandPunchesOfDate,
  listFieldTasks,
} from "./db";
import { buildDailyReport } from "./reports";
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

export type AttendanceWall = {
  generatedAt: string;
  date: string;
  isToday: boolean;
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
    complete: 0,
    onErrand: 0,
    onField: 0,
    overBreakMinutes: 0,
    workMinutes: 0,
    otMinutes: 0,
  };

  const notArrived: WallPerson[] = [];
  const late: WallPerson[] = [];

  for (const r of rows) {
    const s = r.summary;
    if (s.checkInAt) totals.arrived += 1;
    if (s.status === "complete") totals.complete += 1;
    if (s.status === "incomplete") totals.incomplete += 1;
    if (s.status === "absent") totals.absent += 1;
    if (s.status === "off") totals.off += 1;
    if (s.status === "holiday") totals.holiday += 1;
    totals.lateMinutes += s.lateMinutes;
    totals.overBreakMinutes += s.overBreakMinutes;
    totals.workMinutes += s.workMinutes;
    totals.otMinutes += s.otMinutes;

    if (s.lateMinutes > 0) {
      totals.late += 1;
      late.push(person(r, `เข้า ${s.checkInAt ? hhmm(s.checkInAt) : "-"} · สาย ${s.lateMinutes} นาที`));
    }

    // ยังไม่มา = ไม่มีเวลาเข้างาน และวันนั้นไม่ใช่วันหยุด/หยุดเวร
    if (!s.checkInAt && s.status !== "holiday" && s.status !== "off") {
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
    date,
    isToday,
    scope: {
      companyName: companies.find((c) => c.id === params.companyId)?.name ?? null,
      branchName: branches.find((b) => b.id === params.branchId)?.name ?? null,
    },
    totals,
    dims,
    notArrived: notArrived.sort((a, b) => a.empCode.localeCompare(b.empCode)),
    late: late.sort((a, b) => b.detail.localeCompare(a.detail)),
    onErrand,
    onField,
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
      );
      if (summary.checkInAt) day.arrived += 1;
      if (summary.lateMinutes > 0) day.late += 1;
      if (summary.status === "absent") day.absent += 1;
      if (summary.status === "incomplete") day.incomplete += 1;
    }
    return day;
  });
}

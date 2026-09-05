import "server-only";
import { expectedTimes, resolveSettings } from "./attendance";
import { addDays, workDateOf } from "./datetime";
import { getSupabase, PHOTO_BUCKET } from "./supabase-server";
import type {
  AttendanceDayRow,
  AttendanceRecord,
  Branch,
  Department,
  Employee,
  FieldPunch,
  FieldPunchType,
  FieldTask,
  FieldTaskMember,
  FieldTaskType,
  Holiday,
  OrgSettings,
  Position,
  PunchType,
  ShiftAssignment,
  WorkSchedule,
  WorkSettings,
  WorkSite,
} from "./types";

const EMPLOYEE_COLUMNS =
  "id, emp_code, full_name, nickname, phone, email, role, is_active, hire_date, branch_id, department_id, position_id";

const DEFAULT_ORG: OrgSettings = {
  company_id: null,
  org_name: "บริษัทของฉัน",
  timezone: "Asia/Bangkok",
  require_gps: false,
  radius_m: 200,
  default_schedule_id: null,
};

const FALLBACK_SCHEDULE: WorkSchedule = {
  id: "default",
  company_id: null,
  name: "กะมาตรฐาน",
  work_start: "08:00",
  break_start: "12:00",
  break_end: "13:00",
  work_end: "17:00",
  break_allow_minutes: 60,
  break_policy: "actual",
  late_grace_min: 5,
  early_leave_grace_min: 5,
  count_ot: true,
  ot_grace_min: 30,
  workdays: [1, 2, 3, 4, 5, 6],
  is_default: true,
};

function timeOnly(value: unknown, fallback: string): string {
  return value ? String(value).slice(0, 5) : fallback;
}

// ---------- ค่าตั้งต้นของแต่ละบริษัท ----------

/**
 * ข้อมูลหลักของระบบลงเวลาแยกตามบริษัท โดยแถวที่ company_id เป็น null คือ "ของกลาง"
 * ที่ทุกบริษัทใช้ร่วมกันได้ ตัวกรองนี้จึงเอาทั้งของบริษัทนั้นและของกลางเสมอ
 */
const companyScope = (companyId: string) => `company_id.eq.${companyId},company_id.is.null`;

export async function getOrgSettings(companyId?: string | null): Promise<OrgSettings> {
  const supabase = getSupabase();
  const query = supabase.from("work_settings").select("*");

  const { data, error } = companyId
    ? await query.eq("company_id", companyId).maybeSingle()
    : await query.limit(1).maybeSingle();

  if (error) throw new Error(`อ่านการตั้งค่าไม่สำเร็จ: ${error.message}`);
  return data
    ? ({ ...DEFAULT_ORG, ...data } as OrgSettings)
    : { ...DEFAULT_ORG, company_id: companyId ?? null };
}

/** ค่าตั้งต้นของทุกบริษัท — ใช้ตอนทำรายงานที่มีหลายบริษัทปนกัน */
export async function listOrgSettings(): Promise<OrgSettings[]> {
  const { data, error } = await getSupabase().from("work_settings").select("*");
  if (error) throw new Error(`อ่านการตั้งค่าไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as OrgSettings[];
}

export async function updateOrgSettings(
  companyId: string | null,
  patch: Partial<OrgSettings>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("work_settings")
    .upsert(
      { ...patch, company_id: companyId, updated_at: new Date().toISOString() },
      { onConflict: "company_id" },
    );
  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`);
}

// ---------- กะทำงาน ----------

export async function listSchedules(companyId?: string | null): Promise<WorkSchedule[]> {
  let query = getSupabase().from("work_schedules").select("*").order("name");
  if (companyId) query = query.or(companyScope(companyId));

  const { data, error } = await query;
  if (error) throw new Error(`อ่านกะทำงานไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((s) => ({
    ...(s as WorkSchedule),
    work_start: timeOnly(s.work_start, "08:00"),
    break_start: timeOnly(s.break_start, "12:00"),
    break_end: timeOnly(s.break_end, "13:00"),
    work_end: timeOnly(s.work_end, "17:00"),
  }));
}

export async function insertSchedule(row: Omit<WorkSchedule, "id">): Promise<void> {
  const { error } = await getSupabase().from("work_schedules").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "ชื่อกะนี้ถูกใช้แล้ว" : `เพิ่มกะทำงานไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateSchedule(id: string, patch: Partial<WorkSchedule>): Promise<void> {
  const { error } = await getSupabase().from("work_schedules").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "ชื่อกะนี้ถูกใช้แล้ว" : `บันทึกกะทำงานไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** ตั้งกะเริ่มต้นของบริษัทหนึ่ง (แต่ละบริษัทมีกะเริ่มต้นของตัวเองได้หนึ่งกะ) */
export async function setDefaultSchedule(id: string): Promise<void> {
  const supabase = getSupabase();

  const { data: target } = await supabase
    .from("work_schedules")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  const companyId = (target?.company_id ?? null) as string | null;

  // ล้างค่าเริ่มต้นเดิมเฉพาะในขอบเขตเดียวกัน (บริษัทเดียวกัน หรือของกลางด้วยกัน)
  let clear = supabase.from("work_schedules").update({ is_default: false }).neq("id", id);
  clear = companyId ? clear.eq("company_id", companyId) : clear.is("company_id", null);
  const { error: clearError } = await clear;
  if (clearError) throw new Error(`ตั้งกะเริ่มต้นไม่สำเร็จ: ${clearError.message}`);

  const { error } = await supabase.from("work_schedules").update({ is_default: true }).eq("id", id);
  if (error) throw new Error(`ตั้งกะเริ่มต้นไม่สำเร็จ: ${error.message}`);

  await updateOrgSettings(companyId, { default_schedule_id: id });
}

export async function deleteSchedule(id: string, force = false): Promise<{ affected: number }> {
  const supabase = getSupabase();

  const { data: schedule } = await supabase
    .from("work_schedules")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();
  if (schedule?.is_default) throw new Error("ลบกะเริ่มต้นไม่ได้ กรุณาตั้งกะอื่นเป็นค่าเริ่มต้นก่อน");

  const { count, error: countError } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", id);
  if (countError) throw new Error(`ตรวจสอบสาขาที่ใช้กะนี้ไม่สำเร็จ: ${countError.message}`);

  const used = count ?? 0;
  if (used > 0 && !force) {
    throw new Error(`ลบไม่ได้ มี ${used} สาขาใช้กะนี้อยู่ — ติ๊กยืนยันถ้าต้องการลบจริง`);
  }

  // ตารางเวรที่ยังอ้างกะนี้อยู่ ฐานข้อมูลห้ามลบ (on delete restrict) จึงบอกให้ชัดว่าต้องแก้เวรก่อน
  const { count: rosterCount } = await supabase
    .from("shift_assignments")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", id);
  if ((rosterCount ?? 0) > 0) {
    throw new Error(
      `ลบไม่ได้ กะนี้ถูกจัดอยู่ในตารางเวร ${rosterCount} วัน — เปลี่ยนกะในตารางเวรก่อนแล้วค่อยลบ`,
    );
  }

  // สาขาที่ใช้กะนี้จะกลับไปใช้กะเริ่มต้นโดยอัตโนมัติ (schedule_id = null)
  const { error } = await supabase.from("work_schedules").delete().eq("id", id);
  if (error) throw new Error(`ลบกะทำงานไม่สำเร็จ: ${error.message}`);
  return { affected: used };
}

/**
 * ค่าที่ใช้คำนวณจริงของคนหนึ่งในวันหนึ่ง
 *   = ค่าองค์กร + กะ (ตารางเวรของคนนั้นวันนั้น → กะของสาขา → กะเริ่มต้น) + พิกัดของสาขา
 * ไม่ส่ง employeeId/workDate มา = ใช้กะของสาขาเหมือนเดิม
 */
export async function getResolvedSettings(
  branchId?: string | null,
  employeeId?: string | null,
  workDate?: string | null,
): Promise<WorkSettings> {
  return (await getResolvedDay(branchId, employeeId, workDate)).settings;
}

/** เหมือน getResolvedSettings แต่บอกด้วยว่าวันนั้นเป็นวันหยุดเวรของคนนั้นหรือไม่ */
export async function getResolvedDay(
  branchId?: string | null,
  employeeId?: string | null,
  workDate?: string | null,
): Promise<{ settings: WorkSettings; isDayOff: boolean; assignment: ShiftAssignment | null }> {
  const [branch, assignment] = await Promise.all([
    getBranchById(branchId ?? null),
    employeeId && workDate ? getAssignment(employeeId, workDate) : Promise.resolve(null),
  ]);
  const companyId = branch?.company_id ?? null;

  const [org, schedules, site] = await Promise.all([
    getOrgSettings(companyId),
    listSchedules(companyId),
    // วันที่ไปประจำบูธ: GPS ต้องตรวจกับพิกัดบูธ ไม่ใช่สาขา
    assignment?.site_id ? getSiteById(assignment.site_id) : Promise.resolve(null),
  ]);

  const byId = new Map(schedules.map((s) => [s.id, s]));
  const schedule =
    (assignment?.schedule_id ? byId.get(assignment.schedule_id) : undefined) ??
    (branch?.schedule_id ? byId.get(branch.schedule_id) : undefined) ??
    pickDefaultSchedule(schedules, org, companyId);

  return {
    settings: resolveSettings(org, schedule, branch, site),
    isDayOff: assignment?.is_day_off ?? false,
    assignment,
  };
}

/**
 * การลงเวลาตอนนี้ควรผูกกับวันทำงานไหน
 * ปกติคือวันปฏิทินวันนี้ แต่คนกะดึกที่กดออกงานตอนเช้าต้องผูกกับ "เมื่อวาน" ที่เป็นวันเริ่มกะ
 * เงื่อนไข: เมื่อวานมีเวรกะข้ามเที่ยงคืน + ยังไม่ได้กดออกงาน + ยังไม่เลยเวลาเลิกกะไปเกิน 4 ชม.
 */
export async function resolveWorkDateForPunch(
  employeeId: string,
  branchId: string | null,
  now: Date = new Date(),
): Promise<string> {
  const today = workDateOf(now);
  const yesterday = addDays(today, -1);

  const assignment = await getAssignment(employeeId, yesterday);
  if (!assignment || assignment.is_day_off || !assignment.schedule_id) return today;

  const { settings } = await getResolvedDay(branchId, employeeId, yesterday);
  if (!settings.crosses_midnight) return today;

  const punches = await getPunchesOfDay(employeeId, yesterday);
  const startedYesterday = punches.some((p) => p.punch_type === "check_in");
  const finished = punches.some((p) => p.punch_type === "check_out");
  if (!startedYesterday || finished) return today;

  const graceMs = 4 * 60 * 60_000;
  return now.getTime() <= expectedTimes(yesterday, settings).end.getTime() + graceMs
    ? yesterday
    : today;
}

/** กะที่ใช้เมื่อสาขาไม่ได้เลือกเอง — ของบริษัทตัวเองมาก่อน แล้วค่อยของกลาง */
function pickDefaultSchedule(
  schedules: WorkSchedule[],
  org: OrgSettings,
  companyId: string | null,
): WorkSchedule {
  return (
    schedules.find((s) => s.is_default && s.company_id === companyId) ??
    schedules.find((s) => s.is_default && s.company_id === null) ??
    schedules.find((s) => s.id === org.default_schedule_id) ??
    schedules.find((s) => s.company_id === companyId) ??
    schedules[0] ??
    FALLBACK_SCHEDULE
  );
}

/**
 * ตัวช่วยสำหรับรายงาน: โหลดข้อมูลอ้างอิงครั้งเดียวแล้ว resolve ได้หลายสาขา
 * รองรับรายงานที่มีหลายบริษัทปนกัน โดยหยิบค่าตั้งต้นและกะตามบริษัทของแต่ละสาขา
 */
export async function getSettingsResolver(
  companyId?: string | null,
  range?: { from: string; to: string },
): Promise<{
  org: OrgSettings;
  branches: Map<string, Branch>;
  /** กะที่ใช้คำนวณ — ส่ง employeeId+workDate มาด้วยเพื่อให้ตารางเวรมีผล */
  resolve: (branchId?: string | null, employeeId?: string | null, workDate?: string | null) => WorkSettings;
  /** วันนั้นเป็นวันหยุดเวรของคนนั้นหรือไม่ */
  isDayOff: (employeeId: string, workDate: string) => boolean;
  /** ชื่อสถานที่นอกสาขาที่ไปประจำวันนั้น (null = สาขาตัวเอง) */
  siteNameOf: (employeeId: string, workDate: string) => string | null;
}> {
  const [orgList, schedules, branchList, assignments, sites] = await Promise.all([
    listOrgSettings(),
    listSchedules(),
    listBranches(false, companyId),
    range ? listAssignments({ from: range.from, to: range.to }) : Promise.resolve([]),
    range ? listSites() : Promise.resolve([]),
  ]);

  const orgByCompany = new Map(orgList.map((o) => [o.company_id ?? "", o]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const branches = new Map(branchList.map((b) => [b.id, b]));
  const siteById = new Map(sites.map((s) => [s.id, s]));
  // preload ตารางเวรทั้งช่วงครั้งเดียว รายงานรายเดือนจะได้ไม่ยิงฐานข้อมูลทีละวัน
  const assignmentByKey = new Map(assignments.map((a) => [`${a.employee_id}|${a.work_date}`, a]));

  const orgFor = (cid: string | null) =>
    orgByCompany.get(cid ?? "") ?? orgByCompany.get("") ?? { ...DEFAULT_ORG, company_id: cid };

  return {
    org: orgFor(companyId ?? null),
    branches,
    resolve: (branchId, employeeId, workDate) => {
      const branch = branchId ? (branches.get(branchId) ?? null) : null;
      const cid = branch?.company_id ?? companyId ?? null;
      const org = orgFor(cid);
      const assignment =
        employeeId && workDate ? assignmentByKey.get(`${employeeId}|${workDate}`) : undefined;
      const schedule =
        (assignment?.schedule_id ? scheduleById.get(assignment.schedule_id) : undefined) ??
        (branch?.schedule_id ? scheduleById.get(branch.schedule_id) : undefined) ??
        pickDefaultSchedule(schedules, org, cid);
      const site = assignment?.site_id ? (siteById.get(assignment.site_id) ?? null) : null;
      return resolveSettings(org, schedule, branch, site);
    },
    isDayOff: (employeeId, workDate) =>
      assignmentByKey.get(`${employeeId}|${workDate}`)?.is_day_off ?? false,
    siteNameOf: (employeeId, workDate) => {
      const a = assignmentByKey.get(`${employeeId}|${workDate}`);
      return a?.site_id ? (siteById.get(a.site_id)?.name ?? a.site_name ?? null) : null;
    },
  };
}

// ---------- ตารางเวร (ใครอยู่กะไหน วันไหน) ----------

const ASSIGNMENT_COLUMNS =
  "id, employee_id, work_date, schedule_id, is_day_off, note, site_id, work_schedules(name), work_sites(name)";

/** ชื่อจากความสัมพันธ์ที่ Supabase คืนมา (อาจเป็น object หรือ array แล้วแต่ชนิด join) */
function relName(rel: unknown): string | null {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return (r as { name?: string } | null)?.name ?? null;
}

function toAssignment(row: Record<string, unknown>): ShiftAssignment {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    work_date: String(row.work_date),
    schedule_id: (row.schedule_id as string | null) ?? null,
    is_day_off: Boolean(row.is_day_off),
    note: (row.note as string | null) ?? null,
    site_id: (row.site_id as string | null) ?? null,
    schedule_name: relName(row.work_schedules),
    site_name: relName(row.work_sites),
  };
}

export async function getAssignment(employeeId: string, workDate: string): Promise<ShiftAssignment | null> {
  const { data, error } = await getSupabase()
    .from("shift_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(`อ่านตารางเวรไม่สำเร็จ: ${error.message}`);
  return data ? toAssignment(data as Record<string, unknown>) : null;
}

/** ตารางเวรในช่วงวันที่ (กรองคน/สาขา/บริษัทได้) */
export async function listAssignments(params: {
  from: string;
  to: string;
  employeeIds?: string[];
  branchId?: string | null;
  companyId?: string | null;
}): Promise<ShiftAssignment[]> {
  let scopeIds = params.employeeIds ?? null;
  if (!scopeIds && (params.branchId || params.companyId)) {
    const employees = await listEmployees({
      branchId: params.branchId ?? undefined,
      companyId: params.companyId ?? undefined,
    });
    scopeIds = employees.map((e) => e.id);
    if (scopeIds.length === 0) return [];
  }

  let query = getSupabase()
    .from("shift_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .order("work_date");
  if (scopeIds) query = query.in("employee_id", scopeIds);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านตารางเวรไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => toAssignment(r as Record<string, unknown>));
}

export type AssignmentInput = {
  employee_id: string;
  work_date: string;
  schedule_id: string | null;
  is_day_off: boolean;
  note?: string | null;
  /** ไปประจำสถานที่อื่นทั้งวัน (null = สาขาตัวเอง) */
  site_id?: string | null;
};

/** บันทึกตารางเวรหลายช่องพร้อมกัน — ช่องที่มีอยู่แล้วถูกแทนที่ (1 คน 1 วัน มีได้แถวเดียว) */
export async function upsertAssignments(rows: AssignmentInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = getSupabase();

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => ({
      employee_id: r.employee_id,
      work_date: r.work_date,
      schedule_id: r.is_day_off ? null : r.schedule_id,
      is_day_off: r.is_day_off,
      note: r.note ?? null,
      site_id: r.is_day_off ? null : (r.site_id ?? null),
    }));
    const { error } = await supabase
      .from("shift_assignments")
      .upsert(chunk, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(`บันทึกตารางเวรไม่สำเร็จ: ${error.message}`);
  }
  return rows.length;
}

/** ล้างตารางเวรของคนที่เลือกในช่วงวันที่ (กลับไปใช้กะสาขาตามเดิม) */
export async function deleteAssignments(params: {
  employeeIds: string[];
  from: string;
  to: string;
}): Promise<number> {
  if (params.employeeIds.length === 0) return 0;
  const { data, error } = await getSupabase()
    .from("shift_assignments")
    .delete()
    .in("employee_id", params.employeeIds)
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .select("id");
  if (error) throw new Error(`ล้างตารางเวรไม่สำเร็จ: ${error.message}`);
  return data?.length ?? 0;
}

/** คัดลอกตารางเวรของช่วงหนึ่งไปอีกช่วง (เช่น สัปดาห์ก่อน → สัปดาห์นี้) วันต่อวันตามลำดับ */
export async function copyAssignments(params: {
  employeeIds: string[];
  sourceFrom: string;
  targetFrom: string;
  days: number;
}): Promise<number> {
  if (params.employeeIds.length === 0 || params.days <= 0) return 0;
  const sourceTo = addDays(params.sourceFrom, params.days - 1);
  const source = await listAssignments({
    from: params.sourceFrom,
    to: sourceTo,
    employeeIds: params.employeeIds,
  });
  if (source.length === 0) return 0;

  const srcStart = new Date(`${params.sourceFrom}T00:00:00Z`).getTime();
  const rows: AssignmentInput[] = source.map((a) => {
    const offset = Math.round((new Date(`${a.work_date}T00:00:00Z`).getTime() - srcStart) / 86_400_000);
    return {
      employee_id: a.employee_id,
      work_date: addDays(params.targetFrom, offset),
      schedule_id: a.schedule_id,
      is_day_off: a.is_day_off,
      note: a.note,
      site_id: a.site_id,
    };
  });
  return upsertAssignments(rows);
}

// ---------- พนักงาน ----------

export async function listEmployees(
  options: { activeOnly?: boolean; branchId?: string; companyId?: string | null } | boolean = false,
): Promise<Employee[]> {
  const opts = typeof options === "boolean" ? { activeOnly: options } : options;

  // พนักงานสังกัดบริษัทผ่านสาขาของตัวเอง จึงกรองด้วยรายการสาขาของบริษัทนั้น
  const companyBranchIds = opts.companyId
    ? (await listBranches(false, opts.companyId)).map((b) => b.id)
    : null;

  let query = getSupabase().from("employees").select(EMPLOYEE_COLUMNS).order("emp_code");
  if (opts.activeOnly) query = query.eq("is_active", true);
  if (opts.branchId) query = query.eq("branch_id", opts.branchId);
  else if (companyBranchIds) {
    if (companyBranchIds.length === 0) return [];
    query = query.in("branch_id", companyBranchIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อพนักงานไม่สำเร็จ: ${error.message}`);

  const [branches, departments, positions] = await Promise.all([
    listBranches(),
    listDepartments(),
    listPositions(),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const posName = new Map(positions.map((p) => [p.id, p.name]));

  return (data ?? []).map((e) => ({
    ...(e as Employee),
    branch_name: e.branch_id ? (branchName.get(e.branch_id) ?? null) : null,
    department_name: e.department_id ? (deptName.get(e.department_id) ?? null) : null,
    position_name: e.position_id ? (posName.get(e.position_id) ?? null) : null,
  }));
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลพนักงานไม่สำเร็จ: ${error.message}`);
  return (data as Employee) ?? null;
}

/** ลบพนักงาน พร้อมลบรูปการลงเวลาทั้งหมดของคนนั้นออกจาก storage ด้วย */
export async function deleteEmployee(id: string): Promise<{ photosDeleted: number }> {
  const supabase = getSupabase();

  const { data: rows } = await supabase
    .from("attendance_records")
    .select("photo_path")
    .eq("employee_id", id);

  const paths = (rows ?? [])
    .map((r: { photo_path: string | null }) => r.photo_path)
    .filter((p): p is string => Boolean(p));
  await removePhotos(paths);

  // attendance_records ถูกลบตามด้วย on delete cascade
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw new Error(`ลบพนักงานไม่สำเร็จ: ${error.message}`);

  return { photosDeleted: paths.length };
}

// ---------- สาขา ----------

export async function listBranches(
  activeOnly = false,
  companyId?: string | null,
): Promise<Branch[]> {
  let query = getSupabase().from("branches").select("*").order("code");
  if (activeOnly) query = query.eq("is_active", true);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อสาขาไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Branch[];
}

export async function getBranchById(id: string | null): Promise<Branch | null> {
  if (!id) return null;
  const { data, error } = await getSupabase()
    .from("branches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสาขาไม่สำเร็จ: ${error.message}`);
  return (data as Branch) ?? null;
}

export async function insertBranch(row: Omit<Branch, "id">): Promise<void> {
  const { error } = await getSupabase().from("branches").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสสาขานี้ถูกใช้แล้ว" : `เพิ่มสาขาไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateBranch(id: string, patch: Partial<Branch>): Promise<void> {
  const { error } = await getSupabase().from("branches").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสสาขานี้ถูกใช้แล้ว" : `บันทึกสาขาไม่สำเร็จ: ${error.message}`,
    );
  }
}

/**
 * ลบสาขา — ปกติจะไม่ยอมลบถ้ายังมีพนักงานสังกัดอยู่
 * ถ้าแอดมินยืนยัน (force) จะลบให้ และพนักงานในสาขานั้นจะกลายเป็น "ไม่ระบุสาขา"
 */
export async function deleteBranch(id: string, force = false): Promise<{ affected: number }> {
  const { count, error: countError } = await getSupabase()
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", id);
  if (countError) throw new Error(`ตรวจสอบพนักงานในสาขาไม่สำเร็จ: ${countError.message}`);

  const employees = count ?? 0;
  if (employees > 0 && !force) {
    throw new Error(
      `ลบไม่ได้ ยังมีพนักงาน ${employees} คนอยู่ในสาขานี้ — ย้ายพนักงานออกก่อน หรือติ๊ก "ยืนยันลบทั้งที่ยังมีการใช้งาน"`,
    );
  }

  const { error } = await getSupabase().from("branches").delete().eq("id", id);
  if (error) throw new Error(`ลบสาขาไม่สำเร็จ: ${error.message}`);
  return { affected: employees };
}

// ---------- แผนก / ตำแหน่ง ----------

export async function listDepartments(companyId?: string | null): Promise<Department[]> {
  let query = getSupabase().from("departments").select("*").order("name");
  if (companyId) query = query.or(companyScope(companyId));

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อแผนกไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Department[];
}

export async function listPositions(companyId?: string | null): Promise<Position[]> {
  let query = getSupabase().from("positions").select("*").order("name");
  if (companyId) query = query.or(companyScope(companyId));

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อตำแหน่งไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Position[];
}

type LookupTable = "departments" | "positions";

const LOOKUP_LABEL: Record<LookupTable, string> = {
  departments: "แผนก",
  positions: "ตำแหน่ง",
};

export async function insertLookup(
  table: LookupTable,
  name: string,
  companyId: string | null = null,
): Promise<void> {
  const { error } = await getSupabase().from(table).insert({ name, company_id: companyId });
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `${LOOKUP_LABEL[table]}นี้มีอยู่แล้ว`
        : `เพิ่ม${LOOKUP_LABEL[table]}ไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateLookup(table: LookupTable, id: string, name: string): Promise<void> {
  const { error } = await getSupabase().from(table).update({ name }).eq("id", id);
  if (error) throw new Error(`บันทึก${LOOKUP_LABEL[table]}ไม่สำเร็จ: ${error.message}`);
}

export async function deleteLookup(
  table: LookupTable,
  id: string,
  force = false,
): Promise<{ affected: number }> {
  const column = table === "departments" ? "department_id" : "position_id";
  const { count, error: countError } = await getSupabase()
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  if (countError) throw new Error(`ตรวจสอบข้อมูลที่ใช้งานอยู่ไม่สำเร็จ: ${countError.message}`);

  const used = count ?? 0;
  if (used > 0 && !force) {
    throw new Error(
      `ลบไม่ได้ มีพนักงาน ${used} คนใช้${LOOKUP_LABEL[table]}นี้อยู่ — ติ๊กยืนยันถ้าต้องการลบจริง`,
    );
  }

  const { error } = await getSupabase().from(table).delete().eq("id", id);
  if (error) throw new Error(`ลบ${LOOKUP_LABEL[table]}ไม่สำเร็จ: ${error.message}`);
  return { affected: used };
}

// ---------- วันหยุด ----------

export async function getHolidaySet(
  from: string,
  to: string,
  companyId?: string | null,
): Promise<Set<string>> {
  let query = getSupabase()
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (companyId) query = query.or(companyScope(companyId));

  const { data, error } = await query;
  if (error) throw new Error(`อ่านวันหยุดไม่สำเร็จ: ${error.message}`);
  return new Set((data ?? []).map((r: { holiday_date: string }) => r.holiday_date));
}

export async function listHolidays(
  from?: string,
  to?: string,
  companyId?: string | null,
): Promise<Holiday[]> {
  let query = getSupabase().from("holidays").select("*").order("holiday_date");
  if (from) query = query.gte("holiday_date", from);
  if (to) query = query.lte("holiday_date", to);
  if (companyId) query = query.or(companyScope(companyId));

  const { data, error } = await query;
  if (error) throw new Error(`อ่านวันหยุดไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Holiday[];
}

export async function upsertHoliday(holiday: Holiday): Promise<void> {
  const { error } = await getSupabase()
    .from("holidays")
    .upsert(
      { ...holiday, company_id: holiday.company_id ?? null },
      { onConflict: "company_id,holiday_date" },
    );
  if (error) throw new Error(`บันทึกวันหยุดไม่สำเร็จ: ${error.message}`);
}

export async function deleteHoliday(date: string, companyId?: string | null): Promise<void> {
  let query = getSupabase().from("holidays").delete().eq("holiday_date", date);
  query = companyId ? query.eq("company_id", companyId) : query.is("company_id", null);

  const { error } = await query;
  if (error) throw new Error(`ลบวันหยุดไม่สำเร็จ: ${error.message}`);
}

// ---------- การลงเวลา ----------

export async function getDayRows(params: {
  from: string;
  to: string;
  employeeId?: string;
  branchId?: string;
  companyId?: string | null;
}): Promise<AttendanceDayRow[]> {
  let query = getSupabase()
    .from("v_attendance_days")
    .select("*")
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .order("work_date")
    .order("emp_code");

  if (params.employeeId) query = query.eq("employee_id", params.employeeId);
  if (params.branchId) query = query.eq("branch_id", params.branchId);
  else if (params.companyId) {
    // view ไม่มี company_id ตรง ๆ จึงกรองด้วยรายการสาขาของบริษัทนั้น
    const branchIds = (await listBranches(false, params.companyId)).map((b) => b.id);
    if (branchIds.length === 0) return [];
    query = query.in("branch_id", branchIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`อ่านข้อมูลการลงเวลาไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as AttendanceDayRow[];
}

export async function getPunchesOfDay(
  employeeId: string,
  workDate: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .order("punched_at");
  if (error) throw new Error(`อ่านการลงเวลาวันนี้ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as AttendanceRecord[];
}

export async function getRecordById(id: string): Promise<AttendanceRecord | null> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านรายการไม่สำเร็จ: ${error.message}`);
  return (data as AttendanceRecord) ?? null;
}

export async function insertPunch(row: {
  employee_id: string;
  work_date: string;
  punch_type: PunchType;
  punched_at: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  device_info: string | null;
  branch_id?: string | null;
  /** สถานที่นอกสาขาที่ไปประจำวันนั้น (snapshot จากตารางเวร) */
  site_id?: string | null;
  note?: string | null;
  is_manual?: boolean;
  edited_by?: string | null;
}): Promise<AttendanceRecord> {
  const { data, error } = await getSupabase()
    .from("attendance_records")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("คุณลงเวลาช่วงนี้ไปแล้ววันนี้");
    throw new Error(`บันทึกการลงเวลาไม่สำเร็จ: ${error.message}`);
  }
  return data as AttendanceRecord;
}

export async function updatePunchTime(
  id: string,
  punchedAt: string,
  note: string | null,
  editorId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from("attendance_records")
    .update({ punched_at: punchedAt, note, is_manual: true, edited_by: editorId })
    .eq("id", id);
  if (error) throw new Error(`แก้ไขเวลาไม่สำเร็จ: ${error.message}`);
}

export async function deletePunch(id: string): Promise<void> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("attendance_records")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (data?.photo_path) await removePhotos([data.photo_path]);

  const { error } = await supabase.from("attendance_records").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการไม่สำเร็จ: ${error.message}`);
}

export type AttendanceFilter = {
  from: string;
  to: string;
  employeeId?: string;
  branchId?: string;
  /** จำกัดเฉพาะสาขาของบริษัทนี้ (ใช้ตอนนับ/ลบข้อมูลจากหน้าหลังบ้าน) */
  companyId?: string | null;
};

/** สาขาที่เข้าเงื่อนไข — null = ไม่จำกัดสาขา */
async function branchIdsFor(filter: AttendanceFilter): Promise<string[] | null> {
  if (filter.branchId) return [filter.branchId];
  if (!filter.companyId) return null;
  return (await listBranches(false, filter.companyId)).map((b) => b.id);
}

/** นับจำนวนรายการลงเวลาที่ตรงเงื่อนไข (ใช้แสดงก่อนยืนยันลบ) */
export async function countAttendance(filter: AttendanceFilter): Promise<number> {
  let query = getSupabase()
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .gte("work_date", filter.from)
    .lte("work_date", filter.to);
  if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);

  const branchIds = await branchIdsFor(filter);
  if (branchIds) {
    if (branchIds.length === 0) return 0;
    query = query.in("branch_id", branchIds);
  }

  const { count, error } = await query;
  if (error) throw new Error(`นับข้อมูลการลงเวลาไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/** ลบข้อมูลการลงเวลาตามเงื่อนไข พร้อมลบรูปใน storage ทิ้งด้วย */
export async function deleteAttendanceRange(
  filter: AttendanceFilter,
): Promise<{ deleted: number; photosDeleted: number }> {
  const supabase = getSupabase();

  let query = supabase
    .from("attendance_records")
    .select("id, photo_path")
    .gte("work_date", filter.from)
    .lte("work_date", filter.to);
  if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);

  const branchIds = await branchIdsFor(filter);
  if (branchIds) {
    if (branchIds.length === 0) return { deleted: 0, photosDeleted: 0 };
    query = query.in("branch_id", branchIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`อ่านข้อมูลการลงเวลาไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []) as { id: string; photo_path: string | null }[];
  if (rows.length === 0) return { deleted: 0, photosDeleted: 0 };

  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  await removePhotos(paths);

  // ลบทีละก้อน กัน URL ยาวเกินไปเมื่อมีรายการเยอะ
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error: deleteError } = await supabase
      .from("attendance_records")
      .delete()
      .in("id", ids.slice(i, i + 200));
    if (deleteError) throw new Error(`ลบข้อมูลการลงเวลาไม่สำเร็จ: ${deleteError.message}`);
  }

  return { deleted: rows.length, photosDeleted: paths.length };
}

/** ลบการลงเวลาทั้งวันของพนักงานหนึ่งคน */
export async function deleteDayPunches(
  employeeId: string,
  workDate: string,
): Promise<{ deleted: number; photosDeleted: number }> {
  return deleteAttendanceRange({ from: workDate, to: workDate, employeeId });
}

// ---------- รูปภาพ ----------

export async function uploadPhoto(path: string, bytes: ArrayBuffer): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
}

/** ลบรูปออกจาก storage (ทีละก้อน) — เรียกก่อนลบแถวในฐานข้อมูลเสมอ */
export async function removePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(PHOTO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบรูปไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบรูปใน storage ไม่สำเร็จ:", error.message);
  }
}

export async function signedPhotoUrl(
  path: string | null,
  expiresInSec = 600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ---------- audit log ----------

export async function logAudit(entry: {
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const { error } = await getSupabase().from("audit_logs").insert({
    actor_id: entry.actor_id,
    action: entry.action,
    target_table: entry.target_table,
    target_id: entry.target_id ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) console.error("เขียน audit log ไม่สำเร็จ:", error.message);
}

// ---------- สถานที่ปฏิบัติงานนอกสถานที่ ----------

export async function listSites(companyId?: string | null, activeOnly = false): Promise<WorkSite[]> {
  let query = getSupabase().from("work_sites").select("*").order("name");
  if (companyId) query = query.or(companyScope(companyId));
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านสถานที่ปฏิบัติงานไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as WorkSite[];
}

export async function getSiteById(id: string | null): Promise<WorkSite | null> {
  if (!id) return null;
  const { data, error } = await getSupabase().from("work_sites").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านสถานที่ปฏิบัติงานไม่สำเร็จ: ${error.message}`);
  return (data as WorkSite | null) ?? null;
}

export async function upsertSite(input: Omit<WorkSite, "id"> & { id?: string | null }): Promise<WorkSite> {
  const { id, ...rest } = input;
  const supabase = getSupabase();
  const query = id
    ? supabase.from("work_sites").update(rest).eq("id", id)
    : supabase.from("work_sites").insert(rest);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("มีสถานที่ชื่อนี้อยู่แล้วในบริษัทนี้");
    throw new Error(`บันทึกสถานที่ปฏิบัติงานไม่สำเร็จ: ${error.message}`);
  }
  return data as WorkSite;
}

/** ลบสถานที่ — ถ้ายังถูกอ้างในตารางเวร/ภารกิจ ต้องบังคับ (แถวที่อ้างจะกลายเป็น "ไม่ระบุสถานที่") */
export async function deleteSite(id: string, force = false): Promise<{ affected: number }> {
  const supabase = getSupabase();
  const [{ count: rosterCount }, { count: taskCount }] = await Promise.all([
    supabase.from("shift_assignments").select("id", { count: "exact", head: true }).eq("site_id", id),
    supabase.from("field_tasks").select("id", { count: "exact", head: true }).eq("site_id", id),
  ]);
  const used = (rosterCount ?? 0) + (taskCount ?? 0);
  if (used > 0 && !force) {
    throw new Error(
      `ลบไม่ได้ สถานที่นี้ถูกใช้ในตารางเวร ${rosterCount ?? 0} วัน และภารกิจ ${taskCount ?? 0} งาน — ติ๊กยืนยันถ้าต้องการลบจริง`,
    );
  }
  const { error } = await supabase.from("work_sites").delete().eq("id", id);
  if (error) throw new Error(`ลบสถานที่ปฏิบัติงานไม่สำเร็จ: ${error.message}`);
  return { affected: used };
}

// ---------- งานนอกสถานที่: ประเภท ----------

export async function listFieldTaskTypes(companyId?: string | null): Promise<FieldTaskType[]> {
  let query = getSupabase().from("field_task_types").select("*").order("sort_order").order("name");
  if (companyId) query = query.or(companyScope(companyId));
  const { data, error } = await query;
  if (error) throw new Error(`อ่านประเภทงานนอกสถานที่ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as FieldTaskType[];
}

export async function upsertFieldTaskType(input: {
  id?: string | null;
  company_id: string | null;
  name: string;
  counts_hours: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = input.id
    ? await supabase
        .from("field_task_types")
        .update({ name: input.name, counts_hours: input.counts_hours })
        .eq("id", input.id)
    : await supabase.from("field_task_types").insert({
        company_id: input.company_id,
        name: input.name,
        counts_hours: input.counts_hours,
      });
  if (error) {
    if (error.code === "23505") throw new Error("มีประเภทงานชื่อนี้อยู่แล้ว");
    throw new Error(`บันทึกประเภทงานไม่สำเร็จ: ${error.message}`);
  }
}

export async function deleteFieldTaskType(id: string): Promise<void> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("field_tasks")
    .select("id", { count: "exact", head: true })
    .eq("type_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ มีภารกิจ ${count} งานใช้ประเภทนี้อยู่`);
  }
  const { error } = await supabase.from("field_task_types").delete().eq("id", id);
  if (error) throw new Error(`ลบประเภทงานไม่สำเร็จ: ${error.message}`);
}

// ---------- งานนอกสถานที่: ภารกิจ ----------

const FIELD_TASK_COLUMNS = `
  id, company_id, type_id, title, site_id, place_text, work_date, planned_start, planned_end,
  counts_hours, note, created_by, is_cancelled,
  field_task_types(name), work_sites(name),
  field_task_members(employee_id, employees(emp_code, full_name, branch_id)),
  field_punches(*)
`;

function toFieldTask(row: Record<string, unknown>): FieldTask {
  const punches = ((row.field_punches as FieldPunch[] | null) ?? []).map((p) => ({
    ...p,
    is_manual: Boolean(p.is_manual),
  }));
  const memberRows = (row.field_task_members as Record<string, unknown>[] | null) ?? [];

  const members: FieldTaskMember[] = memberRows
    .map((m) => {
      const emp = (Array.isArray(m.employees) ? m.employees[0] : m.employees) as
        | { emp_code?: string; full_name?: string; branch_id?: string | null }
        | null;
      const employeeId = String(m.employee_id);
      return {
        employee_id: employeeId,
        emp_code: emp?.emp_code ?? "",
        full_name: emp?.full_name ?? "",
        branch_id: emp?.branch_id ?? null,
        start: punches.find((p) => p.employee_id === employeeId && p.punch_type === "start") ?? null,
        end: punches.find((p) => p.employee_id === employeeId && p.punch_type === "end") ?? null,
      };
    })
    .sort((a, b) => a.emp_code.localeCompare(b.emp_code));

  return {
    id: String(row.id),
    company_id: (row.company_id as string | null) ?? null,
    type_id: String(row.type_id),
    type_name: relName(row.field_task_types) ?? "-",
    title: String(row.title ?? ""),
    site_id: (row.site_id as string | null) ?? null,
    site_name: relName(row.work_sites),
    place_text: (row.place_text as string | null) ?? null,
    work_date: String(row.work_date),
    planned_start: (row.planned_start as string | null)?.slice(0, 5) ?? null,
    planned_end: (row.planned_end as string | null)?.slice(0, 5) ?? null,
    counts_hours: Boolean(row.counts_hours),
    note: (row.note as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    is_cancelled: Boolean(row.is_cancelled),
    members,
  };
}

export type FieldTaskInput = {
  company_id: string | null;
  type_id: string;
  title: string;
  site_id: string | null;
  place_text: string | null;
  work_date: string;
  planned_start: string | null;
  planned_end: string | null;
  counts_hours: boolean;
  note: string | null;
  created_by?: string | null;
};

export async function getFieldTask(id: string): Promise<FieldTask | null> {
  const { data, error } = await getSupabase()
    .from("field_tasks")
    .select(FIELD_TASK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านภารกิจไม่สำเร็จ: ${error.message}`);
  return data ? toFieldTask(data as unknown as Record<string, unknown>) : null;
}

/** ภารกิจในช่วงวันที่ — กรองบริษัท/สาขา(ของสมาชิก)/พนักงาน/ประเภทได้ */
export async function listFieldTasks(params: {
  from: string;
  to: string;
  companyId?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  typeId?: string | null;
  includeCancelled?: boolean;
}): Promise<FieldTask[]> {
  let query = getSupabase()
    .from("field_tasks")
    .select(FIELD_TASK_COLUMNS)
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .order("work_date")
    .order("planned_start", { nullsFirst: false });
  if (params.companyId) query = query.eq("company_id", params.companyId);
  if (params.typeId) query = query.eq("type_id", params.typeId);
  if (!params.includeCancelled) query = query.eq("is_cancelled", false);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านภารกิจไม่สำเร็จ: ${error.message}`);
  let tasks = (data ?? []).map((r) => toFieldTask(r as unknown as Record<string, unknown>));

  // กรองด้วยสมาชิก (ทำในโค้ด เพราะ PostgREST กรองแถวแม่จากตารางลูกได้ไม่สะดวก)
  if (params.employeeId) {
    tasks = tasks.filter((t) => t.members.some((m) => m.employee_id === params.employeeId));
  }
  if (params.branchId) {
    tasks = tasks.filter((t) => t.members.some((m) => m.branch_id === params.branchId));
  }
  return tasks;
}

/** ภารกิจของพนักงานคนหนึ่ง "วันนี้" + งานที่เริ่มแล้วยังไม่จบจากเมื่อวาน (บูธเลิกดึก) */
export async function listMyFieldTasks(employeeId: string, workDate: string): Promise<FieldTask[]> {
  const tasks = await listFieldTasks({ from: addDays(workDate, -1), to: workDate, employeeId });
  return tasks.filter((t) => {
    if (t.work_date === workDate) return true;
    const me = t.members.find((m) => m.employee_id === employeeId);
    return Boolean(me?.start && !me.end);
  });
}

export async function createFieldTask(input: FieldTaskInput, memberIds: string[]): Promise<FieldTask> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("field_tasks")
    .insert({ ...input, created_by: input.created_by ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`สร้างภารกิจไม่สำเร็จ: ${error.message}`);

  const taskId = String((data as { id: string }).id);
  await setFieldTaskMembers(taskId, memberIds);
  return (await getFieldTask(taskId))!;
}

export async function updateFieldTask(
  id: string,
  input: Omit<FieldTaskInput, "created_by">,
  memberIds: string[],
): Promise<void> {
  const { error } = await getSupabase().from("field_tasks").update(input).eq("id", id);
  if (error) throw new Error(`แก้ไขภารกิจไม่สำเร็จ: ${error.message}`);
  await setFieldTaskMembers(id, memberIds);
}

/** ตั้งรายชื่อสมาชิกให้ตรงกับที่ส่งมา (คนที่ถูกเอาออกและมีการลงเวลาแล้วจะถูกลบการลงเวลาด้วย) */
export async function setFieldTaskMembers(taskId: string, memberIds: string[]): Promise<void> {
  const supabase = getSupabase();
  const unique = [...new Set(memberIds)];

  const { data: existing } = await supabase
    .from("field_task_members")
    .select("employee_id")
    .eq("task_id", taskId);
  const current = new Set((existing ?? []).map((r) => String(r.employee_id)));

  const toAdd = unique.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !unique.includes(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("field_task_members")
      .insert(toAdd.map((employee_id) => ({ task_id: taskId, employee_id })));
    if (error) throw new Error(`เพิ่มสมาชิกภารกิจไม่สำเร็จ: ${error.message}`);
  }
  if (toRemove.length > 0) {
    const { data: punches } = await supabase
      .from("field_punches")
      .select("photo_path")
      .eq("task_id", taskId)
      .in("employee_id", toRemove);
    await removePhotos(
      ((punches ?? []) as { photo_path: string | null }[])
        .map((p) => p.photo_path)
        .filter((p): p is string => Boolean(p)),
    );
    await supabase.from("field_punches").delete().eq("task_id", taskId).in("employee_id", toRemove);
    const { error } = await supabase
      .from("field_task_members")
      .delete()
      .eq("task_id", taskId)
      .in("employee_id", toRemove);
    if (error) throw new Error(`เอาสมาชิกออกไม่สำเร็จ: ${error.message}`);
  }
}

export async function setFieldTaskCancelled(id: string, cancelled: boolean): Promise<void> {
  const { error } = await getSupabase().from("field_tasks").update({ is_cancelled: cancelled }).eq("id", id);
  if (error) throw new Error(`ยกเลิกภารกิจไม่สำเร็จ: ${error.message}`);
}

/** ลบภารกิจพร้อมการลงเวลาและรูปทั้งหมดของภารกิจนั้น */
export async function deleteFieldTask(id: string): Promise<{ photosDeleted: number }> {
  const supabase = getSupabase();
  const { data } = await supabase.from("field_punches").select("photo_path").eq("task_id", id);
  const paths = ((data ?? []) as { photo_path: string | null }[])
    .map((p) => p.photo_path)
    .filter((p): p is string => Boolean(p));
  await removePhotos(paths);

  const { error } = await supabase.from("field_tasks").delete().eq("id", id);
  if (error) throw new Error(`ลบภารกิจไม่สำเร็จ: ${error.message}`);
  return { photosDeleted: paths.length };
}

/** ลบภารกิจทั้งหมดในช่วงวันที่ (หน้าลบข้อมูล) */
export async function deleteFieldTasksRange(params: {
  from: string;
  to: string;
  companyId?: string | null;
}): Promise<{ deleted: number; photosDeleted: number }> {
  const tasks = await listFieldTasks({ ...params, includeCancelled: true });
  let photosDeleted = 0;
  for (const t of tasks) photosDeleted += (await deleteFieldTask(t.id)).photosDeleted;
  return { deleted: tasks.length, photosDeleted };
}

// ---------- งานนอกสถานที่: การลงเวลา (เริ่ม/จบ) ----------

export async function insertFieldPunch(row: {
  task_id: string;
  employee_id: string;
  punch_type: FieldPunchType;
  punched_at: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  device_info: string | null;
  note?: string | null;
  is_manual?: boolean;
  edited_by?: string | null;
}): Promise<FieldPunch> {
  const { data, error } = await getSupabase().from("field_punches").insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("คุณลงเวลาช่วงนี้ของภารกิจนี้ไปแล้ว");
    throw new Error(`บันทึกการลงเวลาภารกิจไม่สำเร็จ: ${error.message}`);
  }
  return data as FieldPunch;
}

/** แอดมินบันทึก/แก้เวลาเริ่ม-จบให้ (ไม่มีรูป ติดธง is_manual) */
export async function upsertManualFieldPunch(params: {
  task_id: string;
  employee_id: string;
  punch_type: FieldPunchType;
  punched_at: string;
  note?: string | null;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("field_punches")
    .upsert(
      {
        task_id: params.task_id,
        employee_id: params.employee_id,
        punch_type: params.punch_type,
        punched_at: params.punched_at,
        note: params.note ?? null,
        is_manual: true,
      },
      { onConflict: "task_id,employee_id,punch_type" },
    );
  if (error) throw new Error(`บันทึกเวลาให้ไม่สำเร็จ: ${error.message}`);
}

export async function deleteFieldPunch(taskId: string, employeeId: string, type: FieldPunchType): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("field_punches")
    .select("photo_path")
    .eq("task_id", taskId)
    .eq("employee_id", employeeId)
    .eq("punch_type", type)
    .maybeSingle();
  const path = (data as { photo_path: string | null } | null)?.photo_path;
  if (path) await removePhotos([path]);

  const { error } = await supabase
    .from("field_punches")
    .delete()
    .eq("task_id", taskId)
    .eq("employee_id", employeeId)
    .eq("punch_type", type);
  if (error) throw new Error(`ลบการลงเวลาภารกิจไม่สำเร็จ: ${error.message}`);
}

// ---------- งานนอกสถานที่: จัดตารางแบบ พนักงาน × วันที่ ----------

/**
 * หา "งานเดียวกัน" ของวันนั้น (ประเภท + สถานที่ + เวลาแผนเริ่มเท่ากัน ยังไม่ยกเลิก)
 * ถ้าไม่มีให้สร้างใหม่ — ตารางบูธจึงรวมคนที่ประจำบูธเดียวกันไว้ในงานเดียว ไม่แตกเป็นงานละคน
 */
export async function findOrCreateFieldTask(input: FieldTaskInput): Promise<FieldTask> {
  let query = getSupabase()
    .from("field_tasks")
    .select("id")
    .eq("work_date", input.work_date)
    .eq("type_id", input.type_id)
    .eq("is_cancelled", false)
    .limit(1);
  query = input.company_id ? query.eq("company_id", input.company_id) : query.is("company_id", null);
  query = input.site_id ? query.eq("site_id", input.site_id) : query.is("site_id", null);
  if (!input.site_id) query = query.eq("place_text", input.place_text ?? "");
  query = input.planned_start ? query.eq("planned_start", input.planned_start) : query.is("planned_start", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`ค้นหาภารกิจไม่สำเร็จ: ${error.message}`);
  if (data) return (await getFieldTask(String((data as { id: string }).id)))!;
  return createFieldTask(input, []);
}

/** เพิ่มสมาชิกเข้าภารกิจ (คนที่อยู่แล้วข้ามไป) */
export async function addFieldTaskMembers(taskId: string, employeeIds: string[]): Promise<number> {
  const unique = [...new Set(employeeIds)];
  if (unique.length === 0) return 0;
  const { data, error } = await getSupabase()
    .from("field_task_members")
    .upsert(
      unique.map((employee_id) => ({ task_id: taskId, employee_id })),
      { onConflict: "task_id,employee_id", ignoreDuplicates: true },
    )
    .select("employee_id");
  if (error) throw new Error(`เพิ่มสมาชิกภารกิจไม่สำเร็จ: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * เอาคนออกจากภารกิจ (ลบการลงเวลาและรูปของคนนั้นในงานนั้นด้วย)
 * ถ้างานไม่เหลือใครแล้ว ลบงานทิ้งเพื่อไม่ให้มีงานว่างค้างในรายงาน
 */
export async function removeFieldTaskMember(taskId: string, employeeId: string): Promise<{ taskDeleted: boolean }> {
  const supabase = getSupabase();
  const { data: punches } = await supabase
    .from("field_punches")
    .select("photo_path")
    .eq("task_id", taskId)
    .eq("employee_id", employeeId);
  await removePhotos(
    ((punches ?? []) as { photo_path: string | null }[]).map((p) => p.photo_path).filter((p): p is string => Boolean(p)),
  );
  await supabase.from("field_punches").delete().eq("task_id", taskId).eq("employee_id", employeeId);
  const { error } = await supabase
    .from("field_task_members")
    .delete()
    .eq("task_id", taskId)
    .eq("employee_id", employeeId);
  if (error) throw new Error(`เอาสมาชิกออกไม่สำเร็จ: ${error.message}`);

  const { count } = await supabase
    .from("field_task_members")
    .select("employee_id", { count: "exact", head: true })
    .eq("task_id", taskId);
  if ((count ?? 0) === 0) {
    await deleteFieldTask(taskId);
    return { taskDeleted: true };
  }
  return { taskDeleted: false };
}

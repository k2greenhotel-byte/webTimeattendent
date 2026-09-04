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
  Holiday,
  OrgSettings,
  Position,
  PunchType,
  ShiftAssignment,
  WorkSchedule,
  WorkSettings,
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

  const [org, schedules] = await Promise.all([
    getOrgSettings(companyId),
    listSchedules(companyId),
  ]);

  const byId = new Map(schedules.map((s) => [s.id, s]));
  const schedule =
    (assignment?.schedule_id ? byId.get(assignment.schedule_id) : undefined) ??
    (branch?.schedule_id ? byId.get(branch.schedule_id) : undefined) ??
    pickDefaultSchedule(schedules, org, companyId);

  return {
    settings: resolveSettings(org, schedule, branch),
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
}> {
  const [orgList, schedules, branchList, assignments] = await Promise.all([
    listOrgSettings(),
    listSchedules(),
    listBranches(false, companyId),
    range ? listAssignments({ from: range.from, to: range.to }) : Promise.resolve([]),
  ]);

  const orgByCompany = new Map(orgList.map((o) => [o.company_id ?? "", o]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const branches = new Map(branchList.map((b) => [b.id, b]));
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
      return resolveSettings(org, schedule, branch);
    },
    isDayOff: (employeeId, workDate) =>
      assignmentByKey.get(`${employeeId}|${workDate}`)?.is_day_off ?? false,
  };
}

// ---------- ตารางเวร (ใครอยู่กะไหน วันไหน) ----------

const ASSIGNMENT_COLUMNS = "id, employee_id, work_date, schedule_id, is_day_off, note, work_schedules(name)";

function toAssignment(row: Record<string, unknown>): ShiftAssignment {
  const rel = row.work_schedules as { name?: string } | { name?: string }[] | null;
  const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    work_date: String(row.work_date),
    schedule_id: (row.schedule_id as string | null) ?? null,
    is_day_off: Boolean(row.is_day_off),
    note: (row.note as string | null) ?? null,
    schedule_name: name ?? null,
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

import "server-only";
import { resolveSettings } from "./attendance";
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
  WorkSchedule,
  WorkSettings,
} from "./types";

const EMPLOYEE_COLUMNS =
  "id, emp_code, full_name, nickname, phone, email, role, is_active, hire_date, branch_id, department_id, position_id";

const DEFAULT_ORG: OrgSettings = {
  id: 1,
  org_name: "บริษัทของฉัน",
  timezone: "Asia/Bangkok",
  require_gps: false,
  radius_m: 200,
  default_schedule_id: null,
};

const FALLBACK_SCHEDULE: WorkSchedule = {
  id: "default",
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

// ---------- ค่าระดับองค์กร ----------

export async function getOrgSettings(): Promise<OrgSettings> {
  const { data, error } = await getSupabase()
    .from("work_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`อ่านการตั้งค่าไม่สำเร็จ: ${error.message}`);
  return data ? ({ ...DEFAULT_ORG, ...data } as OrgSettings) : DEFAULT_ORG;
}

export async function updateOrgSettings(patch: Partial<OrgSettings>): Promise<void> {
  const { error } = await getSupabase()
    .from("work_settings")
    .upsert({ ...patch, id: 1, updated_at: new Date().toISOString() });
  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`);
}

// ---------- กะทำงาน ----------

export async function listSchedules(): Promise<WorkSchedule[]> {
  const { data, error } = await getSupabase().from("work_schedules").select("*").order("name");
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

/** ตั้งกะเริ่มต้น (มีได้กะเดียว) */
export async function setDefaultSchedule(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error: clearError } = await supabase
    .from("work_schedules")
    .update({ is_default: false })
    .neq("id", id);
  if (clearError) throw new Error(`ตั้งกะเริ่มต้นไม่สำเร็จ: ${clearError.message}`);

  const { error } = await supabase.from("work_schedules").update({ is_default: true }).eq("id", id);
  if (error) throw new Error(`ตั้งกะเริ่มต้นไม่สำเร็จ: ${error.message}`);

  await updateOrgSettings({ default_schedule_id: id });
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

  // สาขาที่ใช้กะนี้จะกลับไปใช้กะเริ่มต้นโดยอัตโนมัติ (schedule_id = null)
  const { error } = await supabase.from("work_schedules").delete().eq("id", id);
  if (error) throw new Error(`ลบกะทำงานไม่สำเร็จ: ${error.message}`);
  return { affected: used };
}

/**
 * ค่าที่ใช้คำนวณจริงของสาขาหนึ่ง = ค่าองค์กร + กะของสาขา (ไม่มีก็ใช้กะเริ่มต้น) + พิกัดของสาขา
 */
export async function getResolvedSettings(branchId?: string | null): Promise<WorkSettings> {
  const [org, schedules, branch] = await Promise.all([
    getOrgSettings(),
    listSchedules(),
    getBranchById(branchId ?? null),
  ]);

  const byId = new Map(schedules.map((s) => [s.id, s]));
  const fallback =
    schedules.find((s) => s.is_default) ??
    (org.default_schedule_id ? byId.get(org.default_schedule_id) : undefined) ??
    schedules[0] ??
    FALLBACK_SCHEDULE;
  const schedule = (branch?.schedule_id ? byId.get(branch.schedule_id) : undefined) ?? fallback;

  return resolveSettings(org, schedule, branch);
}

/** ตัวช่วยสำหรับรายงาน: โหลดข้อมูลอ้างอิงครั้งเดียวแล้ว resolve ได้หลายสาขา */
export async function getSettingsResolver(): Promise<{
  org: OrgSettings;
  branches: Map<string, Branch>;
  resolve: (branchId?: string | null) => WorkSettings;
}> {
  const [org, schedules, branchList] = await Promise.all([
    getOrgSettings(),
    listSchedules(),
    listBranches(),
  ]);

  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const branches = new Map(branchList.map((b) => [b.id, b]));
  const fallback =
    schedules.find((s) => s.is_default) ??
    (org.default_schedule_id ? scheduleById.get(org.default_schedule_id) : undefined) ??
    schedules[0] ??
    FALLBACK_SCHEDULE;

  return {
    org,
    branches,
    resolve: (branchId) => {
      const branch = branchId ? (branches.get(branchId) ?? null) : null;
      const schedule =
        (branch?.schedule_id ? scheduleById.get(branch.schedule_id) : undefined) ?? fallback;
      return resolveSettings(org, schedule, branch);
    },
  };
}

// ---------- พนักงาน ----------

export async function listEmployees(
  options: { activeOnly?: boolean; branchId?: string } | boolean = false,
): Promise<Employee[]> {
  const opts = typeof options === "boolean" ? { activeOnly: options } : options;

  let query = getSupabase().from("employees").select(EMPLOYEE_COLUMNS).order("emp_code");
  if (opts.activeOnly) query = query.eq("is_active", true);
  if (opts.branchId) query = query.eq("branch_id", opts.branchId);

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

export async function listBranches(activeOnly = false): Promise<Branch[]> {
  let query = getSupabase().from("branches").select("*").order("code");
  if (activeOnly) query = query.eq("is_active", true);

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

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await getSupabase().from("departments").select("*").order("name");
  if (error) throw new Error(`อ่านรายชื่อแผนกไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Department[];
}

export async function listPositions(): Promise<Position[]> {
  const { data, error } = await getSupabase().from("positions").select("*").order("name");
  if (error) throw new Error(`อ่านรายชื่อตำแหน่งไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Position[];
}

type LookupTable = "departments" | "positions";

const LOOKUP_LABEL: Record<LookupTable, string> = {
  departments: "แผนก",
  positions: "ตำแหน่ง",
};

export async function insertLookup(table: LookupTable, name: string): Promise<void> {
  const { error } = await getSupabase().from(table).insert({ name });
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

export async function getHolidaySet(from: string, to: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (error) throw new Error(`อ่านวันหยุดไม่สำเร็จ: ${error.message}`);
  return new Set((data ?? []).map((r: { holiday_date: string }) => r.holiday_date));
}

export async function listHolidays(from?: string, to?: string): Promise<Holiday[]> {
  let query = getSupabase().from("holidays").select("*").order("holiday_date");
  if (from) query = query.gte("holiday_date", from);
  if (to) query = query.lte("holiday_date", to);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านวันหยุดไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Holiday[];
}

export async function upsertHoliday(holiday: Holiday): Promise<void> {
  const { error } = await getSupabase().from("holidays").upsert(holiday);
  if (error) throw new Error(`บันทึกวันหยุดไม่สำเร็จ: ${error.message}`);
}

export async function deleteHoliday(date: string): Promise<void> {
  const { error } = await getSupabase().from("holidays").delete().eq("holiday_date", date);
  if (error) throw new Error(`ลบวันหยุดไม่สำเร็จ: ${error.message}`);
}

// ---------- การลงเวลา ----------

export async function getDayRows(params: {
  from: string;
  to: string;
  employeeId?: string;
  branchId?: string;
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
};

/** นับจำนวนรายการลงเวลาที่ตรงเงื่อนไข (ใช้แสดงก่อนยืนยันลบ) */
export async function countAttendance(filter: AttendanceFilter): Promise<number> {
  let query = getSupabase()
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .gte("work_date", filter.from)
    .lte("work_date", filter.to);
  if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);
  if (filter.branchId) query = query.eq("branch_id", filter.branchId);

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
  if (filter.branchId) query = query.eq("branch_id", filter.branchId);

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

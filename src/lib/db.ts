import "server-only";
import { getSupabase, PHOTO_BUCKET } from "./supabase-server";
import type {
  AttendanceDayRow,
  AttendanceRecord,
  Branch,
  Employee,
  Holiday,
  PunchType,
  WorkSettings,
} from "./types";

const EMPLOYEE_COLUMNS =
  "id, emp_code, full_name, nickname, department, position, role, is_active, hire_date, branch_id";

const DEFAULT_SETTINGS: WorkSettings = {
  id: 1,
  org_name: "บริษัทของฉัน",
  work_start: "08:00",
  work_end: "17:00",
  break_start: "12:00",
  break_end: "13:00",
  break_allow_minutes: 60,
  break_policy: "actual",
  late_grace_min: 5,
  early_leave_grace_min: 5,
  count_ot: true,
  ot_grace_min: 30,
  workdays: [1, 2, 3, 4, 5, 6],
  require_gps: false,
  site_lat: null,
  site_lng: null,
  radius_m: 200,
  timezone: "Asia/Bangkok",
};

export async function getWorkSettings(): Promise<WorkSettings> {
  const { data, error } = await getSupabase()
    .from("work_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`อ่านการตั้งค่าไม่สำเร็จ: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    work_start: String(data.work_start).slice(0, 5),
    work_end: String(data.work_end).slice(0, 5),
    break_start: String(data.break_start).slice(0, 5),
    break_end: String(data.break_end).slice(0, 5),
  } as WorkSettings;
}

export async function updateWorkSettings(patch: Partial<WorkSettings>): Promise<void> {
  const { error } = await getSupabase()
    .from("work_settings")
    .upsert({ ...patch, id: 1, updated_at: new Date().toISOString() });
  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`);
}

export async function listEmployees(
  options: { activeOnly?: boolean; branchId?: string } | boolean = false,
): Promise<Employee[]> {
  const opts = typeof options === "boolean" ? { activeOnly: options } : options;

  let query = getSupabase().from("employees").select(EMPLOYEE_COLUMNS).order("emp_code");
  if (opts.activeOnly) query = query.eq("is_active", true);
  if (opts.branchId) query = query.eq("branch_id", opts.branchId);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อพนักงานไม่สำเร็จ: ${error.message}`);

  const branches = await listBranches();
  const nameOf = new Map(branches.map((b) => [b.id, b.name]));
  return (data ?? []).map((e) => ({
    ...(e as Employee),
    branch_name: e.branch_id ? (nameOf.get(e.branch_id) ?? null) : null,
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

// ---------- สาขา ----------

export async function listBranches(activeOnly = false): Promise<Branch[]> {
  let query = getSupabase().from("branches").select("*").order("code");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อสาขาไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((b) => ({
    ...(b as Branch),
    work_start: b.work_start ? String(b.work_start).slice(0, 5) : null,
    work_end: b.work_end ? String(b.work_end).slice(0, 5) : null,
  }));
}

export async function getBranchById(id: string | null): Promise<Branch | null> {
  if (!id) return null;
  const branches = await listBranches();
  return branches.find((b) => b.id === id) ?? null;
}

export async function updateBranch(id: string, patch: Partial<Branch>): Promise<void> {
  const { error } = await getSupabase().from("branches").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสสาขานี้ถูกใช้แล้ว" : `บันทึกสาขาไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function insertBranch(row: Omit<Branch, "id">) {
  const { error } = await getSupabase().from("branches").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสสาขานี้ถูกใช้แล้ว" : `เพิ่มสาขาไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function deleteBranch(id: string): Promise<void> {
  const { count, error: countError } = await getSupabase()
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", id);
  if (countError) throw new Error(`ตรวจสอบพนักงานในสาขาไม่สำเร็จ: ${countError.message}`);
  if ((count ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ ยังมีพนักงาน ${count} คนอยู่ในสาขานี้ — ย้ายพนักงานออกก่อน`);
  }

  const { error } = await getSupabase().from("branches").delete().eq("id", id);
  if (error) throw new Error(`ลบสาขาไม่สำเร็จ: ${error.message}`);
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await getSupabase().from("employees").delete().eq("id", id);
  if (error) throw new Error(`ลบพนักงานไม่สำเร็จ: ${error.message}`);
}

// ---------- วันหยุด ----------

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

export async function getHolidaySet(from: string, to: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (error) throw new Error(`อ่านวันหยุดไม่สำเร็จ: ${error.message}`);
  return new Set((data ?? []).map((r: { holiday_date: string }) => r.holiday_date));
}

/** แถวสรุปรายวัน (จาก view) ตามช่วงวันที่ / พนักงาน */
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
  const { error } = await getSupabase().from("attendance_records").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการไม่สำเร็จ: ${error.message}`);
}

/** อัปโหลดรูปเข้า bucket (private) */
export async function uploadPhoto(path: string, bytes: ArrayBuffer): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
}

/** สร้าง signed URL อายุสั้นสำหรับดูรูป */
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

export async function signedPhotoUrls(
  paths: (string | null)[],
  expiresInSec = 600,
): Promise<(string | null)[]> {
  return Promise.all(paths.map((p) => signedPhotoUrl(p, expiresInSec)));
}

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

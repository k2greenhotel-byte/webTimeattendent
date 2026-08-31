export type UserRole = "employee" | "admin";

export type PunchType = "check_in" | "break_out" | "break_in" | "check_out";

export const PUNCH_ORDER: PunchType[] = ["check_in", "break_out", "break_in", "check_out"];

export const PUNCH_LABEL: Record<PunchType, string> = {
  check_in: "เข้างานเช้า",
  break_out: "ออกพักเที่ยง",
  break_in: "เข้างานบ่าย",
  check_out: "เลิกงาน",
};

export const PUNCH_SHORT_LABEL: Record<PunchType, string> = {
  check_in: "เข้าเช้า",
  break_out: "ออกพัก",
  break_in: "เข้าบ่าย",
  check_out: "ออกงาน",
};

export type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  /** ถ้าเป็น null = ใช้ค่ากลางจาก work_settings */
  work_start: string | null;
  work_end: string | null;
  site_lat: number | null;
  site_lng: number | null;
  radius_m: number | null;
  is_active: boolean;
};

export type Employee = {
  id: string;
  emp_code: string;
  full_name: string;
  nickname: string | null;
  department: string | null;
  position: string | null;
  role: UserRole;
  is_active: boolean;
  hire_date: string | null;
  branch_id: string | null;
  branch_name?: string | null;
  failed_attempts?: number;
  locked_until?: string | null;
};

export type WorkSettings = {
  id: number;
  org_name: string;
  work_start: string;
  work_end: string;
  break_start: string;
  break_end: string;
  break_allow_minutes: number;
  break_policy: "actual" | "fixed";
  late_grace_min: number;
  early_leave_grace_min: number;
  count_ot: boolean;
  ot_grace_min: number;
  workdays: number[];
  require_gps: boolean;
  site_lat: number | null;
  site_lng: number | null;
  radius_m: number;
  timezone: string;
};

export type AttendanceRecord = {
  id: string;
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
  note: string | null;
  is_manual: boolean;
  edited_by: string | null;
};

/** แถวรวม 4 punch ของวันเดียว (ตรงกับ view v_attendance_days) */
export type AttendanceDayRow = {
  employee_id: string;
  emp_code: string;
  full_name: string;
  department: string | null;
  work_date: string;
  check_in_at: string | null;
  break_out_at: string | null;
  break_in_at: string | null;
  check_out_at: string | null;
  check_in_photo: string | null;
  break_out_photo: string | null;
  break_in_photo: string | null;
  check_out_photo: string | null;
  punch_count: number;
  has_manual: boolean;
  branch_id: string | null;
  branch_code: string | null;
  branch_name: string | null;
};

export type DayStatus = "complete" | "incomplete" | "absent" | "holiday";

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  complete: "ครบ",
  incomplete: "ลงไม่ครบ",
  absent: "ขาดงาน",
  holiday: "วันหยุด",
};

export type DaySummary = {
  workDate: string;
  status: DayStatus;
  checkInAt: string | null;
  breakOutAt: string | null;
  breakInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  breakMinutes: number;
  overBreakMinutes: number;
  workMinutes: number;
  otMinutes: number;
  missing: PunchType[];
  flags: string[];
};

export type SessionUser = {
  id: string;
  emp_code: string;
  full_name: string;
  role: UserRole;
};

export type Holiday = {
  holiday_date: string;
  name: string;
};

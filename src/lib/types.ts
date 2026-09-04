import type { AccessLevel } from "./core-types";

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

/**
 * ตารางกะทำงาน — เวลาเข้า/ออกพัก/เข้าบ่าย/เลิกงาน เก็บที่นี่ที่เดียว
 * company_id = null หมายถึงกะกลางที่ทุกบริษัทใช้ร่วมกันได้
 */
export type WorkSchedule = {
  id: string;
  company_id: string | null;
  name: string;
  work_start: string;
  break_start: string;
  break_end: string;
  work_end: string;
  break_allow_minutes: number;
  break_policy: "actual" | "fixed";
  late_grace_min: number;
  early_leave_grace_min: number;
  count_ot: boolean;
  ot_grace_min: number;
  workdays: number[];
  is_default: boolean;
};

export type Branch = {
  id: string;
  code: string;
  name: string;
  /** บริษัทที่สาขานี้สังกัด (null = ยังไม่ระบุบริษัท) */
  company_id: string | null;
  address: string | null;
  phone: string | null;
  site_lat: number | null;
  site_lng: number | null;
  /** null = ใช้รัศมีเริ่มต้นขององค์กร */
  radius_m: number | null;
  /** null = ใช้กะเริ่มต้น */
  schedule_id: string | null;
  is_active: boolean;
};

/** แผนก/ตำแหน่ง — company_id = null คือของกลางที่ทุกบริษัทใช้ได้ */
export type Department = { id: string; company_id: string | null; name: string };
export type Position = { id: string; company_id: string | null; name: string };

/** ค่าตั้งต้นของระบบลงเวลา — หนึ่งชุดต่อหนึ่งบริษัท */
export type OrgSettings = {
  company_id: string | null;
  org_name: string;
  timezone: string;
  require_gps: boolean;
  radius_m: number;
  default_schedule_id: string | null;
};

export type Employee = {
  id: string;
  emp_code: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  hire_date: string | null;
  branch_id: string | null;
  department_id: string | null;
  position_id: string | null;
  /** ชื่อที่ resolve มาจากตารางอ้างอิง (ไม่ได้เก็บซ้ำในฐานข้อมูล) */
  branch_name?: string | null;
  department_name?: string | null;
  position_name?: string | null;
  failed_attempts?: number;
  locked_until?: string | null;
};

/** ค่าที่ resolve แล้วสำหรับใช้คำนวณ (องค์กร + กะ + สาขา) — ไม่ใช่ตารางในฐานข้อมูล */
export type WorkSettings = {
  company_id: string | null;
  org_name: string;
  schedule_name: string;
  /** กะข้ามเที่ยงคืน (เช่น 22:00–07:00) เวลาเลิกงานคือวันถัดไป */
  crosses_midnight: boolean;
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

/** off = วันหยุดตามตารางเวร (ไม่ใช่วันหยุดนักขัตฤกษ์) ไม่นับเป็นขาดงาน */
export type DayStatus = "complete" | "incomplete" | "absent" | "holiday" | "off";

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  complete: "ครบ",
  incomplete: "ลงไม่ครบ",
  absent: "ขาดงาน",
  holiday: "วันหยุด",
  off: "หยุดเวร",
};

/** ตารางเวร: พนักงานคนหนึ่ง วันหนึ่ง ใช้กะไหน (หรือหยุดเวร) */
export type ShiftAssignment = {
  id: string;
  employee_id: string;
  work_date: string;
  schedule_id: string | null;
  is_day_off: boolean;
  note: string | null;
  /** ชื่อกะที่ resolve มาให้แสดงผล (ไม่ได้เก็บซ้ำในตาราง) */
  schedule_name?: string | null;
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
  /** กลุ่มระดับการทำงาน — ตัวตัดสินสิทธิ์เริ่มต้นของทุกเมนู */
  level: AccessLevel;
  /** บริษัท/สาขาที่เลือกเข้าทำงานรอบนี้ (เลือกตอนล็อกอิน เปลี่ยนได้ที่ /select-context) */
  company_id?: string | null;
  company_name?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
};

export type Holiday = {
  holiday_date: string;
  name: string;
  /** null = วันหยุดกลางที่ใช้ทุกบริษัท */
  company_id?: string | null;
};

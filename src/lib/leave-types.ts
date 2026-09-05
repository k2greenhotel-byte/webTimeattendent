/** ชนิดข้อมูลของระบบขอลา / ขอเบิกเงินเดือน (โปรแกรม HR) */

// ---------- สถานะใบแจ้งลา ----------

export type LeaveStatus = "pending" | "need_docs" | "approved" | "rejected" | "cancelled";

/** สถานะที่ผู้อนุมัติเลือกได้จากหน้าจออนุมัติ (ตามข้อ 7 ของสเปก) */
export const LEAVE_DECISION_ORDER: LeaveStatus[] = ["approved", "need_docs", "rejected"];

export const LEAVE_STATUS_ORDER: LeaveStatus[] = [
  "pending",
  "need_docs",
  "approved",
  "rejected",
  "cancelled",
];

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "รออนุมัติ",
  need_docs: "อนุมัติแต่ขอหลักฐานเพิ่ม",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export const LEAVE_STATUS_HINT: Record<LeaveStatus, string> = {
  pending: "ยังไม่มีผู้อนุมัติพิจารณา",
  need_docs: "อนุมัติให้ก่อน แต่ผู้แจ้งต้องส่งหลักฐานเพิ่มตามที่ระบุในหมายเหตุ",
  approved: "อนุมัติตามที่แจ้ง",
  rejected: "ไม่อนุมัติ — ต้องเลือกเหตุผล",
  cancelled: "ผู้แจ้งยกเลิกใบนี้เอง",
};

export const LEAVE_STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  need_docs: "bg-sky-50 text-sky-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

// ---------- สถานะใบขอเบิกเงิน ----------

export type AdvanceStatus = "pending" | "partial" | "approved" | "rejected" | "cancelled";

/** สถานะที่ผู้อนุมัติเลือกได้จากหน้าจออนุมัติ (ตามสเปกหน้าจออนุมัติขอเบิกเงิน) */
export const ADVANCE_DECISION_ORDER: AdvanceStatus[] = ["approved", "partial", "rejected"];

export const ADVANCE_STATUS_ORDER: AdvanceStatus[] = [
  "pending",
  "partial",
  "approved",
  "rejected",
  "cancelled",
];

export const ADVANCE_STATUS_LABEL: Record<AdvanceStatus, string> = {
  pending: "รออนุมัติ",
  partial: "อนุมัติบางส่วน",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export const ADVANCE_STATUS_HINT: Record<AdvanceStatus, string> = {
  pending: "ยังไม่มีผู้อนุมัติพิจารณา",
  partial: "อนุมัติให้เบิกน้อยกว่าที่ขอ — ต้องระบุยอดที่อนุมัติ",
  approved: "อนุมัติเต็มจำนวนที่ขอ",
  rejected: "ไม่อนุมัติ — ต้องเลือกเหตุผล",
  cancelled: "ผู้ขอยกเลิกใบนี้เอง",
};

export const ADVANCE_STATUS_CLASS: Record<AdvanceStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  partial: "bg-teal-50 text-teal-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

/** ใบที่ยังรอผู้อนุมัติพิจารณาอยู่ */
export function isLeaveOpen(status: LeaveStatus): boolean {
  return status === "pending";
}

export function isAdvanceOpen(status: AdvanceStatus): boolean {
  return status === "pending";
}

// ---------- ประเภทการลา + เงื่อนไขการใช้สิทธิ์ ----------

export type LeaveType = {
  id: string;
  code: string;
  name: string;
  /** คำอธิบายสิทธิ์ (แก้ไขได้จากหน้าตั้งค่า) */
  description: string | null;
  /** เงื่อนไขการใช้สิทธิ์ แสดงให้พนักงานอ่านตอนยื่น (แก้ไขได้จากหน้าตั้งค่า) */
  conditions: string | null;
  /** ต้องแจ้งล่วงหน้ากี่วัน (0 = แจ้งวันเดียวกันได้) */
  advance_days: number;
  /** แจ้งล่วงหน้าไม่ครบแล้วถือเป็นขาดงาน */
  late_becomes_absent: boolean;
  /** อายุงานขั้นต่ำ (เดือน) — 12 = ต้องทำงานครบ 1 ปี */
  min_service_months: number;
  require_medical_cert: boolean;
  cert_within_days: number;
  /** ต้องแจ้งก่อนเวลานี้ของวันที่เริ่ม (null = ไม่มีเวลาตัด) */
  same_day_cutoff: string | null;
  /** แจ้งหลังเวลาตัดแล้วหักเงินกี่เท่าของค่าจ้าง */
  late_penalty_multiplier: number;
  /** โควตาต่อปี (null = ไม่จำกัด) ใช้เตือน ไม่บล็อก */
  max_days_per_year: number | null;
  needs_date_range: boolean;
  needs_arrival_time: boolean;
  is_paid: boolean;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

// ---------- ใบแจ้งลา ----------

export type LeaveRequest = {
  id: string;
  doc_no: string;
  request_date: string;
  reported_at: string;
  employee_id: string | null;
  employee_name: string;
  company_id: string | null;
  branch_id: string | null;
  type_id: string;
  detail: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  arrival_time: string | null;
  status: LeaveStatus;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  reason_id: string | null;
  notice_days: number;
  service_months: number | null;
  counts_as_absent: boolean;
  is_late_notice: boolean;
  penalty_multiplier: number;
  cert_due_date: string | null;
  cert_received: boolean;
  created_at: string;
};

/** แถวจาก view v_hr_leave_requests (join ชื่อประเภท/บริษัท/สาขา/เหตุผล มาให้แล้ว) */
export type LeaveRequestRow = LeaveRequest & {
  type_code: string;
  type_name: string;
  type_icon: string | null;
  is_paid: boolean;
  require_medical_cert: boolean;
  needs_arrival_time: boolean;
  company_name: string | null;
  branch_name: string | null;
  branch_code: string | null;
  reason_name: string | null;
  file_count: number;
  cert_count: number;
};

export type LeaveFileKind = "attach" | "cert";

export const LEAVE_FILE_KIND_LABEL: Record<LeaveFileKind, string> = {
  attach: "เอกสารประกอบ",
  cert: "ใบรับรองแพทย์",
};

export type LeaveFile = {
  id: string;
  request_id: string;
  kind: LeaveFileKind;
  file_path: string;
  file_name: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

// ---------- ใบขอเบิกเงินเดือน ----------

export type AdvanceRequest = {
  id: string;
  doc_no: string;
  request_date: string;
  requested_at: string;
  purpose: string;
  detail: string | null;
  employee_id: string | null;
  employee_name: string;
  company_id: string | null;
  branch_id: string | null;
  amount: number;
  approved_amount: number;
  status: AdvanceStatus;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  reason_id: string | null;
  created_at: string;
};

export type AdvanceRequestRow = AdvanceRequest & {
  company_name: string | null;
  branch_name: string | null;
  branch_code: string | null;
  reason_name: string | null;
};

/** ชนิดไฟล์ที่รับได้ในใบแจ้งลา (รูปถ่ายใบรับรองแพทย์ หรือไฟล์ PDF) */
export const HR_FILE_ACCEPT = "image/*,application/pdf";

export const MAX_LEAVE_FILES = 6;

/** ชนิดข้อมูลของโมดูลกิจกรรมการตลาด — ตรงกับตาราง mkt_* ในฐานข้อมูล */

/** สถานะการใช้งานของเอกสาร (ข้อ 1.12 / 2.6 / 3.5) */
export type MktActiveStatus = "active" | "cancelled";

/** สถานะขั้นตอนการเบิก (ข้อ 1.13 / 2.7 / 3.6) */
export type MktFlowStatus = "draft" | "submitted" | "received";

export const ACTIVE_STATUS_LABEL: Record<MktActiveStatus, string> = {
  active: "ใช้งาน",
  cancelled: "ยกเลิก",
};

export const FLOW_STATUS_LABEL: Record<MktFlowStatus, string> = {
  draft: "ทำเรื่องตั้งเบิก",
  submitted: "ส่งเบิกแล้ว",
  received: "รับเงินแล้ว",
};

export const FLOW_STATUS_ORDER: MktFlowStatus[] = ["draft", "submitted", "received"];

/** สีของป้ายสถานะ (ใช้ร่วมกันทุกหน้า จะได้ไม่เพี้ยน) */
export const FLOW_STATUS_CLASS: Record<MktFlowStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-sky-100 text-sky-700",
  received: "bg-emerald-100 text-emerald-700",
};

export type MktCompany = { id: string; code: string; name: string; is_active: boolean };
export type MktActivityType = { id: string; code: string; name: string; is_active: boolean };

/** ตัวเลือกใน dropdown ของข้อมูลหลัก (โครงเดียวกันทั้ง 3 ประเภท) */
export type MktOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  /** เฉพาะพนักงาน: บัญชีเข้าระบบที่ผูกไว้ (null = ยังไม่ได้ผูก) */
  employee_id?: string | null;
};

export type MktStaff = MktOption & { employee_id: string | null };

export type MktPhoto = { id: string; path: string; sort_order: number };

/** ใบกิจกรรม (หน้าจอ 1) */
export type MktActivity = {
  id: string;
  doc_no: string;
  activity_date: string;
  title: string;
  activity_type_id: string | null;
  company_id: string | null;
  created_by_staff_id: string | null;
  memo: string | null;
  request_amount: number;
  approved_amount: number | null;
  active_status: MktActiveStatus;
  flow_status: MktFlowStatus;
};

/** บันทึกส่งเรื่องเบิกเงิน (หน้าจอ 2) */
export type MktSubmission = {
  id: string;
  activity_id: string;
  submitted_by_staff_id: string | null;
  submit_date: string;
  postal_no: string | null;
  letter_photo_path: string | null;
  ack_photo_path: string | null;
  active_status: MktActiveStatus;
};

/** บันทึกรับเงิน (หน้าจอ 3) */
export type MktReceipt = {
  id: string;
  activity_id: string;
  received_by_staff_id: string | null;
  receive_date: string;
  receipt_no: string | null;
  received_amount: number;
  active_status: MktActiveStatus;
};

/** แถวรวมจาก view v_mkt_activities — ใช้ในหน้ารายการ สอบถาม และ dashboard */
export type MktActivityRow = {
  id: string;
  doc_no: string;
  activity_date: string;
  title: string;
  memo: string | null;
  request_amount: number;
  approved_amount: number | null;
  active_status: MktActiveStatus;
  flow_status: MktFlowStatus;
  activity_type_id: string | null;
  activity_type_name: string | null;
  company_id: string | null;
  company_name: string | null;
  created_by_staff_id: string | null;
  created_by_name: string | null;
  submission_id: string | null;
  submit_date: string | null;
  postal_no: string | null;
  letter_photo_path: string | null;
  ack_photo_path: string | null;
  submission_status: MktActiveStatus | null;
  submitted_by_name: string | null;
  receipt_id: string | null;
  receive_date: string | null;
  receipt_no: string | null;
  received_amount: number | null;
  receipt_status: MktActiveStatus | null;
  received_by_name: string | null;
};

/** เงื่อนไขการค้นหาของหน้าสอบถาม (ข้อ 5) */
export type MktQuery = {
  flow_status?: MktFlowStatus | "";
  active_status?: MktActiveStatus | "";
  company_id?: string;
  activity_type_id?: string;
  staff_id?: string;
  from?: string;
  to?: string;
  keyword?: string;
};

export const MAX_ACTIVITY_PHOTOS = 10;

// ==================== Memo (หน้าจอ 7 และ 8) ====================

/** สถานะของ Memo ตามความคืบหน้าของการเบิกเงินทั้งโครงการ */
export type MktMemoStatus =
  | "not_requested"
  | "partial_requested"
  | "partial_received"
  | "fully_received"
  | "closed";

export const MEMO_STATUS_LABEL: Record<MktMemoStatus, string> = {
  not_requested: "ยังไม่ได้ตั้งเบิก",
  partial_requested: "ทำเรื่องตั้งเบิกแล้วบางส่วน",
  partial_received: "ได้รับเงินบางส่วน",
  fully_received: "ได้รับครบแล้ว",
  closed: "จบโครงการแล้ว",
};

/** เรียงตามความคืบหน้า ใช้กับ dropdown และ dashboard ให้ลำดับตรงกันทุกที่ */
export const MEMO_STATUS_ORDER: MktMemoStatus[] = [
  "not_requested",
  "partial_requested",
  "partial_received",
  "fully_received",
  "closed",
];

export const MEMO_STATUS_CLASS: Record<MktMemoStatus, string> = {
  not_requested: "bg-slate-100 text-slate-600",
  partial_requested: "bg-amber-100 text-amber-700",
  partial_received: "bg-sky-100 text-sky-700",
  fully_received: "bg-emerald-100 text-emerald-700",
  closed: "bg-violet-100 text-violet-700",
};

export type MktMemo = {
  id: string;
  doc_no: string;
  memo_date: string;
  company_id: string | null;
  detail: string | null;
  period_from: string | null;
  period_to: string | null;
  created_by_staff_id: string | null;
  status: MktMemoStatus;
  active_status: MktActiveStatus;
};

/** ไฟล์แนบของ Memo — รับได้ทั้งเอกสารและรูปภาพ */
export type MktMemoFile = {
  id: string;
  path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  sort_order: number;
};

export type MktMemoStatusLog = {
  id: string;
  memo_id: string;
  status: MktMemoStatus;
  changed_on: string;
  changed_by_staff_id: string | null;
  changed_by_name?: string | null;
  note: string | null;
  created_at: string;
};

/** แถวรวมจาก view v_mkt_memos */
export type MktMemoRow = {
  id: string;
  doc_no: string;
  memo_date: string;
  detail: string | null;
  period_from: string | null;
  period_to: string | null;
  status: MktMemoStatus;
  active_status: MktActiveStatus;
  company_id: string | null;
  company_name: string | null;
  created_by_staff_id: string | null;
  created_by_name: string | null;
  file_count: number;
  status_log_count: number;
  last_status_changed_on: string | null;
};

export type MktMemoQuery = {
  status?: MktMemoStatus | "";
  active_status?: MktActiveStatus | "";
  company_id?: string;
  staff_id?: string;
  from?: string;
  to?: string;
  keyword?: string;
};

export const MAX_MEMO_FILES = 20;

/** ชนิดไฟล์แนบที่รับ — เอกสารสำนักงานและรูปภาพ */
export const MEMO_FILE_ACCEPT =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

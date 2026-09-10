/**
 * ชนิดข้อมูลของระบบตรวจสอบบัญชี — ตรงกับตาราง aud_* (migration 0061)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- ชนิดของรายการตรวจ ----------

/** แหล่งข้อมูลของรายการตรวจหนึ่งชนิด */
export type AudCheckKind = "sale" | "payment" | "cash" | "custom";

export const AUD_KIND_ORDER: AudCheckKind[] = ["sale", "payment", "cash", "custom"];

export const AUD_KIND_LABEL: Record<AudCheckKind, string> = {
  sale: "ใบสั่งขาย (ดึงจากระบบขาย)",
  payment: "ใบเบิกเงินสดย่อย (ดึงจากระบบขอซ่อมขอซื้อ)",
  cash: "กระทบยอดเงินสด / นำฝากธนาคาร",
  custom: "รายการที่กำหนดเอง",
};

export const AUD_KIND_SHORT: Record<AudCheckKind, string> = {
  sale: "ใบสั่งขาย",
  payment: "เงินสดย่อย",
  cash: "กระทบยอดเงินสด",
  custom: "กำหนดเอง",
};

export const AUD_KIND_HINT: Record<AudCheckKind, string> = {
  sale: "กดปุ่มดึงรายการขายตามวันที่/สาขา จากระบบขาย (Db2) เข้ามาตรวจทีละใบ",
  payment: "กดปุ่มดึงใบเบิกเงินสดย่อยตามวันที่/สาขา จากระบบขอซ่อมขอซื้อเข้ามาตรวจ",
  cash: "กรอกผลกระทบยอดรับจ่ายและสลิปนำฝากเงินเอง (ไม่ดึงจากระบบอื่น)",
  custom: "กรอกรายการที่ต้องการตรวจเอง — ใช้กับรายการตรวจที่เพิ่มขึ้นใหม่",
};

/** ชนิดที่ผู้ใช้เลือกได้ตอนเพิ่มรายการตรวจของตัวเอง (ข้อ 4) */
export const AUD_USER_KINDS: AudCheckKind[] = ["custom", "cash"];

// ---------- สถานะใบคุมงาน ----------

export type AudStatus = "draft" | "submitted" | "cancelled";

export const AUD_STATUS_ORDER: AudStatus[] = ["draft", "submitted", "cancelled"];

export const AUD_STATUS_LABEL: Record<AudStatus, string> = {
  draft: "กำลังตรวจ",
  submitted: "ส่งผลแล้ว",
  cancelled: "ยกเลิก",
};

export const AUD_STATUS_CLASS: Record<AudStatus, string> = {
  draft: "bg-slate-200 text-slate-600",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

// ---------- ผลการตรวจรายช่อง ----------

export type AudResult = "pending" | "correct" | "wrong";

export const AUD_RESULT_ORDER: AudResult[] = ["pending", "correct", "wrong"];

export const AUD_RESULT_LABEL: Record<AudResult, string> = {
  pending: "ยังไม่ตรวจ",
  correct: "ถูกต้อง",
  wrong: "ไม่ถูกต้อง",
};

export const AUD_RESULT_CLASS: Record<AudResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  correct: "bg-emerald-100 text-emerald-700",
  wrong: "bg-rose-100 text-rose-700",
};

export type AudDocResult = "pending" | "complete" | "incomplete";

export const AUD_DOC_RESULT_ORDER: AudDocResult[] = ["pending", "complete", "incomplete"];

export const AUD_DOC_RESULT_LABEL: Record<AudDocResult, string> = {
  pending: "ยังไม่ตรวจ",
  complete: "เอกสารครบ",
  incomplete: "เอกสารไม่ครบ",
};

export const AUD_DOC_RESULT_CLASS: Record<AudDocResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  complete: "bg-emerald-100 text-emerald-700",
  incomplete: "bg-amber-100 text-amber-700",
};

export type AudCallResult = "pending" | "contacted" | "no_contact";

export const AUD_CALL_RESULT_ORDER: AudCallResult[] = ["pending", "contacted", "no_contact"];

export const AUD_CALL_RESULT_LABEL: Record<AudCallResult, string> = {
  pending: "ยังไม่ได้โทร",
  contacted: "ติดต่อได้",
  no_contact: "ติดต่อไม่ได้",
};

export const AUD_CALL_RESULT_CLASS: Record<AudCallResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  contacted: "bg-emerald-100 text-emerald-700",
  no_contact: "bg-slate-500 text-white",
};

/**
 * ผลของข้อมูลที่ได้จากการโทร
 * สีตามที่ผู้ใช้กำหนด: ผิดปกติ = แดง · สาขาสื่อสารผิด = เหลือง
 */
export type AudInfoResult = "pending" | "match" | "abnormal" | "branch_error";

export const AUD_INFO_RESULT_ORDER: AudInfoResult[] = [
  "pending",
  "match",
  "abnormal",
  "branch_error",
];

export const AUD_INFO_RESULT_LABEL: Record<AudInfoResult, string> = {
  pending: "ยังไม่สรุป",
  match: "ข้อมูลตรง",
  abnormal: "ข้อมูลไม่ตรง — มีความผิดปกติ",
  branch_error: "ข้อมูลไม่ตรง — สาขาสื่อสารผิด",
};

export const AUD_INFO_RESULT_SHORT: Record<AudInfoResult, string> = {
  pending: "ยังไม่สรุป",
  match: "ข้อมูลตรง",
  abnormal: "ผิดปกติ",
  branch_error: "สาขาสื่อสารผิด",
};

export const AUD_INFO_RESULT_CLASS: Record<AudInfoResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  match: "bg-emerald-100 text-emerald-700",
  abnormal: "bg-rose-600 text-white",
  branch_error: "bg-amber-400 text-amber-950",
};

/** สีพื้นของทั้งแถวเมื่อผลการโทรผิดปกติ — ใช้ในตารางรายงานและหน้าบันทึก */
export const AUD_INFO_ROW_CLASS: Record<AudInfoResult, string> = {
  pending: "",
  match: "",
  abnormal: "bg-rose-50",
  branch_error: "bg-amber-50",
};

export type AudSlipResult = "pending" | "has" | "none";

export const AUD_SLIP_RESULT_ORDER: AudSlipResult[] = ["pending", "has", "none"];

export const AUD_SLIP_RESULT_LABEL: Record<AudSlipResult, string> = {
  pending: "ยังไม่ตรวจ",
  has: "มีสลิปนำฝาก",
  none: "ไม่มีสลิปนำฝาก",
};

export const AUD_SLIP_RESULT_CLASS: Record<AudSlipResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  has: "bg-emerald-100 text-emerald-700",
  none: "bg-rose-100 text-rose-700",
};

export type AudAmountResult = "pending" | "correct" | "wrong";

export const AUD_AMOUNT_RESULT_ORDER: AudAmountResult[] = ["pending", "correct", "wrong"];

export const AUD_AMOUNT_RESULT_LABEL: Record<AudAmountResult, string> = {
  pending: "ยังไม่ตรวจ",
  correct: "ยอดเงินถูกต้อง",
  wrong: "ยอดเงินไม่ถูกต้อง",
};

export const AUD_AMOUNT_RESULT_CLASS: Record<AudAmountResult, string> = {
  pending: "bg-slate-200 text-slate-600",
  correct: "bg-emerald-100 text-emerald-700",
  wrong: "bg-rose-100 text-rose-700",
};

// ---------- ข้อมูลตั้งค่า ----------

export type AudDocType = {
  id: string;
  code: string;
  name: string;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type AudDocTypeInput = Omit<AudDocType, "id">;

export type AudCheckType = {
  id: string;
  code: string;
  name: string;
  kind: AudCheckKind;
  description: string | null;
  has_docs: boolean;
  has_call: boolean;
  has_slip: boolean;
  has_amount: boolean;
  ref_label: string;
  title_label: string;
  party_label: string;
  is_builtin: boolean;
  sort_order: number;
  is_active: boolean;
};

export type AudCheckTypeInput = Omit<AudCheckType, "id" | "is_builtin">;

/** รายการตรวจพร้อมจำนวนครั้งที่ถูกใช้ไปแล้ว — ใช้เตือนก่อนลบ */
export type AudCheckTypeRow = AudCheckType & { use_count: number };

// ---------- ใบคุมงาน ----------

export type AudAudit = {
  id: string;
  doc_no: string;
  audit_date: string;
  auditor_id: string | null;
  auditor_name: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  status: AudStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบคุมงานพร้อมยอดสรุป (มาจาก view v_aud_audits) */
export type AudAuditRow = AudAudit & {
  company_ref_name: string | null;
  branch_ref_name: string | null;
  branch_code: string | null;
  auditor_full_name: string | null;
  check_count: number;
  wrong_count: number;
  incomplete_count: number;
  no_contact_count: number;
  mismatch_count: number;
  pending_count: number;
};

export type AudAuditInput = {
  audit_date: string;
  auditor_id: string | null;
  auditor_name: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  status: AudStatus;
  note: string | null;
};

// ---------- รายการที่ตรวจ ----------

/** รายละเอียดเพิ่มเติมจากต้นทาง — คีย์ที่ใช้จริงต่างกันตาม kind */
export type AudCheckExtra = {
  /** ฝั่งขาย */
  brand?: string;
  model?: string;
  finance?: string;
  channel?: string;
  chassis?: string;
  customer_phone?: string;
  salesman_code?: string;
  /** ฝั่งเงินสดย่อย */
  maker?: string;
  expense_type?: string;
  approval_no?: string;
  approver?: string;
  approved_date?: string;
  /** ฝั่งกระทบยอดเงินสด */
  cash_on_hand?: number;
  [key: string]: string | number | undefined;
};

export type AudCheck = {
  id: string;
  audit_id: string;
  type_id: string | null;
  type_code: string | null;
  type_name: string;
  kind: AudCheckKind;
  ref_no: string | null;
  ref_date: string | null;
  title: string | null;
  party: string | null;
  branch_label: string | null;
  amount: number | null;
  extra: AudCheckExtra;
  payment_id: string | null;
  result: AudResult;
  result_note: string | null;
  doc_result: AudDocResult;
  doc_note: string | null;
  call_result: AudCallResult;
  info_result: AudInfoResult;
  call_note: string | null;
  slip_result: AudSlipResult;
  slip_amount_result: AudAmountResult;
  slip_amount: number | null;
  deposit_amount: number | null;
  sort_order: number;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
};

/** รายการที่ตรวจ พร้อมหัวใบและเอกสารที่ขาด (มาจาก view v_aud_checks) */
export type AudCheckRow = AudCheck & {
  audit_no: string;
  audit_date: string;
  auditor_id: string | null;
  auditor_name: string;
  audit_status: AudStatus;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  missing_docs: string[];
  missing_count: number;
};

/** ข้อมูลต้นทางที่ดึงเข้ามาตรวจ (ยังไม่มีผลตรวจ) */
export type AudCheckSource = {
  type_id: string;
  type_code: string | null;
  type_name: string;
  kind: AudCheckKind;
  ref_no: string | null;
  ref_date: string | null;
  title: string | null;
  party: string | null;
  branch_label: string | null;
  amount: number | null;
  extra: AudCheckExtra;
  payment_id: string | null;
};

/** ผลตรวจที่ฟอร์มส่งกลับมาบันทึก */
export type AudCheckResultInput = {
  result: AudResult;
  result_note: string | null;
  doc_result: AudDocResult;
  doc_note: string | null;
  call_result: AudCallResult;
  info_result: AudInfoResult;
  call_note: string | null;
  slip_result: AudSlipResult;
  slip_amount_result: AudAmountResult;
  slip_amount: number | null;
  deposit_amount: number | null;
  /** ชื่อเอกสารที่ขาด พร้อมรหัสในทะเบียน (รายการที่พิมพ์เองมี doc_type_id = null) */
  missing: { doc_type_id: string | null; doc_name: string }[];
};

// ---------- เงื่อนไขค้นหา ----------

export type AudAuditQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  auditor_id?: string | null;
  status?: AudStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export type AudCheckQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  auditor_id?: string | null;
  type_id?: string | null;
  kind?: AudCheckKind | null;
  result?: AudResult | null;
  doc_result?: AudDocResult | null;
  call_result?: AudCallResult | null;
  info_result?: AudInfoResult | null;
  audit_status?: AudStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

/** ชนิดข้อมูลของระบบอนุมัติกลาง (โปรแกรม APV) */
import type { AccessLevel } from "./core-types";

// ---------- สถานะใบขออนุมัติ ----------

export type ApvStatus = "pending" | "endorsed" | "approved" | "partial" | "rejected" | "cancelled";

export const APV_STATUS_ORDER: ApvStatus[] = [
  "pending",
  "endorsed",
  "approved",
  "partial",
  "rejected",
  "cancelled",
];

export const APV_STATUS_LABEL: Record<ApvStatus, string> = {
  pending: "รออนุมัติ",
  endorsed: "เสนอขึ้นผู้บริหาร",
  approved: "อนุมัติแล้ว",
  partial: "อนุมัติบางส่วน",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export const APV_STATUS_CLASS: Record<ApvStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  endorsed: "bg-sky-50 text-sky-700",
  approved: "bg-emerald-50 text-emerald-700",
  partial: "bg-teal-50 text-teal-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

/** สถานะที่ยังรอคนตัดสินอยู่ */
export const OPEN_STATUSES: ApvStatus[] = ["pending", "endorsed"];

export function isOpen(status: ApvStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

// ---------- การตัดสิน ----------

export type ApvDecision = "approve" | "partial" | "reject" | "endorse";

export const APV_DECISION_ORDER: ApvDecision[] = ["approve", "partial", "reject", "endorse"];

export const APV_DECISION_LABEL: Record<ApvDecision, string> = {
  approve: "อนุมัติตามที่ขอ",
  partial: "อนุมัติบางส่วน",
  reject: "ไม่อนุมัติ",
  endorse: "เสนอผู้มีอำนาจสูงกว่า",
};

export const APV_DECISION_HINT: Record<ApvDecision, string> = {
  approve: "อนุมัติเต็มจำนวนที่ผู้ขอยื่นมา",
  partial: "อนุมัติให้น้อยกว่าที่ขอ — ระบุจำนวนที่อนุมัติ",
  reject: "ไม่อนุมัติ — ต้องเลือกเหตุผล",
  endorse: "เกินอำนาจของคุณ หรืออยากให้ผู้บริหารตัดสิน — ส่งเรื่องขึ้นไปพร้อมความเห็น",
};

export const APV_DECISION_CLASS: Record<ApvDecision, string> = {
  approve: "bg-emerald-50 text-emerald-700",
  partial: "bg-teal-50 text-teal-700",
  reject: "bg-rose-50 text-rose-700",
  endorse: "bg-sky-50 text-sky-700",
};

// ---------- ตาราง ----------

export type ApvType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  program_id: string | null;
  has_amount: boolean;
  amount_label: string;
  allow_partial: boolean;
  form_enabled: boolean;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  /** ยอดที่ไม่เกินนี้ระบบอนุมัติให้เองทันที ไม่ต้องรอผู้มีอำนาจ (null = ต้องขออนุมัติทุกใบ) */
  auto_approve_limit: number | null;
};

export type ApvRejectReason = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ApvRequest = {
  id: string;
  doc_no: string;
  type_id: string;
  company_id: string | null;
  branch_id: string | null;
  requester_id: string | null;
  requester_name: string;
  subject: string;
  detail: string | null;
  requested_amount: number;
  approved_amount: number;
  status: ApvStatus;
  request_date: string;
  needed_by: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  source_table: string | null;
  source_id: string | null;
  source_url: string | null;
  created_at: string;
};

/** แถวจาก view v_apv_requests (join ชื่อประเภท/บริษัท/สาขา และความเห็นที่เสนอมาให้แล้ว) */
export type ApvRequestRow = ApvRequest & {
  type_code: string;
  type_name: string;
  type_icon: string | null;
  has_amount: boolean;
  allow_partial: boolean;
  amount_label: string;
  company_name: string | null;
  branch_name: string | null;
  branch_code: string | null;
  decision_count: number;
  endorse_note: string | null;
  endorse_by_name: string | null;
};

export type ApvDecisionRow = {
  id: string;
  request_id: string;
  seq: number;
  decision: ApvDecision;
  approver_id: string | null;
  approver_name: string;
  approver_level: AccessLevel | null;
  approved_amount: number;
  reason_id: string | null;
  reason_name?: string | null;
  note: string | null;
  decided_at: string;
  authority_limit: number | null;
};

/** กฎอำนาจอนุมัติหนึ่งข้อ */
export type ApvLimit = {
  id: string;
  level: AccessLevel | null;
  user_id: string | null;
  type_id: string | null;
  company_id: string | null;
  /** null = ไม่จำกัดวงเงิน */
  max_amount: number | null;
  can_reject: boolean;
  is_final: boolean;
  note: string | null;
  is_active: boolean;
};

/** อำนาจที่ resolve แล้วของคนหนึ่งคนต่อเรื่องหนึ่งประเภท */
export type Authority = {
  /** null = ไม่จำกัดวงเงิน */
  maxAmount: number | null;
  canReject: boolean;
  /** true = ตัดสินขั้นสุดท้ายได้ทุกจำนวน ไม่ต้องเสนอต่อใคร */
  isFinal: boolean;
  /** กฎข้อที่ถูกใช้ (null = ไม่มีกฎเลย = อนุมัติไม่ได้) — ไว้อธิบายให้แอดมินเข้าใจ */
  fromLimitId: string | null;
  /** คำอธิบายที่มาของอำนาจ เอาไปแสดงบนหน้าจอได้เลย */
  reason: string;
};

/** สรุปกล่องรออนุมัติของคนที่ล็อกอินอยู่ */
export type InboxSummary = {
  mine: number;
  overLimit: number;
  endorsedByMe: number;
  overdue: number;
  totalAmount: number;
};

export type ApvFile = {
  id: string;
  request_id: string;
  file_path: string;
  file_name: string | null;
};

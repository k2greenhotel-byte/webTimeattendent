/** ชนิดข้อมูลของระบบจองรถ — ตรงกับตาราง bk_* ในฐานข้อมูล (migration 0015_bookings.sql) */

// ---------- สถานะและตัวเลือก (ข้อความไทยอยู่ที่นี่ที่เดียว ทุกหน้าจออ่านจากชุดนี้) ----------

/** 1.1.11 ประเภทการซื้อ */
export type PurchaseType = "cash" | "installment";

/** 1.1.13 / 1.2.4 สถานะรถ */
export type VehicleStatus = "in_stock" | "need_order" | "ordered";

/** 1.1.16 / 1.2.5 สถานะสัญญา */
export type ContractStatus = "pending" | "approved" | "rejected";

/** 1.1.17 สถานะเอกสาร */
export type DocStatus = "active" | "cancelled" | "closed";

/** 1.1.18 / 1.2.6 สถานะการจอง */
export type BookingStatus = "wait_contract" | "wait_delivery" | "delivered" | "cancelled";

/** 1.1.19 / 1.2.7 สาเหตุของการยกเลิก */
export type CancelReason = "got_other" | "contract_rejected" | "changed_mind";

/** 1.1.20-1.1.21 ชนิดเอกสารแนบ */
export type BookingFileKind =
  | "receipt_photo"
  | "transfer_slip"
  | "refund_contract_reject"
  | "refund_slip"
  | "refund_line_chat";

export const PURCHASE_TYPE_ORDER: PurchaseType[] = ["cash", "installment"];
export const VEHICLE_STATUS_ORDER: VehicleStatus[] = ["in_stock", "need_order", "ordered"];
export const CONTRACT_STATUS_ORDER: ContractStatus[] = ["pending", "approved", "rejected"];
export const DOC_STATUS_ORDER: DocStatus[] = ["active", "cancelled", "closed"];
export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  "wait_contract",
  "wait_delivery",
  "delivered",
  "cancelled",
];
export const CANCEL_REASON_ORDER: CancelReason[] = [
  "got_other",
  "contract_rejected",
  "changed_mind",
];

export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  cash: "เงินสด",
  installment: "ผ่อนชำระ",
};

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  in_stock: "มีในสต็อก",
  need_order: "ต้องสั่ง",
  ordered: "รถที่สั่งมาแล้ว",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  pending: "รอทำสัญญา",
  approved: "สัญญาผ่านแล้ว",
  rejected: "ไม่ผ่าน",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  active: "ใช้งาน",
  cancelled: "ยกเลิก",
  closed: "ปิดงาน",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  wait_contract: "รอสัญญา",
  wait_delivery: "รอรับรถ",
  delivered: "รับรถแล้ว",
  cancelled: "ยกเลิกไม่รับรถแล้ว",
};

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  got_other: "ได้รถที่อื่นแล้ว",
  contract_rejected: "สัญญาไม่ผ่าน",
  changed_mind: "ลูกค้าเปลี่ยนใจ",
};

export const FILE_KIND_LABEL: Record<BookingFileKind, string> = {
  receipt_photo: "รูปใบเสร็จรับเงิน",
  transfer_slip: "สลิปโอนเงิน",
  refund_contract_reject: "เอกสารสัญญาไม่ผ่าน",
  refund_slip: "สลิปโอนเงินคืน",
  refund_line_chat: "รูป Chat Line คำขอคืนเงิน",
};

/** เอกสารรับเงิน (1.1.20) และเอกสารคืนเงิน (1.1.21) — ใช้จัดกลุ่มช่องอัปโหลดในฟอร์ม */
export const RECEIPT_FILE_KINDS: BookingFileKind[] = ["receipt_photo", "transfer_slip"];
export const REFUND_FILE_KINDS: BookingFileKind[] = [
  "refund_contract_reject",
  "refund_slip",
  "refund_line_chat",
];

/** สีป้ายสถานะ ใช้ร่วมกันทุกหน้า จะได้ไม่เพี้ยนกัน */
export const VEHICLE_STATUS_CLASS: Record<VehicleStatus, string> = {
  in_stock: "bg-emerald-100 text-emerald-700",
  need_order: "bg-amber-100 text-amber-700",
  ordered: "bg-sky-100 text-sky-700",
};

export const CONTRACT_STATUS_CLASS: Record<ContractStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export const DOC_STATUS_CLASS: Record<DocStatus, string> = {
  active: "bg-sky-100 text-sky-700",
  cancelled: "bg-rose-100 text-rose-700",
  closed: "bg-slate-200 text-slate-600",
};

export const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  wait_contract: "bg-amber-100 text-amber-700",
  wait_delivery: "bg-sky-100 text-sky-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

// ---------- แถวข้อมูล ----------

export type BookingFile = {
  id?: string;
  kind: BookingFileKind;
  path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  sort_order?: number;
};

/** ใบจองรถ (หน้าจอ 1.1) */
export type Booking = {
  id: string;
  doc_no: string;
  branch_id: string | null;
  ref_no: string | null;
  booking_date: string;
  customer_id: string | null;
  customer_phone: string | null;
  brand_id: string | null;
  model_id: string | null;
  variant_id: string | null;
  color_id: string | null;
  purchase_type: PurchaseType;
  pickup_date: string | null;
  vehicle_status: VehicleStatus;
  deposit_amount: number;
  receipt_no: string | null;
  contract_status: ContractStatus;
  doc_status: DocStatus;
  booking_status: BookingStatus;
  cancel_reason: CancelReason | null;
  sale_contract_no: string | null;
  sale_date: string | null;
  refunded: boolean;
  /** บัญชีผู้ใช้ที่รับจอง (มาจากคนที่ล็อกอินอยู่ตอนเปิดใบ) */
  taken_by: string | null;
  /** ชื่อพนักงานที่รับจองตามที่แสดงบนใบ — แก้ได้เผื่อคีย์แทนกัน */
  taken_by_name: string | null;
  note: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** ใบจองพร้อมชื่อที่ join มาแล้ว (มาจาก view v_bk_bookings) */
export type BookingRow = Booking & {
  customer_code: string | null;
  customer_name: string | null;
  branch_name: string | null;
  brand_name: string | null;
  model_name: string | null;
  variant_name: string | null;
  color_name: string | null;
  /** ชื่อพนักงานที่รับจอง ตามบัญชีผู้ใช้ล่าสุด (ชื่อบนใบอยู่ที่ taken_by_name) */
  taken_by_full_name: string | null;
  file_count: number;
  update_count: number;
};

/** ค่าที่ฟอร์มรับจองส่งมาบันทึก (ยังไม่มีเลขที่เอกสาร — ระบบรันให้ตอนบันทึก) */
export type BookingInput = Omit<Booking, "id" | "doc_no" | "created_at">;

/** ใบ update สถานะใบจอง (หน้าจอ 1.2) — ช่องสถานะเป็น null ได้ = "ไม่เปลี่ยน" */
export type BookingUpdate = {
  id: string;
  doc_no: string;
  update_date: string;
  booking_id: string;
  vehicle_status: VehicleStatus | null;
  contract_status: ContractStatus | null;
  booking_status: BookingStatus | null;
  cancel_reason: CancelReason | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  sale_contract_no: string | null;
  sale_date: string | null;
  refunded: boolean;
  note: string | null;
  created_at: string;
};

export type BookingUpdateRow = BookingUpdate & {
  booking_no: string;
  booking_ref_no: string | null;
  customer_name: string | null;
  recorded_by_full_name: string | null;
  file_count: number;
};

export type BookingUpdateInput = Omit<BookingUpdate, "id" | "doc_no" | "created_at">;

/** เงื่อนไขของหน้าจอสอบถาม (1.3) และ dashboard (1.4) */
export type BookingQuery = {
  keyword?: string;
  branch_id?: string | null;
  brand_id?: string | null;
  model_id?: string | null;
  variant_id?: string | null;
  color_id?: string | null;
  purchase_type?: PurchaseType | null;
  vehicle_status?: VehicleStatus | null;
  contract_status?: ContractStatus | null;
  doc_status?: DocStatus | null;
  booking_status?: BookingStatus | null;
  cancel_reason?: CancelReason | null;
  /** ชื่อพนักงานที่รับจองตามที่แสดงบนใบ (ตรงตัว) */
  staff?: string | null;
  /** ช่วงวันที่จอง */
  from?: string | null;
  to?: string | null;
  /** ช่วงวันที่นัดรับรถ */
  pickup_from?: string | null;
  pickup_to?: string | null;
  limit?: number;
};

/** ชนิดไฟล์ที่ให้แนบได้ (ถังเดียวกับไฟล์แนบของ Memo) */
export const BOOKING_FILE_ACCEPT = "image/*,application/pdf";

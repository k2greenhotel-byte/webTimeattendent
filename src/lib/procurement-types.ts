/**
 * ชนิดข้อมูลของระบบจัดซื้อจัดจ้างแจ้งซ่อม — ตรงกับตาราง pr_* (migration 0016_procurement.sql)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- สถานะและตัวเลือก ----------

/** 1.1.8 / 1.3.10 ความเร่งด่วนที่ต้องได้รับการแก้ไข */
export type Urgency = "d1_2" | "d2_5" | "d5_plus";

/** 1.1.17 / 1.3.16 สถานะเอกสาร */
export type PrDocStatus = "active" | "cancelled";

/** 1.1.18 / 1.3.17 สถานะการเบิกเงิน (ค่าเดียวกันทั้งงานซ่อมและงานซื้อ ต่างกันแค่คำที่แสดง) */
export type PayStatus = "requested" | "approved" | "settled";

/** 1.1.19 / 1.2.4 สถานะงานซ่อม */
export type JobStatus = "wait_tech" | "contacted" | "in_progress" | "done";

/** 1.1.20 / 3.1.4 สถานะอนุมัติ */
export type ApproveStatus = "pending" | "approved" | "rejected" | "recheck";

/** 3.1.5 สาเหตุของการไม่อนุมัติ */
export type RejectReason = "price_high" | "use_old" | "find_new";

/** 1.1.16 แก้ไขโดยช่างภายในหรือช่างภายนอก */
export type TechKind = "internal" | "external";

/** 4.5-4.6 ชนิดสิ่งที่แนบมากับใบเบิกจ่าย */
export type PaymentFileKind = "photo" | "document";

/** ชนิดเอกสารต้นทาง — ใช้ทั้งหน้าอนุมัติ หน้าจ่ายเงิน และหน้าสอบถาม */
export type DocKind = "repair" | "purchase";

export const URGENCY_ORDER: Urgency[] = ["d1_2", "d2_5", "d5_plus"];
export const PR_DOC_STATUS_ORDER: PrDocStatus[] = ["active", "cancelled"];
export const PAY_STATUS_ORDER: PayStatus[] = ["requested", "approved", "settled"];
export const APPROVE_STATUS_ORDER: ApproveStatus[] = ["pending", "approved", "rejected", "recheck"];
export const REJECT_REASON_ORDER: RejectReason[] = ["price_high", "use_old", "find_new"];
export const TECH_KIND_ORDER: TechKind[] = ["internal", "external"];
export const DOC_KIND_ORDER: DocKind[] = ["repair", "purchase"];

/** สถานะงานทั้งหมด (หน้าจอ 1.2 บันทึกได้ครบ 4 ค่า) */
export const JOB_STATUS_ORDER: JobStatus[] = ["wait_tech", "contacted", "in_progress", "done"];

/** สถานะงานที่เลือกได้ตอนแจ้งซ่อม — ข้อ 1.1.19 ระบุไว้ 3 ค่า (ยังไม่ได้เริ่มซ่อม) */
export const JOB_STATUS_ENTRY_ORDER: JobStatus[] = ["wait_tech", "contacted", "done"];

/** ตัวเลือกที่ผู้อนุมัติกดได้ — ไม่มี pending เพราะเป็นค่าตั้งต้นก่อนมีใบอนุมัติ */
export const APPROVE_DECISION_ORDER: ApproveStatus[] = ["approved", "rejected", "recheck"];

export const URGENCY_LABEL: Record<Urgency, string> = {
  d1_2: "ภายใน 1-2 วัน",
  d2_5: "ภายใน 2-5 วัน",
  d5_plus: "5 วันขึ้นไป",
};

export const PR_DOC_STATUS_LABEL: Record<PrDocStatus, string> = {
  active: "ใช้งาน",
  cancelled: "ยกเลิก",
};

/** 1.1.18 คำที่ใช้ฝั่งงานซ่อม (ร้านเป็นผู้รับเงินไปจ่ายช่าง) */
export const REPAIR_PAY_STATUS_LABEL: Record<PayStatus, string> = {
  requested: "ทำเรื่องตั้งเบิก",
  approved: "อนุมัติ",
  settled: "รับเงินแล้ว",
};

/** 1.3.17 คำที่ใช้ฝั่งงานจัดซื้อ */
export const PURCHASE_PAY_STATUS_LABEL: Record<PayStatus, string> = {
  requested: "ทำเรื่องตั้งเบิก",
  approved: "อนุมัติแล้ว",
  settled: "จ่ายเงินแล้ว",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  wait_tech: "รอติดต่อช่าง",
  contacted: "ติดต่อช่างแล้วรอการแก้ไข",
  in_progress: "อยู่ระหว่างการซ่อม",
  done: "ได้รับการแก้ไขแล้ว",
};

export const APPROVE_STATUS_LABEL: Record<ApproveStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  recheck: "ให้ตรวจสอบราคา/หารายใหม่มาเทียบ",
};

export const REJECT_REASON_LABEL: Record<RejectReason, string> = {
  price_high: "ราคาสูง",
  use_old: "ใช้ของเก่าได้ไปก่อน",
  find_new: "หาผู้ขายหรือช่างรายใหม่",
};

export const TECH_KIND_LABEL: Record<TechKind, string> = {
  internal: "ช่างภายใน",
  external: "ช่างภายนอก",
};

export const PAYMENT_FILE_KIND_LABEL: Record<PaymentFileKind, string> = {
  photo: "รูปภาพประกอบ",
  document: "ไฟล์เอกสาร (ใบเสร็จ / ใบรับสินค้า)",
};

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  repair: "ใบขอซ่อม",
  purchase: "ใบขอจัดซื้อ",
};

/** สีป้ายสถานะ ใช้ร่วมกันทุกหน้า จะได้ไม่เพี้ยนกัน */
export const URGENCY_CLASS: Record<Urgency, string> = {
  d1_2: "bg-rose-100 text-rose-700",
  d2_5: "bg-amber-100 text-amber-700",
  d5_plus: "bg-slate-100 text-slate-600",
};

export const PR_DOC_STATUS_CLASS: Record<PrDocStatus, string> = {
  active: "bg-sky-100 text-sky-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export const PAY_STATUS_CLASS: Record<PayStatus, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  settled: "bg-emerald-100 text-emerald-700",
};

export const JOB_STATUS_CLASS: Record<JobStatus, string> = {
  wait_tech: "bg-slate-200 text-slate-600",
  contacted: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
};

export const APPROVE_STATUS_CLASS: Record<ApproveStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  recheck: "bg-violet-100 text-violet-700",
};

export const DOC_KIND_CLASS: Record<DocKind, string> = {
  repair: "bg-orange-100 text-orange-700",
  purchase: "bg-indigo-100 text-indigo-700",
};

/** จำนวนวันที่ถือว่าต้องเสร็จ นับจากวันที่แจ้ง — ใช้คำนวณงานเกินกำหนดใน dashboard */
export const URGENCY_DAYS: Record<Urgency, number> = {
  d1_2: 2,
  d2_5: 5,
  d5_plus: 10,
};

/** จำนวนรูปสูงสุดต่อหนึ่งเอกสาร (ข้อ 1.1.10 / 1.2.9 / 1.3.12) */
export const MAX_PHOTOS = 10;

/** จำนวนไฟล์เอกสารสูงสุดของใบเบิกจ่าย (ข้อ 4.6) */
export const MAX_PAYMENT_DOCS = 10;

/** ชนิดไฟล์ที่ให้แนบได้กับใบเบิกจ่าย */
export const PR_FILE_ACCEPT = "image/*,application/pdf";

// ---------- ค่าเบื้องต้น ----------

/** หนึ่งแถวของประเภททรัพย์สิน (1.1.6) หรือประเภทวัสดุ (1.3.8) — โครงเดียวกันทั้งสองชุด */
export type PrType = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PrTypeInput = {
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

/** ชุดข้อมูลเบื้องต้นที่หน้าจอตั้งค่ารองรับ — เพิ่มชุดใหม่ = เพิ่มหนึ่งรายการที่นี่ */
export type PrTypeKind = "asset" | "material";

// ---------- ใบขอซ่อม (หน้าจอ 1.1) ----------

export type Repair = {
  id: string;
  doc_no: string;
  request_date: string;
  company_id: string | null;
  branch_id: string | null;
  item_name: string;
  asset_type_id: string | null;
  damage_detail: string | null;
  urgency: Urgency;
  created_by: string | null;
  created_by_name: string | null;
  requested_amount: number;
  approved_amount: number;
  actual_amount: number;
  tech_name: string | null;
  tech_phone: string | null;
  tech_kind: TechKind;
  doc_status: PrDocStatus;
  pay_status: PayStatus;
  job_status: JobStatus;
  approve_status: ApproveStatus;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  /** เลขที่/วันที่จากใบอนุมัติ (ข้อ 3.1.1-3.1.2) ระบบเขียนให้ตอนอนุมัติผ่าน */
  approval_no: string | null;
  approved_date: string | null;
  approved_by: string | null;
  /** ร่องรอยการยกเลิก (ระบบเขียนให้ตอนกดยกเลิก ไม่ได้มาจากฟอร์มแก้ไข) */
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  tech_visit_date: string | null;
  expected_done_date: string | null;
  fixed_date: string | null;
  note: string | null;
  created_at: string;
};

/** ใบขอซ่อมพร้อมชื่อที่ join มาแล้ว (มาจาก view v_pr_repairs) */
export type RepairRow = Repair & {
  company_name: string | null;
  branch_name: string | null;
  asset_type_code: string | null;
  asset_type_name: string | null;
  created_by_full_name: string | null;
  cancelled_by_name: string | null;
  photo_count: number;
  update_count: number;
  paid_total: number;
};

/** ค่าที่ฟอร์มส่งมาบันทึก (ยังไม่มีเลขที่เอกสาร — ระบบรันให้ตอนบันทึก) */
export type RepairInput = Omit<Repair, "id" | "doc_no" | "created_at">;

// ---------- ใบ update งานซ่อม (หน้าจอ 1.2) ----------

export type RepairUpdate = {
  id: string;
  doc_no: string;
  update_date: string;
  repair_id: string;
  job_status: JobStatus | null;
  detail: string | null;
  expected_done_date: string | null;
  requested_amount: number | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type RepairUpdateRow = RepairUpdate & {
  repair_no: string;
  repair_item_name: string;
  branch_name: string | null;
  recorded_by_full_name: string | null;
  photo_count: number;
};

export type RepairUpdateInput = Omit<RepairUpdate, "id" | "doc_no" | "created_at">;

// ---------- ใบขอจัดซื้อ (หน้าจอ 1.3) ----------

export type Purchase = {
  id: string;
  doc_no: string;
  request_date: string;
  company_id: string | null;
  branch_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  item_name: string;
  material_type_id: string | null;
  reason: string | null;
  urgency: Urgency;
  created_by: string | null;
  created_by_name: string | null;
  requested_amount: number;
  approved_amount: number;
  actual_amount: number;
  doc_status: PrDocStatus;
  pay_status: PayStatus;
  approve_status: ApproveStatus;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  /** เลขที่/วันที่จากใบอนุมัติ (ข้อ 3.1.1-3.1.2) ระบบเขียนให้ตอนอนุมัติผ่าน */
  approval_no: string | null;
  approved_date: string | null;
  approved_by: string | null;
  /** ร่องรอยการยกเลิก (ระบบเขียนให้ตอนกดยกเลิก ไม่ได้มาจากฟอร์มแก้ไข) */
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  received_date: string | null;
  note: string | null;
  created_at: string;
};

export type PurchaseRow = Purchase & {
  company_name: string | null;
  branch_name: string | null;
  material_type_code: string | null;
  material_type_name: string | null;
  created_by_full_name: string | null;
  cancelled_by_name: string | null;
  photo_count: number;
  paid_total: number;
};

export type PurchaseInput = Omit<Purchase, "id" | "doc_no" | "created_at">;

// ---------- ใบอนุมัติ (หน้าจอ 3.1) ----------

export type Approval = {
  id: string;
  doc_no: string;
  approve_date: string;
  approver_id: string | null;
  approver_name: string | null;
  decision: ApproveStatus;
  reject_reason: RejectReason | null;
  approved_amount: number;
  note: string | null;
  repair_id: string | null;
  purchase_id: string | null;
  created_at: string;
};

export type ApprovalRow = Approval & {
  repair_no: string | null;
  repair_item_name: string | null;
  purchase_no: string | null;
  purchase_item_name: string | null;
  approver_full_name: string | null;
};

export type ApprovalInput = Omit<Approval, "id" | "doc_no" | "created_at">;

// ---------- ใบเบิกจ่าย (หน้าจอ 4) ----------

export type Payment = {
  id: string;
  doc_no: string;
  pay_date: string;
  paid_amount: number;
  /** เลขที่อ้างอิง — ดึงเลขที่อนุมัติมาใส่ ถ้าเป็นรายการทั่วไปเว้นว่างได้ */
  ref_no: string | null;
  payee_name: string | null;
  payee_address: string | null;
  payee_phone: string | null;
  /** รายการค่าใช้จ่าย — จ่ายค่าอะไร (คนละอย่างกับ account_id ที่เป็นบัญชีในผังบัญชี) */
  expense_detail: string | null;
  /** ประเภทค่าใช้จ่าย = บัญชีในผังบัญชี */
  account_id: string | null;
  /** เจ้าหนี้ในทะเบียน (null = ผู้ขายไม่ประจำ พิมพ์ชื่อเอง) */
  vendor_id: string | null;
  /** ผู้ทำจ่าย = คนที่จ่ายเงินสดย่อยออกไป */
  payer_name: string | null;
  /** ชื่อผู้อนุมัติ — ดึงมาจากใบอนุมัติของเอกสารที่อ้างถึง ไม่มีลายเซ็นเพราะเซ็นไว้ที่ใบอนุมัติแล้ว */
  approver_name: string | null;
  /** ลายเซ็นดิจิทัล เก็บเป็นเส้นทางไฟล์ PNG ในถังเดียวกับรูปแนบ */
  payee_signature: string | null;
  payer_signature: string | null;
  /** จ่ายจากเงินสดย่อยหรือจากส่วนกลาง */
  pay_source: PaySource;
  note: string | null;
  company_id: string | null;
  branch_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type PaymentRow = Payment & {
  company_name: string | null;
  company_code: string | null;
  branch_name: string | null;
  branch_code: string | null;
  account_code: string | null;
  account_name: string | null;
  account_category: AccountCategory | null;
  vendor_code: string | null;
  vendor_name: string | null;
  created_by_full_name: string | null;
  item_count: number;
  file_count: number;
  item_total: number;
};

export type PaymentInput = Omit<Payment, "id" | "doc_no" | "created_at">;

/** หนึ่งเอกสารต้นทางที่ใบเบิกจ่ายใบนี้อ้างถึง (ข้อ 4.4) */
export type PaymentItem = {
  id?: string;
  repair_id: string | null;
  purchase_id: string | null;
  amount: number;
  sort_order?: number;
};

export type PaymentFile = {
  id?: string;
  kind: PaymentFileKind;
  path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  sort_order?: number;
};

// ---------- แถวรวมจาก view v_pr_docs (หน้าอนุมัติ ข้อ 3 และหน้าสอบถาม ข้อ 5) ----------

export type PrDocRow = {
  kind: DocKind;
  id: string;
  doc_no: string;
  doc_date: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  item_name: string;
  type_name: string | null;
  urgency: Urgency;
  requested_amount: number;
  approved_amount: number;
  actual_amount: number;
  doc_status: PrDocStatus;
  pay_status: PayStatus;
  approve_status: ApproveStatus;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  /** เลขที่และวันที่ในใบอนุมัติที่ทำให้เอกสารนี้ผ่าน (ข้อ 3.1.1-3.1.2) */
  approval_no: string | null;
  approved_date: string | null;
  approved_by: string | null;
  /** มีเฉพาะฝั่งงานซ่อม */
  job_status: JobStatus | null;
  expected_done_date: string | null;
  /** ซ่อม = วันที่แก้ไขเสร็จ · ซื้อ = วันที่ได้รับวัสดุ */
  done_date: string | null;
  created_by: string | null;
  created_by_name: string | null;
  /** ร่องรอยการยกเลิก (ระบบเขียนให้ตอนกดยกเลิก ไม่ได้มาจากฟอร์มแก้ไข) */
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_by_name: string | null;
  note: string | null;
  created_at: string;
};

// ---------- เงื่อนไขค้นหา ----------

/** เงื่อนไขของหน้าจอสอบถาม (ข้อ 5) หน้าอนุมัติ (ข้อ 3) และ dashboard (ข้อ 6) */
export type PrDocQuery = {
  keyword?: string;
  kind?: DocKind | null;
  company_id?: string | null;
  branch_id?: string | null;
  urgency?: Urgency | null;
  doc_status?: PrDocStatus | null;
  pay_status?: PayStatus | null;
  approve_status?: ApproveStatus | null;
  /** กรองสถานะงานได้เฉพาะฝั่งงานซ่อม */
  job_status?: JobStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export type RepairQuery = Omit<PrDocQuery, "kind">;
export type PurchaseQuery = Omit<PrDocQuery, "kind" | "job_status">;

// ---------- ผังบัญชี (ใช้เป็น "ประเภทค่าใช้จ่าย" ของใบเบิกเงินสดย่อย) ----------

/** 5 หมวดตามหลักบัญชี */
export type AccountCategory = "asset" | "liability" | "equity" | "expense" | "revenue";

export const ACCOUNT_CATEGORY_ORDER: AccountCategory[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

export const ACCOUNT_CATEGORY_LABEL: Record<AccountCategory, string> = {
  asset: "สินทรัพย์",
  liability: "หนี้สิน",
  equity: "ส่วนของทุน",
  revenue: "รายได้",
  expense: "ค่าใช้จ่าย",
};

export const ACCOUNT_CATEGORY_CLASS: Record<AccountCategory, string> = {
  asset: "bg-sky-100 text-sky-700",
  liability: "bg-amber-100 text-amber-700",
  equity: "bg-violet-100 text-violet-700",
  revenue: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
};

/** หนึ่งบัญชีในผังบัญชี — ไม่มี parent_id = บัญชีคุม · มี parent_id = บัญชีย่อย */
export type PrAccount = {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

/** บัญชีพร้อมชื่อบัญชีคุม (มาจาก view v_pr_accounts) */
export type PrAccountRow = PrAccount & {
  parent_code: string | null;
  parent_name: string | null;
  child_count: number;
};

export type PrAccountInput = {
  code: string;
  name: string;
  category: AccountCategory;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

/** เงื่อนไขค้นหาของหน้าจอใบเบิกเงินสดย่อย (ข้อ 4) */
export type PaymentQuery = {
  keyword?: string;
  pay_source?: PaySource | null;
  company_id?: string | null;
  branch_id?: string | null;
  account_id?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

// ---------- แหล่งเงินที่ใช้จ่าย (ข้อ 4) ----------

/**
 * ใบเบิกจ่ายมีสองแหล่ง ใช้ตารางและหน้าจอชุดเดียวกันทั้งหมด
 * ต่างกันแค่ชุดเลขที่เอกสาร เมนู/สิทธิ์ และชื่อที่แสดง
 */
export type PaySource = "petty" | "central";

export const PAY_SOURCE_ORDER: PaySource[] = ["petty", "central"];

/** นิยามของแต่ละแหล่งจ่าย — เพิ่มแหล่งใหม่ = เพิ่มหนึ่งรายการที่นี่ + หนึ่งชุดหน้าจอบาง ๆ */
export type PaySourceSpec = {
  source: PaySource;
  /** รหัสเมนูในระบบส่วนกลาง ใช้ตรวจสิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ */
  menuCode: string;
  /** ส่วนต้นของ URL */
  basePath: string;
  /** ตัวอักษรนำหน้าเลขที่เอกสาร — คนละชุดตัวนับกัน */
  prefix: string;
  /** ชื่อหน้าจอ */
  title: string;
  /** ชื่อเอกสาร ใช้ในหัวเอกสารพิมพ์และข้อความยืนยัน */
  docLabel: string;
  description: string;
};

export const PAY_SOURCES: Record<PaySource, PaySourceSpec> = {
  petty: {
    source: "petty",
    menuCode: "PR_PAYMENT",
    basePath: "/procurement/payments",
    prefix: "PV",
    title: "จ่ายเงินจากเงินสดย่อย",
    docLabel: "ใบเบิกเงินสดย่อย",
    description: "จ่ายค่าใช้จ่ายย่อยหน้าสาขา ทั้งรายการที่ผ่านอนุมัติและรายการทั่วไป",
  },
  central: {
    source: "central",
    menuCode: "PR_CENTRAL_PAY",
    basePath: "/procurement/central-payments",
    prefix: "CV",
    title: "จ่ายเงินจากส่วนกลาง",
    docLabel: "ใบเบิกจ่ายส่วนกลาง",
    description: "จ่ายจากส่วนกลาง ใช้ชุดเลขที่เอกสารแยกจากเงินสดย่อย",
  },
};

export const PAY_SOURCE_LABEL: Record<PaySource, string> = {
  petty: "เงินสดย่อย",
  central: "ส่วนกลาง",
};

export const PAY_SOURCE_CLASS: Record<PaySource, string> = {
  petty: "bg-amber-100 text-amber-700",
  central: "bg-indigo-100 text-indigo-700",
};

// ---------- ป้ายกำกับ (แฮชแท็ก) ของใบเบิกจ่าย ----------

/** ป้ายหนึ่งอันในทะเบียน — slug คือชื่อที่ normalize แล้ว ใช้กันป้ายซ้ำ */
export type PrTag = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type PrTagRow = PrTag & {
  /** จำนวนใบเบิกที่ติดป้ายนี้ */
  use_count: number;
};

/** หนึ่งแถวของคู่ (ใบเบิก × ป้าย) จาก view v_pr_payment_tag_rows — ใบที่ยังไม่ติดป้ายมี tag_id เป็น null */
export type PaymentTagRow = {
  payment_id: string;
  doc_no: string;
  pay_date: string;
  paid_amount: number;
  pay_source: PaySource;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  payee_name: string | null;
  expense_detail: string | null;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  tag_id: string | null;
  tag_name: string | null;
  tag_slug: string | null;
};

/** เงื่อนไขของรายงานสรุปตามป้ายกำกับ */
export type TagReportQuery = {
  from?: string | null;
  to?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  pay_source?: PaySource | null;
  tag_id?: string | null;
};

/** จำนวนป้ายสูงสุดต่อหนึ่งใบเบิก — กันติดรัวจนรายงานอ่านไม่รู้เรื่อง */
export const MAX_TAGS_PER_PAYMENT = 10;

// ---------- ทะเบียนเจ้าหนี้ / ผู้ขาย ----------

/** เจ้าหนี้หรือผู้ขายที่จ่ายเป็นประจำ — เลือกจากทะเบียนแทนการพิมพ์ซ้ำทุกครั้ง */
export type PrVendor = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type PrVendorRow = PrVendor & {
  /** จำนวนใบเบิกที่จ่ายให้เจ้าหนี้รายนี้ และยอดรวม */
  payment_count: number;
  paid_total: number;
};

export type PrVendorInput = {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

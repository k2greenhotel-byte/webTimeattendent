/**
 * ชนิดข้อมูลของระบบแจ้งเคลม — ตรงกับตาราง cl_* (migration 0035_claims.sql)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- สถานะและตัวเลือก ----------

/** 1.4.12 ความเร่งด่วนที่ต้องได้รับการแก้ไข */
export type ClaimUrgency = "d1_2" | "d2_5" | "d5_plus";

/** 1.4.18 สถานะเอกสาร */
export type ClaimDocStatus = "active" | "cancelled";

/** 1.4.19 / 1.5.4 สถานะงานเคลม */
export type ClaimJobStatus =
  | "wait_notify"
  | "sent_agent"
  | "approved"
  | "rejected"
  | "in_progress"
  | "done";

export const CLAIM_URGENCY_ORDER: ClaimUrgency[] = ["d1_2", "d2_5", "d5_plus"];
export const CLAIM_DOC_STATUS_ORDER: ClaimDocStatus[] = ["active", "cancelled"];
export const CLAIM_JOB_STATUS_ORDER: ClaimJobStatus[] = [
  "wait_notify",
  "sent_agent",
  "approved",
  "rejected",
  "in_progress",
  "done",
];

export const CLAIM_URGENCY_LABEL: Record<ClaimUrgency, string> = {
  d1_2: "ภายใน 1-2 วัน",
  d2_5: "ภายใน 2-5 วัน",
  d5_plus: "5 วันขึ้นไป",
};

export const CLAIM_DOC_STATUS_LABEL: Record<ClaimDocStatus, string> = {
  active: "ใช้งาน",
  cancelled: "ยกเลิก",
};

export const CLAIM_JOB_STATUS_LABEL: Record<ClaimJobStatus, string> = {
  wait_notify: "รอติดต่อแจ้งผู้ผลิต",
  sent_agent: "ส่งเรื่องให้ตัวแทนผู้ผลิต",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  in_progress: "อยู่ระหว่างดำเนินการแก้ไข",
  done: "แก้ไขเรียบร้อย",
};

/** สีป้ายสถานะ ใช้ร่วมกันทุกหน้า จะได้ไม่เพี้ยนกัน */
export const CLAIM_URGENCY_CLASS: Record<ClaimUrgency, string> = {
  d1_2: "bg-rose-100 text-rose-700",
  d2_5: "bg-amber-100 text-amber-700",
  d5_plus: "bg-slate-100 text-slate-600",
};

export const CLAIM_DOC_STATUS_CLASS: Record<ClaimDocStatus, string> = {
  active: "bg-sky-100 text-sky-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export const CLAIM_JOB_STATUS_CLASS: Record<ClaimJobStatus, string> = {
  wait_notify: "bg-slate-200 text-slate-600",
  sent_agent: "bg-violet-100 text-violet-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
};

/** สถานะที่ถือว่างานจบแล้ว — ไม่นับเป็นงานค้างใน dashboard */
export const CLAIM_CLOSED_STATUSES: ClaimJobStatus[] = ["done", "rejected"];

/** จำนวนวันที่ถือว่าต้องได้รับการแก้ไข นับจากวันที่แจ้ง — ใช้คำนวณงานเกินกำหนด */
export const CLAIM_URGENCY_DAYS: Record<ClaimUrgency, number> = {
  d1_2: 2,
  d2_5: 5,
  d5_plus: 10,
};

/** จำนวนรูปสูงสุดต่อหนึ่งเอกสาร (ข้อ 1.4.14 / 1.5.9) */
export const CLAIM_MAX_PHOTOS = 10;

/** จำนวนรายการที่ขอเคลมสูงสุดต่อหนึ่งใบ (ข้อ 1.4.10) — กันฟอร์มบวมจนบันทึกไม่ไหว */
export const CLAIM_MAX_ITEMS = 20;

// ---------- แถวข้อมูล ----------

/** 1.4.10 หนึ่งรายการที่ขอเคลม */
export type ClaimItem = {
  id?: string;
  item_name: string;
  qty: number;
  note: string | null;
  sort_order?: number;
};

/** ใบขอเคลม (หน้าจอ 1.4) */
export type Claim = {
  id: string;
  doc_no: string;
  claim_date: string;
  company_id: string | null;
  branch_id: string | null;

  /** รถ — สำเนาจากระบบขาย (Db2) หรือคีย์เองเมื่อเป็นลูกค้าภายนอก */
  chassis_no: string;
  engine_no: string | null;
  db2_brand_code: string | null;
  db2_brand_name: string | null;
  db2_model_code: string | null;
  db2_model_name: string | null;
  db2_variant_code: string | null;
  db2_variant_name: string | null;
  db2_color_code: string | null;
  db2_color_name: string | null;
  db2_contno: string | null;
  db2_locat: string | null;
  db2_sale_date: string | null;

  /** ลูกค้า */
  db2_cuscod: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  is_external: boolean;

  damage_detail: string | null;
  urgency: ClaimUrgency;
  created_by: string | null;
  created_by_name: string | null;

  maker_name: string | null;
  maker_agent_name: string | null;
  maker_phone: string | null;

  doc_status: ClaimDocStatus;
  job_status: ClaimJobStatus;
  reject_reason: string | null;
  result_date: string | null;
  fixed_date: string | null;
  delivered_date: string | null;

  expected_done_date: string | null;
  requested_amount: number;

  /** เลขที่ Job และวันที่ของ job — ค่าล่าสุดที่ใบ update ส่งขึ้นมา (1.5.10-1.5.13) */
  job_no: string | null;
  job_open_date: string | null;
  job_close_date: string | null;
  job_deliver_date: string | null;

  note: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบขอเคลมพร้อมชื่อที่ join มาแล้ว (มาจาก view v_cl_claims) */
export type ClaimRow = Claim & {
  company_name: string | null;
  company_code: string | null;
  branch_name: string | null;
  branch_code: string | null;
  created_by_full_name: string | null;
  photo_count: number;
  item_count: number;
  update_count: number;
  /** รายการที่ขอเคลมย่อเป็นบรรทัดเดียว ("ไฟหน้า, บังโคลนหน้า") */
  item_summary: string | null;
};

/** ค่าที่ฟอร์มส่งมาบันทึก (ยังไม่มีเลขที่เอกสาร — ระบบรันให้ตอนบันทึก) */
export type ClaimInput = Omit<Claim, "id" | "doc_no" | "created_at" | "updated_at">;

// ---------- ใบ update งานเคลม (หน้าจอ 1.5) ----------

export type ClaimUpdate = {
  id: string;
  doc_no: string;
  update_date: string;
  claim_id: string;
  job_status: ClaimJobStatus | null;
  detail: string | null;
  expected_done_date: string | null;
  requested_amount: number | null;
  reject_reason: string | null;
  /** 1.5.10 เลขที่ Job no (เว้นว่าง = ไม่เปลี่ยนของเดิมบนใบขอเคลม) */
  job_no: string | null;
  /** 1.5.11 วันที่เปิด job */
  job_open_date: string | null;
  /** 1.5.12 วันที่ปิด job */
  job_close_date: string | null;
  /** 1.5.13 วันที่ส่งมอบงานหรือปิด job */
  job_deliver_date: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type ClaimUpdateRow = ClaimUpdate & {
  claim_no: string;
  claim_chassis_no: string;
  claim_customer_name: string;
  company_id: string | null;
  branch_id: string | null;
  branch_name: string | null;
  recorded_by_full_name: string | null;
  photo_count: number;
};

export type ClaimUpdateInput = Omit<ClaimUpdate, "id" | "doc_no" | "created_at">;

/** เงื่อนไขของหน้าจอสอบถาม (ข้อ 2) และ dashboard (ข้อ 3) */
export type ClaimQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  urgency?: ClaimUrgency | null;
  doc_status?: ClaimDocStatus | null;
  job_status?: ClaimJobStatus | null;
  /** ลูกค้าภายนอกที่ไม่มีในระบบขาย (1.4.9) — "1" เฉพาะภายนอก · "0" เฉพาะที่มีใน Db2 */
  external?: "1" | "0" | null;
  /** ช่วงวันที่แจ้งเคลม */
  from?: string | null;
  to?: string | null;
  limit?: number;
};

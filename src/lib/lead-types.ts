/**
 * ชนิดข้อมูลของระบบข้อมูล Lead — ตรงกับตาราง ld_* (migration 0020_leads.sql)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- สถานะ ----------

/** 1.10 สถานะงาน */
export type WorkStatus = "follow_up" | "dropped" | "bought_other" | "closed_won";

/** 1.11 สถานะโอกาสการขาย */
export type Chance = "high" | "medium" | "low";

export const WORK_STATUS_ORDER: WorkStatus[] = [
  "follow_up",
  "closed_won",
  "bought_other",
  "dropped",
];

/** เรียงจากโอกาสมากไปน้อย — ใช้ทั้งกระดานติดตามและ dropdown */
export const CHANCE_ORDER: Chance[] = ["high", "medium", "low"];

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  follow_up: "ติดตามอีกครั้ง",
  dropped: "ไม่เอาแล้ว",
  bought_other: "ได้รถที่อื่นแล้ว",
  closed_won: "ปิดการขายแล้ว",
};

export const CHANCE_LABEL: Record<Chance, string> = {
  high: "สูง",
  medium: "กลาง",
  low: "น้อย",
};

/** สีป้ายสถานะ ใช้ร่วมกันทุกหน้า จะได้ไม่เพี้ยนกัน */
export const WORK_STATUS_CLASS: Record<WorkStatus, string> = {
  follow_up: "bg-sky-100 text-sky-700",
  dropped: "bg-slate-200 text-slate-600",
  bought_other: "bg-orange-100 text-orange-700",
  closed_won: "bg-emerald-100 text-emerald-700",
};

/** ข้อ 1.11 — โอกาสสูงเขียว กลางเหลือง น้อยแดง (ผู้ใช้ระบุสีมาโดยตรง) */
export const CHANCE_CLASS: Record<Chance, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
};

/** สีจุดนำหน้าในกระดานติดตาม (เขียว/เหลือง/แดง แบบทึบ เห็นชัดบนมือถือ) */
export const CHANCE_DOT_CLASS: Record<Chance, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-rose-500",
};

/** เส้นขอบซ้ายของการ์ดในกระดานติดตาม */
export const CHANCE_BORDER_CLASS: Record<Chance, string> = {
  high: "border-l-4 border-l-emerald-500",
  medium: "border-l-4 border-l-amber-500",
  low: "border-l-4 border-l-rose-500",
};

/** งานที่ยังต้องตามต่อ (ใช้แยก "ลูกค้าที่สนใจจริง" ออกจากที่จบไปแล้ว) */
export function isOpenStatus(status: WorkStatus): boolean {
  return status === "follow_up";
}

/** จำนวนวันที่ยังไม่ติดตาม Lead โอกาสสูง แล้วถือว่าน่าห่วง (ใช้บน dashboard) */
export const HOT_LEAD_SILENT_DAYS = 7;

// ---------- ใบ Lead (หน้าจอ 1) ----------

export type Lead = {
  id: string;
  doc_no: string;
  lead_date: string;
  owner_id: string | null;
  owner_name: string | null;
  customer_id: string | null;
  customer_name: string;
  phone: string | null;
  brand_id: string | null;
  model_id: string | null;
  note: string | null;
  channel_id: string | null;
  channel_other: string | null;
  work_status: WorkStatus;
  chance: Chance;
  next_follow_date: string | null;
  sale_contract_no: string | null;
  sale_date: string | null;
  branch_id: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบ Lead พร้อมชื่อที่ join มาแล้ว (มาจาก view v_ld_leads) */
export type LeadRow = Lead & {
  customer_code: string | null;
  channel_name: string | null;
  branch_name: string | null;
  company_name: string | null;
  brand_name: string | null;
  model_name: string | null;
  owner_full_name: string | null;
  follow_count: number;
  last_follow_date: string | null;
};

/** ค่าที่ฟอร์มส่งมาบันทึก (ยังไม่มีเลขที่เอกสาร — ระบบรันให้ตอนบันทึก) */
export type LeadInput = Omit<Lead, "id" | "doc_no" | "created_at" | "updated_at">;

// ---------- ใบติดตาม (หน้าจอ 2) ----------

export type FollowUp = {
  id: string;
  doc_no: string;
  follow_date: string;
  lead_id: string;
  detail: string | null;
  next_follow_date: string | null;
  work_status: WorkStatus | null;
  chance: Chance | null;
  sale_contract_no: string | null;
  sale_date: string | null;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpRow = FollowUp & {
  lead_no: string;
  customer_name: string;
  lead_owner_id: string | null;
  recorded_by_full_name: string | null;
};

export type FollowUpInput = Omit<FollowUp, "id" | "doc_no" | "created_at" | "updated_at">;

// ---------- เงื่อนไขค้นหา ----------

/** เงื่อนไขของหน้ารายการ (1) กระดานติดตาม (2) หน้าสอบถาม (3) และ dashboard (4) */
export type LeadQuery = {
  keyword?: string;
  owner_id?: string | null;
  branch_id?: string | null;
  company_id?: string | null;
  brand_id?: string | null;
  model_id?: string | null;
  channel_id?: string | null;
  work_status?: WorkStatus | null;
  chance?: Chance | null;
  /** ช่วงวันที่รับ Lead */
  from?: string | null;
  to?: string | null;
  /** เฉพาะที่เลยวันนัดติดตามแล้ว */
  overdue_only?: boolean;
  limit?: number;
};

/** ตัวเลือกสำหรับ dropdown (ลูกค้า/ยี่ห้อ/รุ่น/ช่องทาง/พนักงาน/สาขา) */
export type LeadOption = { id: string; name: string };

// ---------- กระดานติดตาม (หน้าจอ 2) ----------

/** Lead กลุ่มหนึ่งภายในสถานะงานเดียวกัน แยกตามสถานะโอกาส */
export type ChanceGroupView = { chance: Chance; rows: LeadRow[] };

/** หนึ่งคอลัมน์ของกระดานติดตาม = หนึ่งสถานะงาน */
export type BoardColumnView = { status: WorkStatus; total: number; groups: ChanceGroupView[] };

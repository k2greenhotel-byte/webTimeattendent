/**
 * ชนิดข้อมูลของระบบข้อมูล Lead — ตรงกับตาราง ld_* (migration 0020 + 0022)
 *
 * สถานะงาน (1.10) และสถานะโอกาส (1.11) ไม่ได้ตายตัวในโค้ดแล้ว — เก็บเป็นตารางข้อมูลหลัก
 * ที่ผู้มีสิทธิ์เพิ่ม/แก้ไขได้เองที่หน้า /leads/setup
 * โค้ดจึงอ้าง "พฤติกรรม" (kind) ไม่ใช่ชื่อสถานะ และอ้างสีจากชุดสีที่กำหนดไว้ในไฟล์นี้
 */

// ---------- สถานะงาน / สถานะโอกาส ----------

/** รหัสสถานะ (ค่าใน ld_work_statuses.code / ld_chances.code) */
export type WorkStatus = string;
export type Chance = string;

/**
 * พฤติกรรมของสถานะงาน — ตัวตัดสินใจของกฎธุรกิจทั้งหมด
 *   open = ยังต้องติดตามต่อ · won = ปิดการขายได้ (ต้องมีเลขที่สัญญาขาย) · lost = จบแล้วแต่ไม่ได้ขาย
 */
export type StatusKind = "open" | "won" | "lost";

export const STATUS_KIND_ORDER: StatusKind[] = ["open", "won", "lost"];

export const STATUS_KIND_LABEL: Record<StatusKind, string> = {
  open: "ยังต้องติดตาม",
  won: "ปิดการขายได้",
  lost: "จบแล้ว ไม่ได้ขาย",
};

export const STATUS_KIND_HINT: Record<StatusKind, string> = {
  open: "ขึ้นในกระดานติดตามและนับเป็นงานค้าง ตั้งวันนัดติดตามต่อได้",
  won: "ต้องกรอกเลขที่สัญญาขายและวันที่ขาย · ใช้คิดอัตราการปิดการขาย",
  lost: "ออกจากรายการที่ต้องติดตาม แต่ยังเก็บไว้เป็นประวัติ",
};

/** หนึ่งสถานะงานจากตาราง ld_work_statuses */
export type WorkStatusOption = {
  code: string;
  name: string;
  kind: StatusKind;
  color: ColorKey;
  sort_order: number;
  is_active: boolean;
  /** สถานะตั้งต้นของระบบ — เปลี่ยนชื่อ/สี/ลำดับได้ แต่ลบไม่ได้ */
  is_system: boolean;
};

/** หนึ่งสถานะโอกาสจากตาราง ld_chances (sort_order น้อย = โอกาสสูงกว่า) */
export type ChanceOption = {
  code: string;
  name: string;
  color: ColorKey;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
};

export type WorkStatusInput = Omit<WorkStatusOption, "is_system">;
export type ChanceInput = Omit<ChanceOption, "is_system">;

// ---------- ชุดสีที่เลือกได้ ----------

/**
 * เก็บเป็นชื่อชุดสี ไม่ใช่คลาส CSS เพราะ Tailwind ต้องเห็นชื่อคลาสเต็ม ๆ ตอน build
 * (ต่อสตริงเองตอนรันจะได้ป้ายไม่มีสี)
 */
export type ColorKey =
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "slate"
  | "orange"
  | "violet"
  | "teal";

export const COLOR_ORDER: ColorKey[] = [
  "emerald",
  "amber",
  "rose",
  "sky",
  "orange",
  "violet",
  "teal",
  "slate",
];

export const COLOR_LABEL: Record<ColorKey, string> = {
  emerald: "เขียว (โอกาสสูง / สำเร็จ)",
  amber: "เหลือง (ปานกลาง / รอดำเนินการ)",
  rose: "แดง (โอกาสน้อย / ต้องระวัง)",
  sky: "ฟ้า (กำลังดำเนินการ)",
  orange: "ส้ม",
  violet: "ม่วง",
  teal: "เขียวน้ำทะเล",
  slate: "เทา (ปิดงาน / ไม่ใช้แล้ว)",
};

export const BADGE_CLASS: Record<ColorKey, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
  orange: "bg-orange-100 text-orange-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
  slate: "bg-slate-200 text-slate-600",
};

export const DOT_CLASS: Record<ColorKey, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  slate: "bg-slate-400",
};

export const BORDER_CLASS: Record<ColorKey, string> = {
  emerald: "border-l-4 border-l-emerald-500",
  amber: "border-l-4 border-l-amber-500",
  rose: "border-l-4 border-l-rose-500",
  sky: "border-l-4 border-l-sky-500",
  orange: "border-l-4 border-l-orange-500",
  violet: "border-l-4 border-l-violet-500",
  teal: "border-l-4 border-l-teal-500",
  slate: "border-l-4 border-l-slate-400",
};

/** สีที่ไม่รู้จัก (ข้อมูลเก่า/พิมพ์เอง) ให้ตกมาที่เทา แทนที่จะพังทั้งหน้า */
export function colorOf(value: string | null | undefined): ColorKey {
  return value && value in BADGE_CLASS ? (value as ColorKey) : "slate";
}

/** จำนวนวันที่ยังไม่ติดตาม Lead โอกาสสูงสุด แล้วถือว่าน่าห่วง (ใช้บน dashboard) */
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
  work_status_name: string | null;
  work_status_kind: StatusKind | null;
  work_status_color: string | null;
  work_status_sort: number | null;
  chance_name: string | null;
  chance_color: string | null;
  chance_sort: number | null;
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
  work_status_name: string | null;
  work_status_color: string | null;
  chance_name: string | null;
  chance_color: string | null;
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
export type ChanceGroupView = { chance: ChanceOption; rows: LeadRow[] };

/** หนึ่งคอลัมน์ของกระดานติดตาม = หนึ่งสถานะงาน */
export type BoardColumnView = {
  status: WorkStatusOption;
  total: number;
  groups: ChanceGroupView[];
};

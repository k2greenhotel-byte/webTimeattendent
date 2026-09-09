/**
 * ชนิดข้อมูลของระบบตรวจสอบสาขา — ตรงกับตาราง insp_* (migration 0047)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- สถานะและตัวเลือก ----------

/** ชนิดของรายการตรวจ — เลือกตัวเลือกที่ตั้งไว้ หรือให้คะแนนเป็นระดับ 0 ถึงคะแนนเต็ม */
export type InspItemType = "choice" | "rating";

export const INSP_ITEM_TYPE_ORDER: InspItemType[] = ["choice", "rating"];

export const INSP_ITEM_TYPE_LABEL: Record<InspItemType, string> = {
  choice: "เลือกตัวเลือก",
  rating: "ให้คะแนนเป็นระดับ",
};

export const INSP_ITEM_TYPE_HINT: Record<InspItemType, string> = {
  choice: "ผู้ตรวจเลือกหนึ่งข้อจากตัวเลือกที่ตั้งไว้ แต่ละตัวเลือกมีคะแนนและค่าปรับของตัวเอง",
  rating: "ผู้ตรวจให้คะแนนเองตั้งแต่ 0 ถึงคะแนนเต็ม เช่น ความสะอาด 0-2 คะแนน",
};

/** สถานะของใบตรวจ */
export type InspStatus = "draft" | "submitted" | "cancelled";

export const INSP_STATUS_ORDER: InspStatus[] = ["draft", "submitted", "cancelled"];

export const INSP_STATUS_LABEL: Record<InspStatus, string> = {
  draft: "ฉบับร่าง",
  submitted: "ส่งผลแล้ว",
  cancelled: "ยกเลิก",
};

export const INSP_STATUS_CLASS: Record<InspStatus, string> = {
  draft: "bg-slate-200 text-slate-600",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

/** จำนวนรูปสูงสุดต่อหนึ่งรายการตรวจ */
export const INSP_MAX_PHOTOS = 6;

/** เกรดของคะแนนที่ได้ — ใช้ทั้งหน้ารายการ dashboard และจอ War Room */
export type InspGrade = "good" | "fair" | "poor";

export const INSP_GRADE_LABEL: Record<InspGrade, string> = {
  good: "ผ่านเกณฑ์ดี",
  fair: "พอใช้",
  poor: "ต้องปรับปรุง",
};

export const INSP_GRADE_CLASS: Record<InspGrade, string> = {
  good: "bg-emerald-100 text-emerald-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-rose-100 text-rose-700",
};

/** เส้นแบ่งเกรดเป็นเปอร์เซ็นต์ของคะแนนเต็ม */
export const INSP_GRADE_CUTOFF = { good: 90, fair: 75 } as const;

// ---------- โครงแบบฟอร์ม (หน้าจอตั้งค่า ข้อ 4) ----------

export type InspTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** ได้คะแนนตั้งแต่ค่านี้ขึ้นไป รับเงินรางวัล (null = ไม่มีเกณฑ์รางวัล) */
  bonus_threshold: number | null;
  bonus_amount: number;
  footer_note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type InspSection = {
  id: string;
  template_id: string;
  code: string;
  name: string;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type InspItem = {
  id: string;
  section_id: string;
  code: string;
  name: string;
  item_type: InspItemType;
  /** ใช้เฉพาะ rating — choice คิดคะแนนเต็มจากตัวเลือกที่ให้คะแนนสูงสุด */
  max_score: number;
  require_photo: boolean;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type InspItemOption = {
  id: string;
  item_id: string;
  code: string;
  label: string;
  score: number;
  fine_amount: number;
  sort_order: number;
  is_active: boolean;
};

/** แบบฟอร์มหนึ่งชุดที่ประกอบเสร็จแล้ว — หน้าบันทึกและหน้าตั้งค่าใช้รูปนี้ */
export type InspForm = {
  template: InspTemplate;
  sections: (InspSection & {
    items: (InspItem & { options: InspItemOption[]; maxScore: number })[];
    maxScore: number;
  })[];
  maxScore: number;
};

// ---------- ค่าที่ฟอร์มตั้งค่าส่งมาบันทึก ----------

export type InspTemplateInput = Omit<InspTemplate, "id">;
export type InspSectionInput = Omit<InspSection, "id">;
export type InspItemInput = Omit<InspItem, "id">;
export type InspItemOptionInput = Omit<InspItemOption, "id">;

// ---------- ใบตรวจ (หน้าจอบันทึก ข้อ 1) ----------

export type Inspection = {
  id: string;
  doc_no: string;
  inspect_date: string;
  template_id: string | null;
  template_code: string | null;
  template_name: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  status: InspStatus;
  total_score: number;
  max_score: number;
  score_pct: number;
  total_fine: number;
  bonus_amount: number;
  fail_count: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบตรวจพร้อมชื่อที่ join มาแล้ว (มาจาก view v_insp_inspections) */
export type InspectionRow = Inspection & {
  company_ref_name: string | null;
  branch_ref_name: string | null;
  branch_code: string | null;
  inspector_full_name: string | null;
  result_count: number;
  photo_count: number;
};

/** ผลรายข้อบนใบตรวจ */
export type InspResult = {
  id: string;
  inspection_id: string;
  item_id: string | null;
  section_name: string;
  section_sort: number;
  item_name: string;
  item_type: InspItemType;
  option_id: string | null;
  option_label: string | null;
  score: number;
  max_score: number;
  fine_amount: number;
  note: string | null;
  sort_order: number;
};

/** ผลรายข้อพร้อมรูปที่แนบไว้ */
export type InspResultRow = InspResult & { photos: string[] };

/** หนึ่งบรรทัดที่ฟอร์มบันทึกส่งกลับมา (ยังไม่มี id) */
export type InspResultInput = {
  item_id: string | null;
  section_name: string;
  section_sort: number;
  item_name: string;
  item_type: InspItemType;
  option_id: string | null;
  option_label: string | null;
  score: number;
  max_score: number;
  fine_amount: number;
  note: string | null;
  sort_order: number;
  photos: string[];
};

/** ส่วนหัวของใบตรวจที่ฟอร์มส่งมา (คะแนนรวมคำนวณฝั่ง server เสมอ) */
export type InspectionInput = {
  inspect_date: string;
  template_id: string | null;
  template_code: string | null;
  template_name: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  status: InspStatus;
  note: string | null;
};

/** เงื่อนไขของหน้าจอรายการ สอบถาม และ dashboard */
export type InspectionQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  template_id?: string | null;
  status?: InspStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

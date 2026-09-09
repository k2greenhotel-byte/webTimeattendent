/**
 * ชนิดข้อมูลของระบบตรวจเช็คโรงแรมประจำวัน — ตรงกับตาราง htl_* (migration 0052)
 * ข้อความไทยและสีป้ายของทุกสถานะอยู่ในไฟล์นี้ที่เดียว ทุกหน้าจออ่านจากชุดนี้
 */

// ---------- ผลการตรวจรายข้อ ----------

/** ปกติ/ผ่าน · ไม่ปกติ/ไม่ผ่าน · ไม่มีรายการนี้ในสาขา (ไม่ต้องตรวจ) */
export type HtlResultValue = "pass" | "fail" | "na";

export const HTL_RESULT_ORDER: HtlResultValue[] = ["pass", "fail", "na"];

export const HTL_RESULT_LABEL: Record<HtlResultValue, string> = {
  pass: "ปกติ / ผ่าน",
  fail: "ไม่ปกติ / ไม่ผ่าน",
  na: "ไม่มี / ไม่ได้ตรวจ",
};

/** สีป้ายผลการตรวจ — เขียว = ปกติ · แดง = ไม่ปกติ (ตามที่ผู้ใช้กำหนด) */
export const HTL_RESULT_CLASS: Record<HtlResultValue, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  fail: "bg-rose-100 text-rose-700",
  na: "bg-slate-200 text-slate-600",
};

/** สีปุ่มตอนถูกเลือกในหน้าบันทึก — ต้องเห็นชัดจากระยะไกลบนมือถือกลางแดด */
export const HTL_RESULT_PICKED_CLASS: Record<HtlResultValue, string> = {
  pass: "border-emerald-500 bg-emerald-500 text-white",
  fail: "border-rose-500 bg-rose-500 text-white",
  na: "border-slate-400 bg-slate-400 text-white",
};

// ---------- ความเร่งด่วนที่ต้องแก้ไข ----------

/** urgent = เร่งด่วนทันที (แดง) · soon = ภายใน 1-2 วัน (เหลือง) · later = 3 วันขึ้นไป (น้ำเงิน) */
export type HtlPriority = "urgent" | "soon" | "later";

export const HTL_PRIORITY_ORDER: HtlPriority[] = ["urgent", "soon", "later"];

export const HTL_PRIORITY_LABEL: Record<HtlPriority, string> = {
  urgent: "เร่งด่วนทันที",
  soon: "ภายใน 1-2 วัน",
  later: "ภายใน 3 วันขึ้นไป",
};

export const HTL_PRIORITY_CLASS: Record<HtlPriority, string> = {
  urgent: "bg-rose-100 text-rose-700",
  soon: "bg-amber-100 text-amber-700",
  later: "bg-sky-100 text-sky-700",
};

export const HTL_PRIORITY_PICKED_CLASS: Record<HtlPriority, string> = {
  urgent: "border-rose-500 bg-rose-500 text-white",
  soon: "border-amber-500 bg-amber-500 text-white",
  later: "border-sky-500 bg-sky-500 text-white",
};

/** ต้องแก้ให้เสร็จภายในกี่วันนับจากวันที่ตรวจพบ — ใช้คิดว่าเลยกำหนดแล้วหรือยัง */
export const HTL_PRIORITY_DAYS: Record<HtlPriority, number> = {
  urgent: 0,
  soon: 2,
  later: 7,
};

// ---------- สถานะใบตรวจ ----------

export type HtlRoundStatus = "draft" | "submitted" | "cancelled";

export const HTL_STATUS_ORDER: HtlRoundStatus[] = ["draft", "submitted", "cancelled"];

export const HTL_STATUS_LABEL: Record<HtlRoundStatus, string> = {
  draft: "ฉบับร่าง",
  submitted: "ส่งผลแล้ว",
  cancelled: "ยกเลิก",
};

export const HTL_STATUS_CLASS: Record<HtlRoundStatus, string> = {
  draft: "bg-slate-200 text-slate-600",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

// ---------- ขอบเขตของงานตรวจ ----------

/** building = ตรวจอาคารทั้งสาขา · room = ตรวจห้องพักรายห้อง */
export type HtlScope = "building" | "room";

export const HTL_SCOPE_ORDER: HtlScope[] = ["building", "room"];

export const HTL_SCOPE_LABEL: Record<HtlScope, string> = {
  building: "ตรวจอาคาร (ทั้งสาขา)",
  room: "ตรวจห้องพัก (รายห้อง)",
};

export const HTL_SCOPE_SHORT: Record<HtlScope, string> = {
  building: "อาคาร",
  room: "ห้องพัก",
};

export const HTL_SCOPE_CLASS: Record<HtlScope, string> = {
  building: "bg-slate-100 text-slate-600",
  room: "bg-violet-100 text-violet-700",
};

/** เลขที่เอกสารแยกชุดกันตามขอบเขตงาน */
export const HTL_DOC_PREFIX: Record<HtlScope, string> = {
  building: "HTC",
  room: "HTR",
};

/** จำนวนรูปสูงสุดต่อหนึ่งรายการตรวจ */
export const HTL_MAX_PHOTOS = 6;

/** ช่วงสรุปของหน้า Dashboard */
export type HtlPeriodMode = "day" | "week" | "month";

export const HTL_PERIOD_MODE_ORDER: HtlPeriodMode[] = ["day", "week", "month"];

export const HTL_PERIOD_MODE_LABEL: Record<HtlPeriodMode, string> = {
  day: "รายวัน",
  week: "รายสัปดาห์",
  month: "รายเดือน",
};

// ---------- ตั้งค่ารายการตรวจ (หน้าจอ 5) ----------

export type HtlGroup = {
  id: string;
  code: string;
  name: string;
  note: string | null;
  scope: HtlScope;
  sort_order: number;
  is_active: boolean;
};

export type HtlItem = {
  id: string;
  group_id: string;
  code: string;
  name: string;
  note: string | null;
  /** null = ใช้กับทุกสาขา · ใส่ค่า = รายการเฉพาะของสาขานั้น */
  branch_id: string | null;
  scope: HtlScope;
  require_photo: boolean;
  require_photo_on_fail: boolean;
  default_priority: HtlPriority;
  sort_order: number;
  is_active: boolean;
};

export type HtlGroupInput = Omit<HtlGroup, "id">;
export type HtlItemInput = Omit<HtlItem, "id">;

/** รายการตรวจทั้งชุดที่ประกอบเสร็จแล้ว — หน้าบันทึกและหน้าตั้งค่าใช้รูปนี้ */
export type HtlChecklist = {
  groups: (HtlGroup & { items: HtlItem[] })[];
  itemCount: number;
};

// ---------- ห้องพัก (ตั้งค่าที่ /hotel/setup/rooms) ----------

export type HtlRoom = {
  id: string;
  branch_id: string;
  /** เบอร์ห้องที่ช่างเรียกกันจริง เช่น V1, 801 */
  code: string;
  /** ชื่อ/ประเภทห้อง เช่น พูลวิลล่า 2 ห้องนอน */
  name: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type HtlRoomInput = Omit<HtlRoom, "id">;

/** ห้องพร้อมชื่อสาขา — ใช้ในหน้าตั้งค่าและ dropdown เลือกห้อง */
export type HtlRoomRow = HtlRoom & { branch_name: string | null };

// ---------- ใบตรวจเช็คประจำวัน (หน้าจอ 1 และ 2) ----------

export type HtlRound = {
  id: string;
  doc_no: string;
  check_date: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  /** null = ใบตรวจอาคารทั้งสาขา · มีค่า = ใบตรวจห้องพักห้องนั้น */
  room_id: string | null;
  room_code: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  status: HtlRoundStatus;
  total_items: number;
  checked_count: number;
  pass_count: number;
  fail_count: number;
  na_count: number;
  urgent_count: number;
  soon_count: number;
  later_count: number;
  open_fix_count: number;
  pass_pct: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบตรวจพร้อมชื่อที่ join มาแล้ว (มาจาก view v_htl_rounds) */
export type HtlRoundRow = HtlRound & {
  company_ref_name: string | null;
  branch_ref_name: string | null;
  branch_code: string | null;
  room_ref_code: string | null;
  room_name: string | null;
  inspector_full_name: string | null;
  photo_count: number;
};

/** ผลรายข้อบนใบตรวจ */
export type HtlResult = {
  id: string;
  round_id: string;
  item_id: string | null;
  group_name: string;
  group_sort: number;
  item_name: string;
  sort_order: number;
  /** null = ยังไม่ได้ตรวจข้อนี้ */
  result: HtlResultValue | null;
  note: string | null;
  priority: HtlPriority | null;
  is_fixed: boolean;
  fixed_at: string | null;
  fixed_note: string | null;
  repair_id: string | null;
  repair_doc_no: string | null;
};

export type HtlResultRow = HtlResult & { photos: string[] };

/** หนึ่งบรรทัดที่ฟอร์มบันทึกส่งกลับมา (ยังไม่มี id) */
export type HtlResultInput = {
  item_id: string | null;
  group_name: string;
  group_sort: number;
  item_name: string;
  sort_order: number;
  result: HtlResultValue | null;
  note: string | null;
  priority: HtlPriority | null;
  is_fixed: boolean;
  fixed_note: string | null;
  repair_id: string | null;
  repair_doc_no: string | null;
  photos: string[];
};

/** ส่วนหัวของใบตรวจที่ฟอร์มส่งมา (ยอดสรุปคำนวณฝั่ง server เสมอ) */
export type HtlRoundInput = {
  check_date: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  room_id: string | null;
  room_code: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  status: HtlRoundStatus;
  note: string | null;
};

// ---------- ข้อที่ต้องแก้ไข (หน้าจอ 2 และจอ War Room) ----------

/** หนึ่งแถวจาก view v_htl_issues — ข้อที่ตรวจแล้วผลออกมาไม่ปกติ */
export type HtlIssueRow = {
  result_id: string;
  round_id: string;
  item_id: string | null;
  group_name: string;
  group_sort: number;
  item_name: string;
  sort_order: number;
  note: string | null;
  priority: HtlPriority | null;
  is_fixed: boolean;
  fixed_at: string | null;
  fixed_note: string | null;
  repair_id: string | null;
  repair_doc_no: string | null;
  doc_no: string;
  check_date: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  room_id: string | null;
  room_code: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  status: HtlRoundStatus;
  photo_count: number;
  repair_ref_no: string | null;
  repair_job_status: string | null;
};

// ---------- เงื่อนไขค้นหา ----------

export type HtlRoundQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  room_id?: string | null;
  /** null/undefined = ทั้งใบตรวจอาคารและใบตรวจห้องพัก */
  scope?: HtlScope | null;
  status?: HtlRoundStatus | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export type HtlIssueQuery = {
  keyword?: string;
  company_id?: string | null;
  branch_id?: string | null;
  room_id?: string | null;
  group_name?: string | null;
  priority?: HtlPriority | null;
  /** true = เฉพาะที่แก้แล้ว · false = เฉพาะที่ยังค้าง · null/undefined = ทั้งหมด */
  fixed?: boolean | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

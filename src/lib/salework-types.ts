/** ชนิดข้อมูลของระบบบันทึกงานประจำวันพนักงานขาย — ตรงกับตาราง sw_* ในฐานข้อมูล */

/** ประเภทงานที่แอดมินตั้งเอง (2 ระดับ: หัวข้อ → งานย่อย) */
export type TaskType = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
  /** ชื่อช่องตัวเลขที่ให้กรอก เช่น "จำนวนใบปลิวที่แจก" (null = งานนี้ไม่ต้องกรอกตัวเลข) */
  metric_label: string | null;
  metric_unit: string | null;
  require_metric: boolean;
  require_media: boolean;
  allow_link: boolean;
  daily_target: number | null;
  sort_order: number;
  is_active: boolean;
};

export type TaskTypeInput = Omit<TaskType, "id">;

/** ประเภทงานที่จัดเป็นชั้นแล้ว — หัวข้อหนึ่งอันพร้อมงานย่อยของมัน */
export type TaskGroup = {
  /** หัวข้อ (งานเดี่ยวที่ไม่มีลูกก็มาเป็นหัวข้อที่ไม่มี children) */
  head: TaskType;
  children: TaskType[];
};

export type MediaKind = "image" | "video";

export type ItemMedia = {
  id: string;
  item_id: string;
  path: string;
  kind: MediaKind;
  filename: string | null;
  mime: string | null;
  size_bytes: number | null;
  sort_order: number;
};

/** ไฟล์แนบที่ฟอร์มส่งกลับมา (ยังไม่มี id เพราะเพิ่งอัปโหลด) */
export type MediaInput = {
  path: string;
  kind: MediaKind;
  filename: string | null;
  mime: string | null;
  size_bytes: number | null;
};

/** บรรทัดงานหนึ่งบรรทัดในใบ */
export type LogItem = {
  id: string;
  log_id: string;
  task_type_id: string | null;
  task_code: string;
  task_name: string;
  metric_label: string | null;
  metric_unit: string | null;
  done: boolean;
  qty: number | null;
  detail: string | null;
  link_url: string | null;
  sort_order: number;
};

export type LogItemInput = Omit<LogItem, "id" | "log_id"> & { media: MediaInput[] };

/** บรรทัดงานพร้อมไฟล์แนบ (ที่หน้าจอใช้จริง) */
export type LogItemRow = LogItem & { media: ItemMedia[] };

/** ใบบันทึกงานประจำวัน */
export type WorkLog = {
  id: string;
  doc_no: string;
  work_date: string;
  owner_id: string | null;
  owner_name: string;
  branch_id: string | null;
  company_id: string | null;
  note: string | null;
  submitted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** ใบงานที่มาจาก view (มีชื่อเต็ม/สาขา/ตัวนับมาด้วย) */
export type WorkLogRow = WorkLog & {
  owner_full_name: string | null;
  owner_emp_code: string | null;
  branch_name: string | null;
  company_name: string | null;
  item_count: number;
  done_count: number;
  media_count: number;
};

/** ใบงานพร้อมบรรทัดงานทั้งหมด — ใช้ในหน้าบันทึกและหน้ารายละเอียด */
export type WorkLogDetail = { log: WorkLogRow; items: LogItemRow[] };

/** ค่าที่ฟอร์มบันทึกส่งมาหนึ่งครั้ง */
export type WorkLogInput = {
  work_date: string;
  owner_id: string | null;
  owner_name: string;
  branch_id: string | null;
  company_id: string | null;
  note: string | null;
  submit: boolean;
  items: LogItemInput[];
};

/** เงื่อนไขค้นใบงาน */
export type WorkLogQuery = {
  owner_id?: string | null;
  branch_id?: string | null;
  company_id?: string | null;
  from?: string;
  to?: string;
  /** true = เฉพาะที่ส่งงานแล้ว · false = เฉพาะฉบับร่าง */
  submitted?: boolean;
  keyword?: string;
  limit?: number;
};

/** บรรทัดงานที่ join ข้อมูลใบมาแล้ว (view v_sw_items) — ใช้ทำ dashboard */
export type ItemStatRow = {
  task_type_id: string | null;
  task_code: string;
  task_name: string;
  metric_unit: string | null;
  done: boolean;
  qty: number | null;
  media_count: number;
  work_date: string;
  owner_id: string | null;
  owner_name: string;
  owner_full_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  submitted_at: string | null;
};

/** สรุปผลงานของพนักงานขายหนึ่งคนในช่วงที่เลือก */
export type StaffSummary = {
  /** กุญแจประจำตัวที่ใช้อ้างอิงข้ามตาราง (owner_id ถ้ามี ไม่งั้นใช้ชื่อ) */
  key: string;
  owner_id: string | null;
  owner_name: string;
  branch_name: string | null;
  /** จำนวนวันที่มีใบงาน และจำนวนวันที่ส่งงานแล้ว */
  days: number;
  submittedDays: number;
  doneCount: number;
  itemCount: number;
  mediaCount: number;
  /** ผลรวมตัวเลขแยกตามประเภทงาน (key = task_code) */
  qtyByTask: Record<string, number>;
  /** เปอร์เซ็นต์งานที่ทำจากงานทั้งหมดที่อยู่ในใบ */
  donePct: number;
  /** ยอดขายจริงจากระบบขาย (Db2) — มีค่าเมื่อจับคู่ SALCOD ไว้แล้วและต่อ Db2 ติด */
  db2Units?: number | null;
  db2Salcod?: string | null;
};

/**
 * งานหนึ่งประเภท แยกยอดตามพนักงาน — ใช้เทียบว่าใครทำงานประเภทนั้นไปกี่ % ของยอดรวม
 * เช่น โพสต์ Facebook รวมทั้งร้าน 62 งาน น้องนุชทำ 10 งาน = 16%
 */
export type TaskMatrixRow = {
  task_code: string;
  task_name: string;
  /** งานที่ทำแล้วรวมทุกคนของประเภทนี้ (ตัวหารของ %) */
  total: number;
  /** จำนวนงานที่ทำแล้ว แยกตามพนักงาน — key ตรงกับ StaffSummary.key */
  byStaff: Record<string, number>;
};

/** สรุปผลงานรายประเภทงาน (ทุกคนรวมกัน) */
export type TaskSummary = {
  task_code: string;
  task_name: string;
  metric_unit: string | null;
  doneCount: number;
  itemCount: number;
  qty: number;
  staffCount: number;
};

/** การจับคู่ผู้ใช้เว็บกับพนักงานขายในระบบขาย (Db2) */
export type SalesmanMap = {
  id: string;
  employee_id: string;
  db2_salcod: string;
  db2_name: string | null;
  note: string | null;
  updated_at: string;
};

/** หนึ่งแถวบนหน้าจอจับคู่ — บัญชีผู้ใช้ + คู่ที่จับไว้ (ถ้ามี) */
export type MapRow = {
  employee_id: string;
  emp_code: string;
  full_name: string;
  access_level: string;
  branch_name: string | null;
  is_active: boolean;
  db2_salcod: string | null;
  db2_name: string | null;
  note: string | null;
};

/**
 * พนักงานขายหนึ่งคนในระบบขาย (Db2)
 * ปกติมาจากทะเบียนพนักงาน `OFFICER` (มีชื่อครบทุกรหัส)
 * ถ้าแอป Db2 ยังไม่มี endpoint นั้น จะถอยไปใช้ dims.salesman ของ /api/wall ซึ่งมีแค่ salcod/name/units
 */
export type Db2Salesman = {
  salcod: string;
  name: string | null;
  /** จำนวนคันที่ขายได้ในช่วง 365 วันล่าสุด — ใช้แยกว่ารหัสไหนคือพนักงานขายตัวจริง */
  units: number;
  /** สาขาที่สังกัดตามทะเบียนพนักงาน */
  branch?: string | null;
  /** ยังทำงานอยู่ไหมตามทะเบียนพนักงาน */
  active?: boolean;
};

/** ชนิดข้อมูลของระบบข้อมูลเบื้องต้น ธุรกิจรถจักรยานยนต์ (ยี่ห้อ รุ่น แบบ สี บริษัท ฯลฯ) */

/** ข้อมูลหลักทั้ง 10 ชุด — ชื่อ kind ใช้อ้างอิงทั้งใน db layer และ URL */
export type MotoMasterKind =
  | "brand"
  | "model"
  | "variant"
  | "color"
  | "vendor"
  | "finance"
  | "income"
  | "expense"
  | "channel"
  | "salesJob";

/** หนึ่งแถวของข้อมูลหลัก — ทุกตารางหน้าตาเหมือนกัน ต่างกันแค่ช่องอ้างอิงตัวแม่ */
export type MotoOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  /** ยี่ห้อของรุ่นรถ (เฉพาะ kind = model) */
  brand_id?: string | null;
  /** รุ่นของแบบรถ (เฉพาะ kind = variant) */
  model_id?: string | null;
};

/** ค่าที่รับจากฟอร์มก่อนบันทึก */
export type MotoMasterInput = {
  code: string;
  name: string;
  is_active: boolean;
  parent_id: string | null;
};

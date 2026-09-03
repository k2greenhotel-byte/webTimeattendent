/** ชนิดข้อมูลของระบบส่วนกลาง (บริษัท สาขา ผู้ใช้งาน สิทธิ์ โปรแกรม) */

export type Company = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  tax_id: string | null;
  is_active: boolean;
};

/** กลุ่มระดับการทำงาน — เรียงจากสิทธิ์มากไปน้อย */
export type AccessLevel = "admin" | "assistant_admin" | "supervisor" | "user";

export const ACCESS_LEVELS: AccessLevel[] = ["admin", "assistant_admin", "supervisor", "user"];

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  admin: "ผู้ดูแลระบบ (Admin)",
  assistant_admin: "ผู้ช่วยผู้ดูแลระบบ",
  supervisor: "หัวหน้างาน",
  user: "ผู้ใช้งานทั่วไป",
};

export const ACCESS_LEVEL_HINT: Record<AccessLevel, string> = {
  admin: "ทำได้ทุกอย่างทุกเมนู รวมถึงกำหนดสิทธิ์ผู้อื่น",
  assistant_admin: "ใช้ได้เกือบทุกเมนู แต่ลบข้อมูลไม่ได้",
  supervisor: "ดูรายงานได้ทั้งหมด บันทึก/แก้ไขได้เฉพาะหน้าจอบันทึก",
  user: "ใช้งานเฉพาะหน้าจอที่ได้รับสิทธิ์",
};

export type MenuKind = "entry" | "inquiry" | "report" | "dashboard" | "setting";

export const MENU_KIND_LABEL: Record<MenuKind, string> = {
  entry: "หน้าจอบันทึก",
  inquiry: "หน้าจอสอบถาม",
  report: "หน้าจอรายงาน",
  dashboard: "Dashboard",
  setting: "หน้าจอตั้งค่า",
};

export type Program = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  path: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProgramMenu = {
  id: string;
  program_id: string;
  code: string;
  name: string;
  path: string | null;
  kind: MenuKind;
  sort_order: number;
  is_active: boolean;
};

/** สิทธิ์ 4 อย่างต่อหนึ่งเมนู */
export type MenuRights = {
  can_read: boolean;
  can_write: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type PermAction = "read" | "write" | "edit" | "delete";

export const PERM_ACTION_LABEL: Record<PermAction, string> = {
  read: "อ่าน",
  write: "เพิ่ม",
  edit: "แก้ไข",
  delete: "ลบ",
};

/** สิทธิ์ที่ resolve แล้วของผู้ใช้หนึ่งคนต่อหนึ่งเมนู (ตรงกับ view v_user_permissions) */
export type EffectiveMenuPermission = MenuRights & {
  program_code: string;
  program_name: string;
  menu_id: string;
  menu_code: string;
  menu_name: string;
  menu_kind: MenuKind;
  menu_path: string | null;
  /** true = ตั้งค่าเฉพาะรายคนไว้ (ไม่ได้ใช้ค่าเริ่มต้นของระดับ) */
  is_override: boolean;
  /** true = มีสิทธิ์เข้าโปรแกรมนี้ตามเมนู "กำหนดผู้ใช้งานโปรแกรม" (ประตูด่านแรกของทุกสิทธิ์) */
  has_program_access: boolean;
};

/** ผู้ใช้งานในมุมของระบบส่วนกลาง */
export type CoreUser = {
  id: string;
  username: string | null;
  emp_code: string;
  full_name: string;
  phone: string | null;
  access_level: AccessLevel;
  is_active: boolean;
  all_companies: boolean;
  all_branches: boolean;
  branch_id: string | null;
  company_ids: string[];
  branch_ids: string[];
  program_ids: string[];
};

/** บริษัท/สาขา ที่ผู้ใช้เลือกเข้าทำงานอยู่ตอนนี้ */
export type WorkContext = {
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
};

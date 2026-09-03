/**
 * กฎเรื่องสิทธิ์ทั้งหมดอยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / middleware เรียกใช้ฟังก์ชันชุดเดียวกันหมด
 *
 * ลำดับการตัดสินสิทธิ์ของหนึ่งเมนู (ตรงกับ view v_user_permissions):
 *   1. ระดับ admin  → ได้ทุกสิทธิ์เสมอ (กันแอดมินล็อกตัวเองออกจากระบบ)
 *   2. ไม่มีสิทธิ์เข้าโปรแกรม (เมนู "กำหนดผู้ใช้งานโปรแกรม") → ไม่มีสิทธิ์ใด ๆ ในโปรแกรมนั้น
 *   3. มีค่าเฉพาะราย (override) → ใช้ค่านั้น
 *   4. ไม่มี → ใช้ค่าเริ่มต้นของกลุ่มระดับการทำงาน (แม่แบบ)
 *   5. ไม่มีอีก → ไม่มีสิทธิ์
 */
import type {
  AccessLevel,
  EffectiveMenuPermission,
  MenuRights,
  PermAction,
} from "./core-types";

export const NO_RIGHTS: MenuRights = {
  can_read: false,
  can_write: false,
  can_edit: false,
  can_delete: false,
};

export const FULL_RIGHTS: MenuRights = {
  can_read: true,
  can_write: true,
  can_edit: true,
  can_delete: true,
};

const FIELD_OF: Record<PermAction, keyof MenuRights> = {
  read: "can_read",
  write: "can_write",
  edit: "can_edit",
  delete: "can_delete",
};

/** รวมสิทธิ์เข้าโปรแกรม + ค่าเฉพาะราย + ค่าเริ่มต้นของระดับ ให้ได้สิทธิ์จริงหนึ่งชุด */
export function resolveRights(
  level: AccessLevel,
  hasProgramAccess: boolean,
  override: MenuRights | null | undefined,
  levelDefault: MenuRights | null | undefined,
): MenuRights {
  if (level === "admin") return { ...FULL_RIGHTS };
  if (!hasProgramAccess) return { ...NO_RIGHTS };
  if (override) return { ...override };
  if (levelDefault) return { ...levelDefault };
  return { ...NO_RIGHTS };
}

/** ผู้ใช้ทำสิ่งนี้กับเมนูนี้ได้หรือไม่ */
export function can(
  perms: Iterable<EffectiveMenuPermission>,
  menuCode: string,
  action: PermAction = "read",
): boolean {
  for (const p of perms) {
    if (p.menu_code === menuCode) return p[FIELD_OF[action]];
  }
  return false;
}

/** เมนูที่ผู้ใช้เปิดดูได้ (มีสิทธิ์อ่าน) เรียงตามโปรแกรมและลำดับเมนู */
export function readableMenus(
  perms: EffectiveMenuPermission[],
): EffectiveMenuPermission[] {
  return perms.filter((p) => p.can_read);
}

/** สรุปว่าเปิดได้กี่เมนูจากทั้งหมด และตั้งค่าเฉพาะรายไว้กี่เมนู — ใช้โชว์ในรายชื่อผู้ใช้ของโปรแกรม */
export function summarizeAccess(perms: Iterable<EffectiveMenuPermission>): {
  readable: number;
  total: number;
  overrides: number;
} {
  let readable = 0;
  let total = 0;
  let overrides = 0;
  for (const p of perms) {
    total += 1;
    if (p.can_read) readable += 1;
    if (p.is_override) overrides += 1;
  }
  return { readable, total, overrides };
}

/** รหัสโปรแกรมที่ผู้ใช้เข้าถึงได้อย่างน้อยหนึ่งเมนู */
export function accessibleProgramCodes(perms: EffectiveMenuPermission[]): string[] {
  const codes: string[] = [];
  for (const p of perms) {
    if (p.can_read && !codes.includes(p.program_code)) codes.push(p.program_code);
  }
  return codes;
}

/**
 * เลือกเมนูที่ตรงกับ path ที่กำลังเปิด — ใช้ตัวที่ path ยาวที่สุดที่ยังเป็น prefix กัน
 * เช่น /marketing/memos/status ต้องเจอเมนู MKT_MEMO_STATUS ไม่ใช่ MKT_MEMO
 */
export function menuForPath(
  perms: EffectiveMenuPermission[],
  pathname: string,
): EffectiveMenuPermission | null {
  let best: EffectiveMenuPermission | null = null;
  for (const p of perms) {
    if (!p.menu_path) continue;
    const isMatch = pathname === p.menu_path || pathname.startsWith(`${p.menu_path}/`);
    if (!isMatch) continue;
    if (!best || p.menu_path.length > (best.menu_path?.length ?? 0)) best = p;
  }
  return best;
}

/** ระดับนี้ถือเป็นผู้ดูแลระบบส่วนกลางหรือไม่ (เข้าเมนู /core ได้) */
export function isCoreAdmin(level: AccessLevel): boolean {
  return level === "admin" || level === "assistant_admin";
}

// ---------- ขอบเขตบริษัท / สาขา ----------

type Scope = { all_companies: boolean; all_branches: boolean; company_ids: string[]; branch_ids: string[] };

export function allowsCompany(scope: Scope, companyId: string): boolean {
  return scope.all_companies || scope.company_ids.includes(companyId);
}

export function allowsBranch(scope: Scope, branchId: string): boolean {
  return scope.all_branches || scope.branch_ids.includes(branchId);
}

/** กรองรายการบริษัทให้เหลือเฉพาะที่ผู้ใช้เข้าทำงานได้ */
export function filterCompanies<T extends { id: string; is_active: boolean }>(
  scope: Scope,
  companies: T[],
): T[] {
  return companies.filter((c) => c.is_active && allowsCompany(scope, c.id));
}

/**
 * กรองสาขาให้เหลือเฉพาะที่ผู้ใช้เข้าทำงานได้ และอยู่ในบริษัทที่เลือก
 * companyId = null หมายถึงยังไม่เลือกบริษัท (คืนทุกสาขาที่มีสิทธิ์)
 */
export function filterBranches<T extends { id: string; is_active: boolean; company_id?: string | null }>(
  scope: Scope,
  branches: T[],
  companyId?: string | null,
): T[] {
  return branches.filter(
    (b) =>
      b.is_active &&
      allowsBranch(scope, b.id) &&
      (!companyId || b.company_id === companyId),
  );
}

import "server-only";
import { redirect } from "next/navigation";
import { getSelectableContext } from "./core-db";
import { PERM_ACTION_LABEL, type MenuRights, type PermAction } from "./core-types";
import { FULL_RIGHTS, can } from "./permissions";
import { checkPermission, getMyPermissions, getSessionUser, isAdminAuthed, requireActiveUser } from "./session";
import type { SessionUser } from "./types";

/**
 * ประตูของหน้าจัดตาราง (ตารางเวร / ตารางบูธ / งานนอกสถานที่)
 *
 * เข้าได้ 2 ทาง:
 *   1. ผ่าน PIN หลังบ้าน → ทำได้ทุกอย่าง (viaAdmin)
 *   2. ล็อกอินเป็นพนักงาน + มีสิทธิ์รายเมนูจากระบบส่วนกลาง
 *      อ่าน = ดูตาราง · เพิ่ม = จัดเป็นชุด/คัดลอก · แก้ไข = แก้ทีละช่อง/บันทึกเวลาให้ · ลบ = ล้างช่วง/ลบงาน
 */
export type MenuAccess = {
  user: SessionUser | null;
  viaAdmin: boolean;
  rights: MenuRights;
  /** สาขาที่ผู้ใช้คนนี้ดูได้ (null = ทุกสาขา) */
  branchIds: Set<string> | null;
};

export async function requireMenuAccess(menuCode: string, action: PermAction = "read"): Promise<MenuAccess> {
  if (await isAdminAuthed()) {
    return { user: await getSessionUser(), viaAdmin: true, rights: FULL_RIGHTS, branchIds: null };
  }

  const user = await requireActiveUser();
  if (!(await checkPermission(menuCode, action))) {
    redirect(
      `/apps?err=${encodeURIComponent(`ไม่มีสิทธิ์${PERM_ACTION_LABEL[action]}ข้อมูลในเมนูนี้ กรุณาติดต่อผู้ดูแลระบบ`)}`,
    );
  }

  const [perms, context] = await Promise.all([getMyPermissions(), getSelectableContext(user.id)]);
  const rights: MenuRights = {
    can_read: can(perms, menuCode, "read"),
    can_write: can(perms, menuCode, "write"),
    can_edit: can(perms, menuCode, "edit"),
    can_delete: can(perms, menuCode, "delete"),
  };
  const branchIds = context.scope.all_branches ? null : new Set(context.branches.map((b) => b.id));
  return { user, viaAdmin: false, rights, branchIds };
}

/**
 * พนักงานคนนี้อยู่ในขอบเขตสาขาของผู้ใช้หรือไม่
 * ใช้กันไม่ให้คนที่ดูแลบางสาขา เปิดดู/แก้ข้อมูลของสาขาอื่นด้วยการเดา URL
 */
export function inBranchScope(access: MenuAccess, branchId: string | null): boolean {
  if (!access.branchIds) return true; // ดูได้ทุกสาขา
  return branchId !== null && access.branchIds.has(branchId);
}

/**
 * ขอบเขตสาขาของผู้ใช้ที่ล็อกอินอยู่ (null = เห็นได้ทุกสาขา)
 * ใช้ใน API route ที่ redirect ไม่ได้ ต้องตอบเป็น 403 แทน
 */
export async function currentBranchScope(): Promise<Set<string> | null> {
  if (await isAdminAuthed()) return null;
  const user = await getSessionUser();
  if (!user) return new Set();
  const context = await getSelectableContext(user.id);
  return context.scope.all_branches ? null : new Set(context.branches.map((b) => b.id));
}

/** สิทธิ์อ่านของเมนูอื่น ๆ ในกลุ่มเดียวกัน — ใช้สร้างแถบเมนูให้ผู้ใช้ทั่วไป */
export async function readableMenuCodes(codes: string[]): Promise<Set<string>> {
  if (await isAdminAuthed()) return new Set(codes);
  const perms = await getMyPermissions();
  return new Set(codes.filter((c) => can(perms, c, "read")));
}

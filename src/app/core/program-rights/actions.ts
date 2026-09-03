"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearProgramOverrides,
  copyOverridesToProgramUsers,
  setUserOverridesForMenus,
} from "@/lib/core-db";
import type { MenuRights } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requireCoreAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(programId: string, userId: string, message: string, isError = false): never {
  const query = new URLSearchParams();
  if (programId) query.set("program", programId);
  if (userId) query.set("user", userId);
  query.set(isError ? "err" : "msg", message);
  redirect(`/core/program-rights?${query.toString()}`);
}

/**
 * บันทึกสิทธิ์รายเมนูของผู้ใช้หนึ่งคน "เฉพาะเมนูของโปรแกรมที่เลือก"
 * แถวที่ติ๊ก "ตามระดับ" = ไม่เก็บ override · override ของโปรแกรมอื่นไม่ถูกแตะ
 */
export async function saveProgramUserRightsForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const programId = str(form, "program_id");
  const userId = str(form, "user_id");
  const userName = str(form, "user_name") || "ผู้ใช้งาน";
  const menuIds = form.getAll("menu_ids").map(String);
  const inherited = new Set(form.getAll("inherit").map(String));

  if (!programId || !userId) back(programId, userId, "ไม่พบโปรแกรมหรือผู้ใช้งาน", true);

  const rights = new Map<string, MenuRights>();
  for (const menuId of menuIds) {
    if (inherited.has(menuId)) continue;
    rights.set(menuId, {
      can_read: form.get(`read__${menuId}`) === "on",
      can_write: form.get(`write__${menuId}`) === "on",
      can_edit: form.get(`edit__${menuId}`) === "on",
      can_delete: form.get(`delete__${menuId}`) === "on",
    });
  }

  try {
    await setUserOverridesForMenus(userId, menuIds, rights);
    await logAudit({
      actor_id: actor.id,
      action: "update_program_user_rights",
      target_table: "user_menu_permissions",
      target_id: userId,
      after: { program_id: programId, overrides: rights.size, inherited: menuIds.length - rights.size },
    });
  } catch (err) {
    back(programId, userId, err instanceof Error ? err.message : "บันทึกสิทธิ์ไม่สำเร็จ", true);
  }

  revalidatePath("/core/program-rights");
  revalidatePath(`/core/users/${userId}`);
  back(
    programId,
    userId,
    `บันทึกสิทธิ์ของ ${userName} แล้ว · กำหนดเฉพาะราย ${rights.size} เมนู · ตามระดับ ${menuIds.length - rights.size} เมนู`,
  );
}

/** คัดลอกสิทธิ์รายเมนูของคนที่เลือกอยู่ ไปให้ทุกคนที่มีสิทธิ์เข้าโปรแกรมนี้ */
export async function copyRightsToProgramForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const programId = str(form, "program_id");
  const userId = str(form, "user_id");
  const userName = str(form, "user_name") || "ผู้ใช้งาน";

  if (!programId || !userId) back(programId, userId, "ไม่พบโปรแกรมหรือผู้ใช้งานต้นทาง", true);
  if (form.get("confirm") !== "on") {
    back(programId, userId, 'ต้องติ๊ก "ยืนยัน" ก่อน — สิทธิ์เดิมของทุกคนในโปรแกรมนี้จะถูกแทนที่', true);
  }

  let affected = 0;
  try {
    ({ affected } = await copyOverridesToProgramUsers(userId, programId));
    await logAudit({
      actor_id: actor.id,
      action: "copy_program_rights",
      target_table: "user_menu_permissions",
      target_id: programId,
      after: { from_user: userId, affected },
    });
  } catch (err) {
    back(programId, userId, err instanceof Error ? err.message : "คัดลอกสิทธิ์ไม่สำเร็จ", true);
  }

  revalidatePath("/core/program-rights");
  back(programId, userId, `คัดลอกสิทธิ์ของ ${userName} ไปให้ผู้ใช้อีก ${affected} คนในโปรแกรมนี้แล้ว`);
}

/** ล้างค่าเฉพาะรายของทุกคนในโปรแกรมนี้ → กลับไปใช้ค่าเริ่มต้นตามระดับ */
export async function resetProgramOverridesForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const programId = str(form, "program_id");
  const userId = str(form, "user_id");

  if (!programId) back(programId, userId, "ไม่พบโปรแกรม", true);
  if (form.get("confirm") !== "on") {
    back(programId, userId, 'ต้องติ๊ก "ยืนยัน" ก่อน — ค่าเฉพาะรายของทุกคนในโปรแกรมนี้จะถูกล้าง', true);
  }

  let affected = 0;
  try {
    ({ affected } = await clearProgramOverrides(programId));
    await logAudit({
      actor_id: actor.id,
      action: "reset_program_rights",
      target_table: "user_menu_permissions",
      target_id: programId,
      after: { affected },
    });
  } catch (err) {
    back(programId, userId, err instanceof Error ? err.message : "รีเซ็ตสิทธิ์ไม่สำเร็จ", true);
  }

  revalidatePath("/core/program-rights");
  back(programId, userId, `รีเซ็ตแล้ว · ผู้ใช้ ${affected} คนกลับไปใช้ค่าเริ่มต้นตามระดับ`);
}

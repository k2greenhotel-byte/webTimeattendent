"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setLevelPermissions } from "@/lib/core-db";
import { ACCESS_LEVELS, type AccessLevel, type MenuRights } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requireCoreAdmin } from "@/lib/session";

function readLevel(value: unknown): AccessLevel {
  const text = String(value ?? "").trim();
  return (ACCESS_LEVELS as string[]).includes(text) ? (text as AccessLevel) : "user";
}

export async function saveLevelPermissionsForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const level = readLevel(form.get("level"));
  const menuIds = form.getAll("menu_ids").map(String);

  const rights = new Map<string, MenuRights>();
  for (const menuId of menuIds) {
    rights.set(menuId, {
      can_read: form.get(`read__${menuId}`) === "on",
      can_write: form.get(`write__${menuId}`) === "on",
      can_edit: form.get(`edit__${menuId}`) === "on",
      can_delete: form.get(`delete__${menuId}`) === "on",
    });
  }

  try {
    await setLevelPermissions(level, rights);
    await logAudit({
      actor_id: actor.id,
      action: "update_level_permissions",
      target_table: "level_menu_permissions",
      target_id: level,
      after: { menus: rights.size },
    });
  } catch (err) {
    redirect(
      `/core/levels?level=${level}&err=` +
        encodeURIComponent(err instanceof Error ? err.message : "บันทึกสิทธิ์ตามระดับไม่สำเร็จ"),
    );
  }

  revalidatePath("/core/levels");
  redirect(
    `/core/levels?level=${level}&msg=` +
      encodeURIComponent(`บันทึกสิทธิ์เริ่มต้นของระดับนี้เรียบร้อยแล้ว (${rights.size} เมนู)`),
  );
}

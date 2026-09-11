"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getLevelPermissions,
  grantUserPrograms,
  listCoreUsers,
  listWallMenus,
  setUserOverridesForMenus,
} from "@/lib/core-db";
import { ACCESS_LEVELS, type AccessLevel, type MenuRights } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requirePermission } from "@/lib/session";

function back(message: string, isError = false, keep: Record<string, string> = {}): never {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v) query.set(k, v);
  query.set(isError ? "err" : "msg", message);
  redirect(`/core/wall-rights?${query.toString()}`);
}

/**
 * บันทึกตารางสิทธิ์จอ War Room ของผู้ใช้ที่แสดงอยู่ (หลายคนพร้อมกัน)
 *   ติ๊ก = เปิดดูจอนั้นได้ · ไม่ติ๊ก = ไม่เห็น
 *   ถ้าค่าที่ติ๊กตรงกับค่าเริ่มต้นของระดับอยู่แล้ว → ไม่เก็บ override (ยังตามระดับ)
 *   ถ้าต่าง → เก็บ override เฉพาะ "อ่าน" ของจอนั้น (จอ War Room ไม่มี เพิ่ม/แก้/ลบ)
 *   ติ๊กให้คนที่ยังไม่มีสิทธิ์เข้าโปรแกรมของจอนั้น → ให้สิทธิ์เข้าโปรแกรมเพิ่มให้ด้วย ไม่งั้นติ๊กแล้วก็ยังเข้าไม่ได้
 */
export async function saveWallRightsForm(form: FormData): Promise<void> {
  const actor = await requirePermission("CORE_WALL", "edit");
  const keep = Object.fromEntries(
    ["q", "company", "branch", "position", "level", "only"].map((k) => [k, String(form.get(k) ?? "").trim()]),
  );
  const userIds = form.getAll("user_ids").map(String).filter(Boolean);
  if (userIds.length === 0) back("ไม่มีผู้ใช้ให้บันทึก", true, keep);

  const [walls, users] = await Promise.all([listWallMenus(), listCoreUsers()]);
  const wallIds = walls.map((w) => w.id);
  const userById = new Map(users.map((u) => [u.id, u]));

  const levelDefaults = new Map<AccessLevel, Map<string, MenuRights>>();
  await Promise.all(
    ACCESS_LEVELS.map(async (level) => levelDefaults.set(level, await getLevelPermissions(level))),
  );

  let saved = 0;
  let overrides = 0;
  let granted = 0;
  try {
    for (const userId of userIds) {
      const user = userById.get(userId);
      if (!user || user.access_level === "admin") continue; // admin เห็นทุกจอเสมอ ไม่ต้องบันทึก

      const defaults = levelDefaults.get(user.access_level) ?? new Map<string, MenuRights>();
      const rights = new Map<string, MenuRights>();
      const programsToGrant = new Set<string>();

      for (const wall of walls) {
        const checked = form.get(`r__${userId}__${wall.id}`) === "on";
        const byLevel = defaults.get(wall.id)?.can_read ?? false;
        if (checked !== byLevel) {
          rights.set(wall.id, { can_read: checked, can_write: false, can_edit: false, can_delete: false });
        }
        if (checked && !user.program_ids.includes(wall.program_id)) programsToGrant.add(wall.program_id);
      }

      await setUserOverridesForMenus(userId, wallIds, rights);
      if (programsToGrant.size > 0) {
        await grantUserPrograms(userId, [...programsToGrant]);
        granted += programsToGrant.size;
      }
      saved += 1;
      overrides += rights.size;
    }

    await logAudit({
      actor_id: actor.id,
      action: "update_wall_rights",
      target_table: "user_menu_permissions",
      after: { users: saved, overrides, programs_granted: granted },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกสิทธิ์จอ War Room ไม่สำเร็จ", true, keep);
  }

  revalidatePath("/core/wall-rights");
  revalidatePath("/core/program-rights");
  revalidatePath("/wall");
  back(
    `บันทึกสิทธิ์จอ War Room แล้ว ${saved} คน · กำหนดเฉพาะราย ${overrides} รายการ` +
      (granted > 0 ? ` · ให้สิทธิ์เข้าโปรแกรมเพิ่ม ${granted} รายการ` : ""),
    false,
    keep,
  );
}

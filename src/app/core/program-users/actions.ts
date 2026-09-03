"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listCoreUsers, setProgramUsers } from "@/lib/core-db";
import { logAudit } from "@/lib/db";
import { requireCoreAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(programId: string, message: string, isError = false): never {
  const query = new URLSearchParams();
  if (programId) query.set("program", programId);
  query.set(isError ? "err" : "msg", message);
  redirect(`/core/program-users?${query.toString()}`);
}

/** บันทึกรายชื่อผู้ใช้ของโปรแกรมทั้งชุด (คนที่ไม่ได้ติ๊ก = ถูกถอดสิทธิ์ออกจากโปรแกรมนี้) */
export async function saveProgramUsersForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const programId = str(form, "program_id");
  const programName = str(form, "program_name") || "โปรแกรมนี้";
  const userIds = form.getAll("user_ids").map(String);

  if (!programId) back("", "ไม่พบโปรแกรมที่ต้องการกำหนดผู้ใช้งาน", true);

  try {
    await setProgramUsers(programId, userIds);
    await logAudit({
      actor_id: actor.id,
      action: "update_program_users",
      target_table: "user_programs",
      target_id: programId,
      after: { users: userIds.length },
    });
  } catch (err) {
    back(programId, err instanceof Error ? err.message : "บันทึกผู้ใช้งานโปรแกรมไม่สำเร็จ", true);
  }

  revalidatePath("/core/program-users");
  revalidatePath("/core/users");
  back(
    programId,
    userIds.length > 0
      ? `บันทึกแล้ว · ${programName} ใช้งานได้ ${userIds.length} คน`
      : `บันทึกแล้ว · ยังไม่มีใครใช้ ${programName} ได้เลย`,
  );
}

/** ปุ่มลัด: ให้ทุกคนในระบบใช้โปรแกรมนี้ได้ (เช่น ระบบลงเวลาที่ทุกคนต้องใช้) */
export async function grantAllUsersForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const programId = str(form, "program_id");
  const programName = str(form, "program_name") || "โปรแกรมนี้";
  const activeOnly = form.get("active_only") === "on";

  if (!programId) back("", "ไม่พบโปรแกรมที่ต้องการกำหนดผู้ใช้งาน", true);

  let count = 0;
  try {
    const users = await listCoreUsers();
    const ids = users.filter((u) => !activeOnly || u.is_active).map((u) => u.id);
    count = ids.length;

    await setProgramUsers(programId, ids);
    await logAudit({
      actor_id: actor.id,
      action: "grant_program_all_users",
      target_table: "user_programs",
      target_id: programId,
      after: { users: count, activeOnly },
    });
  } catch (err) {
    back(programId, err instanceof Error ? err.message : "ให้สิทธิ์ทุกคนไม่สำเร็จ", true);
  }

  revalidatePath("/core/program-users");
  revalidatePath("/core/users");
  back(
    programId,
    `ให้สิทธิ์ใช้ ${programName} กับ${activeOnly ? "ทุกคนที่บัญชียังใช้งานได้" : "ทุกคนในระบบ"}แล้ว (${count} คน)`,
  );
}

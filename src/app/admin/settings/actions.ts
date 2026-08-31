"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgSettings, logAudit, setDefaultSchedule, updateOrgSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { OrgSettings } from "@/lib/types";

function num(form: FormData, key: string, fallback: number): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : fallback;
}

/** ค่าระดับองค์กร (เวลาเข้า-ออกงานอยู่ที่หน้า "ตั้งค่าข้อมูลหลัก" → กะทำงาน) */
export async function saveSettingsForm(form: FormData): Promise<void> {
  await requireAdmin();
  const before = await getOrgSettings();

  const patch: Partial<OrgSettings> = {
    org_name: String(form.get("org_name") ?? "").trim() || before.org_name,
    require_gps: form.get("require_gps") === "on",
    radius_m: num(form, "radius_m", before.radius_m),
  };

  const scheduleId = String(form.get("default_schedule_id") ?? "").trim();

  try {
    await updateOrgSettings(patch);
    if (scheduleId && scheduleId !== before.default_schedule_id) {
      await setDefaultSchedule(scheduleId);
    }
    await logAudit({
      actor_id: null,
      action: "update_settings",
      target_table: "work_settings",
      target_id: "1",
      before,
      after: { ...patch, default_schedule_id: scheduleId || before.default_schedule_id },
    });
  } catch (err) {
    redirect(
      `/admin/settings?err=${encodeURIComponent(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ")}`,
    );
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?msg=" + encodeURIComponent("บันทึกการตั้งค่าเรียบร้อยแล้ว"));
}

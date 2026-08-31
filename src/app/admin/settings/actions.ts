"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkSettings, logAudit, updateWorkSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { WorkSettings } from "@/lib/types";

function num(form: FormData, key: string, fallback: number): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function optNum(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function saveSettingsForm(form: FormData): Promise<void> {
  await requireAdmin();
  const before = await getWorkSettings();

  const workdays = [0, 1, 2, 3, 4, 5, 6].filter((d) => form.get(`workday_${d}`) === "on");

  const patch: Partial<WorkSettings> = {
    org_name: String(form.get("org_name") ?? "").trim() || before.org_name,
    work_start: String(form.get("work_start") ?? before.work_start),
    work_end: String(form.get("work_end") ?? before.work_end),
    break_start: String(form.get("break_start") ?? before.break_start),
    break_end: String(form.get("break_end") ?? before.break_end),
    break_allow_minutes: num(form, "break_allow_minutes", before.break_allow_minutes),
    break_policy: form.get("break_policy") === "fixed" ? "fixed" : "actual",
    late_grace_min: num(form, "late_grace_min", before.late_grace_min),
    early_leave_grace_min: num(form, "early_leave_grace_min", before.early_leave_grace_min),
    count_ot: form.get("count_ot") === "on",
    ot_grace_min: num(form, "ot_grace_min", before.ot_grace_min),
    workdays: workdays.length > 0 ? workdays : before.workdays,
    require_gps: form.get("require_gps") === "on",
    site_lat: optNum(form, "site_lat"),
    site_lng: optNum(form, "site_lng"),
    radius_m: num(form, "radius_m", before.radius_m),
  };

  try {
    await updateWorkSettings(patch);
    await logAudit({
      actor_id: null,
      action: "update_settings",
      target_table: "work_settings",
      target_id: "1",
      before,
      after: patch,
    });
  } catch (err) {
    redirect(
      `/admin/settings?err=${encodeURIComponent(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ")}`,
    );
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?msg=" + encodeURIComponent("บันทึกการตั้งค่าเรียบร้อยแล้ว"));
}

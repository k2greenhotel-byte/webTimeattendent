"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { canSubmit } from "@/lib/marketing";
import { getActivityRow, saveSubmission, type SubmissionInput } from "@/lib/marketing-db";
import type { MktActiveStatus } from "@/lib/marketing-types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** ช่องรูปส่งค่าว่างมาด้วยเสมอ — เอาค่าที่ไม่ว่างตัวแรกเป็นรูปที่เลือก */
function photo(form: FormData, key: string): string | null {
  return form.getAll(key).map(String).find((v) => v.trim() !== "") ?? null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

export async function saveSubmissionForm(form: FormData): Promise<void> {
  const activityId = str(form, "activity_id");
  if (!activityId) back("/marketing/submit", "ไม่พบใบกิจกรรม", true);

  const page = `/marketing/submit/${activityId}`;
  const activity = await getActivityRow(activityId);
  if (!activity) back("/marketing/submit", "ไม่พบใบกิจกรรม", true);

  const gate = canSubmit(activity);
  if (!gate.ok) back(page, gate.reason ?? "บันทึกไม่ได้", true);

  const submitDate = str(form, "submit_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(submitDate)) back(page, "กรุณาเลือกวันที่ส่งเบิกเงิน", true);

  const input: SubmissionInput = {
    submitted_by_staff_id: str(form, "submitted_by_staff_id") || null,
    submit_date: submitDate,
    postal_no: str(form, "postal_no") || null,
    letter_photo_path: photo(form, "letter_photo_path"),
    ack_photo_path: photo(form, "ack_photo_path"),
    active_status: (str(form, "active_status") || "active") as MktActiveStatus,
  };

  try {
    await saveSubmission(activityId, input);
    await logAudit({
      actor_id: null,
      action: "mkt_save_submission",
      target_table: "mkt_submissions",
      target_id: activityId,
      after: input,
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/submit");
  revalidatePath(`/marketing/activities/${activityId}`);
  back(page, "บันทึกการส่งเรื่องเบิกเงินเรียบร้อยแล้ว · สถานะเปลี่ยนเป็น ส่งเบิกแล้ว");
}

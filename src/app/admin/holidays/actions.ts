"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteHoliday, logAudit, upsertHoliday } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function back(message: string, isError = false): never {
  redirect(`/admin/holidays?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

export async function saveHolidayForm(form: FormData): Promise<void> {
  await requireAdmin();

  const holiday_date = String(form.get("holiday_date") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) back("กรุณาเลือกวันที่ให้ถูกต้อง", true);
  if (!name) back("กรุณากรอกชื่อวันหยุด", true);

  try {
    await upsertHoliday({ holiday_date, name });
    await logAudit({
      actor_id: null,
      action: "save_holiday",
      target_table: "holidays",
      target_id: holiday_date,
      after: { holiday_date, name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกวันหยุดไม่สำเร็จ", true);
  }

  revalidatePath("/admin/holidays");
  back("บันทึกวันหยุดเรียบร้อยแล้ว");
}

export async function deleteHolidayForm(form: FormData): Promise<void> {
  await requireAdmin();
  const date = String(form.get("holiday_date") ?? "");

  try {
    await deleteHoliday(date);
    await logAudit({
      actor_id: null,
      action: "delete_holiday",
      target_table: "holidays",
      target_id: date,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบวันหยุดไม่สำเร็จ", true);
  }

  revalidatePath("/admin/holidays");
  back("ลบวันหยุดเรียบร้อยแล้ว");
}

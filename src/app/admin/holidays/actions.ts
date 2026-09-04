"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteHoliday, logAudit, upsertHoliday } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function back(message: string, isError = false, companyId?: string | null): never {
  const company = companyId ? `company=${companyId}&` : "";
  redirect(`/admin/holidays?${company}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** วันหยุดของบริษัทไหน (null = วันหยุดกลางที่ใช้ทุกบริษัท) */
function companyOf(form: FormData): string | null {
  return String(form.get("company") ?? "").trim() || null;
}

export async function saveHolidayForm(form: FormData): Promise<void> {
  await requireAdmin();

  const holiday_date = String(form.get("holiday_date") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const companyId = companyOf(form);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) back("กรุณาเลือกวันที่ให้ถูกต้อง", true, companyId);
  if (!name) back("กรุณากรอกชื่อวันหยุด", true, companyId);

  try {
    await upsertHoliday({ holiday_date, name, company_id: companyId });
    await logAudit({
      actor_id: null,
      action: "save_holiday",
      target_table: "holidays",
      target_id: holiday_date,
      after: { holiday_date, name, company_id: companyId },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกวันหยุดไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/holidays");
  back("บันทึกวันหยุดเรียบร้อยแล้ว", false, companyId);
}

export async function deleteHolidayForm(form: FormData): Promise<void> {
  await requireAdmin();
  const date = String(form.get("holiday_date") ?? "");
  const companyId = companyOf(form);

  try {
    await deleteHoliday(date, companyId);
    await logAudit({
      actor_id: null,
      action: "delete_holiday",
      target_table: "holidays",
      target_id: date,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบวันหยุดไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/holidays");
  back("ลบวันหยุดเรียบร้อยแล้ว", false, companyId);
}

"use server";

import { redirect } from "next/navigation";
import { workDateOf } from "@/lib/datetime";
import { createFieldTask, getBranchById, getEmployeeById, listFieldTaskTypes, logAudit } from "@/lib/db";
import { requireUser } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string): never {
  redirect(`/punch/field/new?err=${encodeURIComponent(message)}`);
}

/** พนักงานสร้างภารกิจนอกสถานที่ให้ตัวเอง (งานฉุกเฉิน เช่น ส่งรถ) แล้วไปถ่ายรูปเริ่มงานทันที */
export async function startOwnFieldTaskForm(form: FormData): Promise<void> {
  const user = await requireUser();

  const typeId = str(form, "type_id");
  const siteId = str(form, "site_id") || null;
  const placeText = str(form, "place_text") || null;
  const title = str(form, "title");
  const note = str(form, "note") || null;

  if (!typeId) back("กรุณาเลือกประเภทงาน");
  if (!siteId && !placeText) back("กรุณาเลือกสถานที่ หรือพิมพ์ชื่อสถานที่ปลายทาง");

  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);
  const companyId = branch?.company_id ?? null;

  const types = await listFieldTaskTypes(companyId);
  const type = types.find((t) => t.id === typeId);
  if (!type) back("ประเภทงานไม่ถูกต้อง");

  let taskId = "";
  try {
    const task = await createFieldTask(
      {
        company_id: companyId,
        type_id: type.id,
        title: title || type.name,
        site_id: siteId,
        place_text: siteId ? null : placeText,
        work_date: workDateOf(),
        planned_start: null,
        planned_end: null,
        counts_hours: type.counts_hours,
        note,
        created_by: user.id,
      },
      [user.id],
    );
    taskId = task.id;
    await logAudit({
      actor_id: user.id,
      action: "create_field_task_self",
      target_table: "field_tasks",
      target_id: task.id,
      after: { type: type.name, title: task.title, site_id: siteId, place_text: placeText },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "สร้างงานไม่สำเร็จ");
  }

  redirect(`/punch/capture?task=${taskId}&type=start`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deletePunch,
  getEmployeeById,
  getRecordById,
  insertPunch,
  logAudit,
  updatePunchTime,
} from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PUNCH_ORDER, type PunchType } from "@/lib/types";

/** "2026-08-31" + "08:15" (เวลาไทย) -> ISO UTC */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function back(employeeId: string, date: string, message: string, isError = false): never {
  const key = isError ? "err" : "msg";
  redirect(`/admin/records/${employeeId}/${date}?${key}=${encodeURIComponent(message)}`);
}

/** บันทึก/แก้ไขเวลาย้อนหลัง (บันทึก audit log เสมอ) */
export async function savePunchForm(form: FormData): Promise<void> {
  await requireAdmin();

  const employeeId = String(form.get("employee_id") ?? "");
  const date = String(form.get("work_date") ?? "");
  const type = String(form.get("punch_type") ?? "") as PunchType;
  const time = String(form.get("time") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const recordId = String(form.get("record_id") ?? "").trim();

  if (!employeeId || !date || !PUNCH_ORDER.includes(type)) {
    back(employeeId, date, "ข้อมูลไม่ครบถ้วน", true);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    back(employeeId, date, "รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:mm)", true);
  }

  try {
    if (recordId) {
      const before = await getRecordById(recordId);
      await updatePunchTime(recordId, toIso(date, time), note, null);
      await logAudit({
        actor_id: null,
        action: "update_punch",
        target_table: "attendance_records",
        target_id: recordId,
        before,
        after: { punched_at: toIso(date, time), note },
      });
    } else {
      const created = await insertPunch({
        employee_id: employeeId,
        work_date: date,
        punch_type: type,
        punched_at: toIso(date, time),
        photo_path: null,
        lat: null,
        lng: null,
        accuracy_m: null,
        distance_m: null,
        device_info: "บันทึกโดยผู้ดูแลระบบ",
        branch_id: (await getEmployeeById(employeeId))?.branch_id ?? null,
        note,
        is_manual: true,
        edited_by: null,
      });
      await logAudit({
        actor_id: null,
        action: "create_punch_manual",
        target_table: "attendance_records",
        target_id: created.id,
        after: created,
      });
    }
  } catch (err) {
    back(employeeId, date, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath(`/admin/records/${employeeId}/${date}`);
  back(employeeId, date, "บันทึกเรียบร้อยแล้ว");
}

export async function deletePunchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const employeeId = String(form.get("employee_id") ?? "");
  const date = String(form.get("work_date") ?? "");
  const recordId = String(form.get("record_id") ?? "");

  try {
    const before = await getRecordById(recordId);
    await deletePunch(recordId);
    await logAudit({
      actor_id: null,
      action: "delete_punch",
      target_table: "attendance_records",
      target_id: recordId,
      before,
    });
  } catch (err) {
    back(employeeId, date, err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath(`/admin/records/${employeeId}/${date}`);
  back(employeeId, date, "ลบรายการเรียบร้อยแล้ว");
}

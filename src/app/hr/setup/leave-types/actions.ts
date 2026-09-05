"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { deleteLeaveType, insertLeaveType, updateLeaveType } from "@/lib/leave-db";
import type { LeaveType } from "@/lib/leave-types";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback = 0): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

/** ช่องที่เว้นว่างได้ (null = ไม่จำกัด / ไม่มีเวลาตัด) */
function optionalNum(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function back(message: string, isError = false): never {
  redirect(`/hr/setup/leave-types?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readType(form: FormData): Omit<LeaveType, "id"> {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    description: str(form, "description") || null,
    conditions: str(form, "conditions") || null,
    advance_days: Math.max(0, num(form, "advance_days")),
    late_becomes_absent: form.get("late_becomes_absent") === "on",
    min_service_months: Math.max(0, num(form, "min_service_months")),
    require_medical_cert: form.get("require_medical_cert") === "on",
    cert_within_days: Math.max(0, num(form, "cert_within_days", 3)),
    same_day_cutoff: str(form, "same_day_cutoff") || null,
    late_penalty_multiplier: Math.max(0, num(form, "late_penalty_multiplier")),
    max_days_per_year: optionalNum(form, "max_days_per_year"),
    needs_date_range: form.get("needs_date_range") === "on",
    needs_arrival_time: form.get("needs_arrival_time") === "on",
    is_paid: form.get("is_paid") === "on",
    icon: str(form, "icon") || null,
    sort_order: num(form, "sort_order"),
    is_active: form.get("is_active") === "on",
  };
}

/** ตรวจความสมเหตุสมผลของเงื่อนไข ก่อนบันทึก */
function checkType(row: Omit<LeaveType, "id">): string | null {
  if (!row.code || !row.name) return "กรุณากรอกรหัสและชื่อประเภทการลา";
  if (row.late_becomes_absent && row.advance_days <= 0) {
    return 'ติ๊ก "แจ้งไม่ทันถือเป็นขาดงาน" แล้วต้องกำหนดจำนวนวันแจ้งล่วงหน้ามากกว่า 0';
  }
  if (row.late_penalty_multiplier > 0 && !row.same_day_cutoff) {
    return "กำหนดตัวคูณค่าปรับแล้วต้องกำหนดเวลาตัดด้วย ไม่งั้นระบบไม่รู้ว่าแจ้งช้าเมื่อไร";
  }
  if (!row.needs_date_range && !row.needs_arrival_time) {
    return 'ต้องเลือกอย่างน้อยหนึ่งอย่าง: "ระบุช่วงวันที่" หรือ "ระบุเวลาที่จะมาถึง"';
  }
  return null;
}

export async function createLeaveTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("HR_TYPES", "write");
  const row = { ...readType(form), is_active: true };

  const problem = checkType(row);
  if (problem) back(problem, true);

  try {
    await insertLeaveType(row);
    await logAudit({
      actor_id: actor.id,
      action: "hr_create_leave_type",
      target_table: "hr_leave_types",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มประเภทการลาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/setup/leave-types");
  revalidatePath("/hr/leave/new");
  back(`เพิ่มประเภทการลา ${row.name} เรียบร้อยแล้ว`);
}

export async function updateLeaveTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("HR_TYPES", "edit");
  const id = str(form, "id");
  const patch = readType(form);

  if (!id) back("ไม่พบประเภทการลา", true);
  const problem = checkType(patch);
  if (problem) back(problem, true);

  try {
    await updateLeaveType(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "hr_update_leave_type",
      target_table: "hr_leave_types",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกประเภทการลาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/setup/leave-types");
  revalidatePath("/hr/leave/new");
  back(
    `บันทึก ${patch.name} เรียบร้อยแล้ว — เงื่อนไขใหม่มีผลกับใบที่ยื่นหลังจากนี้ ` +
      "ใบเก่ายังใช้เงื่อนไขเดิมที่บันทึกไว้ตอนยื่น",
  );
}

export async function deleteLeaveTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("HR_TYPES", "delete");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") back('ต้องติ๊ก "ยืนยัน" ก่อนลบ', true);

  try {
    await deleteLeaveType(id);
    await logAudit({
      actor_id: actor.id,
      action: "hr_delete_leave_type",
      target_table: "hr_leave_types",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบประเภทการลาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/setup/leave-types");
  back("ลบประเภทการลาเรียบร้อยแล้ว");
}

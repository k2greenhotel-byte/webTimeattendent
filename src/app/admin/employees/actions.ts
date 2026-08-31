"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPin, isValidPin } from "@/lib/auth";
import { deleteEmployee, logAudit } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-server";

export type ActionState = { error: string | null; success: string | null };

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function createEmployeeAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const emp_code = str(form, "emp_code");
  const full_name = str(form, "full_name");
  const pin = str(form, "pin");

  if (!emp_code || !full_name) return { error: "กรุณากรอกรหัสพนักงานและชื่อ-สกุล", success: null };
  if (!isValidPin(pin)) return { error: "PIN ต้องเป็นตัวเลข 4 หลัก", success: null };

  const row = {
    emp_code,
    full_name,
    nickname: str(form, "nickname") || null,
    department: str(form, "department") || null,
    position: str(form, "position") || null,
    hire_date: str(form, "hire_date") || null,
    branch_id: str(form, "branch_id") || null,
    role: str(form, "role") === "admin" ? "admin" : "employee",
    pin_hash: await hashPin(pin),
  };

  const { data, error } = await getSupabase().from("employees").insert(row).select("id").single();
  if (error) {
    return {
      error: error.code === "23505" ? "รหัสพนักงานนี้ถูกใช้แล้ว" : `เพิ่มพนักงานไม่สำเร็จ: ${error.message}`,
      success: null,
    };
  }

  await logAudit({
    actor_id: null,
    action: "create_employee",
    target_table: "employees",
    target_id: data.id,
    after: { ...row, pin_hash: "***" },
  });

  revalidatePath("/admin/employees");
  return { error: null, success: `เพิ่มพนักงาน ${full_name} เรียบร้อยแล้ว` };
}

export async function updateEmployeeAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  if (!id) return { error: "ไม่พบพนักงาน", success: null };

  const patch = {
    full_name: str(form, "full_name"),
    nickname: str(form, "nickname") || null,
    department: str(form, "department") || null,
    position: str(form, "position") || null,
    branch_id: str(form, "branch_id") || null,
    role: str(form, "role") === "admin" ? "admin" : "employee",
    is_active: form.get("is_active") === "on",
  };

  const { error } = await getSupabase().from("employees").update(patch).eq("id", id);
  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}`, success: null };

  await logAudit({
    actor_id: null,
    action: "update_employee",
    target_table: "employees",
    target_id: id,
    after: patch,
  });

  revalidatePath("/admin/employees");
  return { error: null, success: "บันทึกข้อมูลพนักงานเรียบร้อยแล้ว" };
}

export async function resetPinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const pin = str(form, "pin");

  if (!isValidPin(pin)) return { error: "PIN ต้องเป็นตัวเลข 4 หลัก", success: null };

  const { error } = await getSupabase()
    .from("employees")
    .update({ pin_hash: await hashPin(pin), failed_attempts: 0, locked_until: null })
    .eq("id", id);
  if (error) return { error: `ตั้ง PIN ใหม่ไม่สำเร็จ: ${error.message}`, success: null };

  await logAudit({
    actor_id: null,
    action: "reset_pin",
    target_table: "employees",
    target_id: id,
  });

  revalidatePath("/admin/employees");
  return { error: null, success: "ตั้ง PIN ใหม่เรียบร้อยแล้ว" };
}

/** เวอร์ชันสำหรับ <form action={...}> ในฟอร์มแถวตาราง (แจ้งผลผ่าน query string) */
function backWith(state: ActionState): never {
  const key = state.error ? "err" : "msg";
  redirect(`/admin/employees?${key}=${encodeURIComponent(state.error ?? state.success ?? "")}`);
}

export async function updateEmployeeForm(form: FormData): Promise<void> {
  backWith(await updateEmployeeAction({ error: null, success: null }, form));
}

export async function resetPinForm(form: FormData): Promise<void> {
  backWith(await resetPinAction({ error: null, success: null }, form));
}

/** ลบพนักงานถาวร (ประวัติการลงเวลาถูกลบตามด้วย on delete cascade) */
export async function deleteEmployeeForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("id") ?? "").trim();

  try {
    await deleteEmployee(id);
    await logAudit({
      actor_id: null,
      action: "delete_employee",
      target_table: "employees",
      target_id: id,
    });
  } catch (err) {
    backWith({
      error: err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ",
      success: null,
    });
  }

  revalidatePath("/admin/employees");
  backWith({ error: null, success: "ลบพนักงานเรียบร้อยแล้ว" });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPin, isValidPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/auth";
import { listPrograms, setUserBranches, setUserCompanies, setUserPrograms } from "@/lib/core-db";
import { deleteEmployee, getBranchById, logAudit } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { requireAdmin } from "@/lib/session";
import { getSupabase } from "@/lib/supabase-server";

export type ActionState = { error: string | null; success: string | null };

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** แปลง error ซ้ำค่า (unique) เป็นข้อความที่บอกได้ว่าซ้ำที่ช่องไหน */
function duplicateMessage(error: { code?: string; message: string }, prefix: string): string {
  if (error.code !== "23505") return `${prefix}: ${error.message}`;
  return error.message.includes("phone")
    ? "เบอร์มือถือนี้ถูกใช้กับพนักงานคนอื่นแล้ว"
    : "รหัสพนักงานนี้ถูกใช้แล้ว";
}

export async function createEmployeeAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const emp_code = str(form, "emp_code");
  const full_name = str(form, "full_name");
  const pin = str(form, "pin");
  const phone = normalizePhone(str(form, "phone"));

  if (!emp_code || !full_name) return { error: "กรุณากรอกรหัสพนักงานและชื่อ-สกุล", success: null };
  if (!isValidPhone(phone)) {
    return { error: "กรุณากรอกเบอร์มือถือให้ถูกต้อง (ใช้เป็นรหัสเข้าระบบ)", success: null };
  }
  if (!isValidPin(pin)) {
    return {
      error: `รหัสผ่านต้องเป็นตัวเลข ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลัก`,
      success: null,
    };
  }

  const row = {
    emp_code,
    full_name,
    nickname: str(form, "nickname") || null,
    phone,
    email: str(form, "email") || null,
    hire_date: str(form, "hire_date") || null,
    branch_id: str(form, "branch_id") || null,
    department_id: str(form, "department_id") || null,
    position_id: str(form, "position_id") || null,
    role: str(form, "role") === "admin" ? "admin" : "employee",
    pin_hash: await hashPin(pin),
  };

  const { data, error } = await getSupabase().from("employees").insert(row).select("id").single();
  if (error) {
    return { error: duplicateMessage(error, "เพิ่มพนักงานไม่สำเร็จ"), success: null };
  }

  // หน้านี้ไม่มีช่องเลือกบริษัท/สาขา/โปรแกรมที่เข้าได้ (ต่างจาก /core/users) —
  // ให้เข้าสาขาของตัวเองกับบริษัทของสาขานั้นได้ทันที และให้สิทธิ์โปรแกรมที่เปิดกว้างสำหรับ
  // พนักงานทุกคนเป็นค่าเริ่มต้น (ลงเวลา + ขอลา/ขอเบิกเงิน) ไม่งั้นพนักงานที่เพิ่งเพิ่มจะ
  // ล็อกอินไม่ได้เพราะไม่มีบริษัท/สาขาให้เลือก และมองไม่เห็นโปรแกรมขอลาที่ควรใช้ได้ทุกคน
  const branch = row.branch_id ? await getBranchById(row.branch_id) : null;
  const defaultPrograms = (await listPrograms(true))
    .filter((p) => p.code === "ATT" || p.code === "HR")
    .map((p) => p.id);
  await Promise.all([
    row.branch_id ? setUserBranches(data.id, [row.branch_id]) : Promise.resolve(),
    branch?.company_id ? setUserCompanies(data.id, [branch.company_id]) : Promise.resolve(),
    defaultPrograms.length ? setUserPrograms(data.id, defaultPrograms) : Promise.resolve(),
  ]);

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

  const phone = normalizePhone(str(form, "phone"));
  if (phone && !isValidPhone(phone)) {
    return { error: "เบอร์มือถือไม่ถูกต้อง (ใช้เป็นรหัสเข้าระบบ)", success: null };
  }

  const patch = {
    full_name: str(form, "full_name"),
    nickname: str(form, "nickname") || null,
    phone: phone || null,
    email: str(form, "email") || null,
    branch_id: str(form, "branch_id") || null,
    department_id: str(form, "department_id") || null,
    position_id: str(form, "position_id") || null,
    role: str(form, "role") === "admin" ? "admin" : "employee",
    is_active: form.get("is_active") === "on",
  };

  const { error } = await getSupabase().from("employees").update(patch).eq("id", id);
  if (error) return { error: duplicateMessage(error, "บันทึกไม่สำเร็จ"), success: null };

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

  if (!isValidPin(pin)) {
    return {
      error: `รหัสผ่านต้องเป็นตัวเลข ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลัก`,
      success: null,
    };
  }

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

  let photosDeleted = 0;
  try {
    ({ photosDeleted } = await deleteEmployee(id));
    await logAudit({
      actor_id: null,
      action: "delete_employee",
      target_table: "employees",
      target_id: id,
      after: { photosDeleted },
    });
  } catch (err) {
    backWith({
      error: err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ",
      success: null,
    });
  }

  revalidatePath("/admin/employees");
  backWith({
    error: null,
    success: `ลบพนักงานเรียบร้อยแล้ว (ลบประวัติการลงเวลาและรูป ${photosDeleted} ไฟล์ด้วย)`,
  });
}

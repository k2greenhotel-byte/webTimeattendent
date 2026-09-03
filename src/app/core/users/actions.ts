"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPin, isValidPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/auth";
import { insertCoreUser, setUserPrograms } from "@/lib/core-db";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/core-types";
import { deleteEmployee, logAudit } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { requireCoreAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`/core/users?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readLevel(form: FormData, key = "access_level"): AccessLevel {
  const value = str(form, key);
  return (ACCESS_LEVELS as string[]).includes(value) ? (value as AccessLevel) : "user";
}

export async function createUserForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();

  const username = str(form, "username").toLowerCase();
  const empCode = (str(form, "emp_code") || username).toUpperCase();
  const fullName = str(form, "full_name");
  const phone = normalizePhone(str(form, "phone"));
  const pin = str(form, "pin");
  const level = readLevel(form);

  if (!username || !fullName) back("กรุณากรอก User ID และชื่อผู้ใช้งาน", true);
  if (!empCode) back("กรุณากรอกรหัสพนักงาน", true);
  if (phone && !isValidPhone(phone)) back("เบอร์มือถือไม่ถูกต้อง (ตัวอย่าง 0812345678)", true);
  if (!isValidPin(pin)) {
    back(`รหัสผ่านต้องเป็นตัวเลข ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลัก`, true);
  }

  let userId: string;
  try {
    userId = await insertCoreUser({
      emp_code: empCode,
      username,
      full_name: fullName,
      phone: phone || null,
      pin_hash: await hashPin(pin),
      access_level: level,
      is_active: form.get("is_active") !== "off",
      all_companies: form.get("all_companies") === "on",
      all_branches: form.get("all_branches") === "on",
      branch_id: null,
    });

    // ให้สิทธิ์โปรแกรมที่ติ๊กมาตั้งแต่ตอนสร้าง
    await setUserPrograms(userId, form.getAll("program_ids").map(String));

    await logAudit({
      actor_id: actor.id,
      action: "create_user",
      target_table: "employees",
      target_id: userId,
      after: { username, emp_code: empCode, full_name: fullName, access_level: level },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มผู้ใช้งานไม่สำเร็จ", true);
  }

  revalidatePath("/core/users");
  redirect(
    `/core/users/${userId}?msg=` +
      encodeURIComponent(`เพิ่มผู้ใช้งาน ${fullName} แล้ว — กำหนดบริษัท/สาขาและสิทธิ์ต่อได้เลย`),
  );
}

export async function deleteUserForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");

  if (!id) back("ไม่พบผู้ใช้งานที่ต้องการลบ", true);
  if (id === actor.id) back("ลบบัญชีของตัวเองไม่ได้", true);
  if (form.get("confirm") !== "on") {
    back('ต้องติ๊ก "ยืนยันลบ" ก่อน — การลบผู้ใช้จะลบประวัติการลงเวลาและรูปของคนนั้นทั้งหมด', true);
  }

  let photosDeleted = 0;
  try {
    ({ photosDeleted } = await deleteEmployee(id));
    await logAudit({
      actor_id: actor.id,
      action: "delete_user",
      target_table: "employees",
      target_id: id,
      after: { photosDeleted },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบผู้ใช้งานไม่สำเร็จ", true);
  }

  revalidatePath("/core/users");
  back(`ลบผู้ใช้งานเรียบร้อยแล้ว · ลบรูปการลงเวลา ${photosDeleted} รูป`);
}

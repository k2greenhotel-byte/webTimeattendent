"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPin, isValidPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/auth";
import {
  resetUserPin,
  setUserBranches,
  setUserCompanies,
  setUserOverrides,
  setUserPrograms,
  updateCoreUser,
} from "@/lib/core-db";
import { ACCESS_LEVELS, type AccessLevel, type MenuRights } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { requireCoreAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(userId: string, message: string, isError = false): never {
  redirect(`/core/users/${userId}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readLevel(form: FormData): AccessLevel {
  const value = str(form, "access_level");
  return (ACCESS_LEVELS as string[]).includes(value) ? (value as AccessLevel) : "user";
}

/** แก้ข้อมูลบัญชี: User ID ชื่อ เบอร์ ระดับ และสถานะ */
export async function saveProfileForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  if (!id) back("", "ไม่พบผู้ใช้งาน", true);

  const username = str(form, "username").toLowerCase();
  const fullName = str(form, "full_name");
  const phone = normalizePhone(str(form, "phone"));
  const level = readLevel(form);
  const isActive = form.get("is_active") === "on";

  if (!fullName) back(id, "กรุณากรอกชื่อผู้ใช้งาน", true);
  if (phone && !isValidPhone(phone)) back(id, "เบอร์มือถือไม่ถูกต้อง (ตัวอย่าง 0812345678)", true);
  if (id === actor.id && !isActive) back(id, "ปิดใช้งานบัญชีของตัวเองไม่ได้", true);
  if (id === actor.id && level !== actor.level && actor.level === "admin") {
    back(id, "ลดระดับบัญชีของตัวเองไม่ได้ — ให้ผู้ดูแลระบบคนอื่นเป็นผู้เปลี่ยนให้", true);
  }

  try {
    await updateCoreUser(id, {
      username: username || null,
      full_name: fullName,
      phone: phone || null,
      access_level: level,
      is_active: isActive,
      // role เดิมยังใช้กันเส้นทางหลังบ้านลงเวลาอยู่ — ให้เดินตามระดับใหม่เสมอ
      role: level === "admin" ? "admin" : "employee",
    });
    await logAudit({
      actor_id: actor.id,
      action: "update_user",
      target_table: "employees",
      target_id: id,
      after: { username, full_name: fullName, access_level: level, is_active: isActive },
    });
  } catch (err) {
    back(id, err instanceof Error ? err.message : "บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ", true);
  }

  revalidatePath(`/core/users/${id}`);
  back(id, "บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว");
}

/** ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (กรณีลืมรหัส) */
export async function resetPinForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const pin = str(form, "pin");

  if (!isValidPin(pin)) {
    back(id, `รหัสผ่านต้องเป็นตัวเลข ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลัก`, true);
  }

  try {
    await resetUserPin(id, await hashPin(pin));
    await logAudit({
      actor_id: actor.id,
      action: "reset_user_pin",
      target_table: "employees",
      target_id: id,
    });
  } catch (err) {
    back(id, err instanceof Error ? err.message : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ", true);
  }

  back(id, "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว — แจ้งผู้ใช้ให้เปลี่ยนรหัสเองที่หน้าล็อกอิน");
}

/** บริษัท/สาขา/โปรแกรม ที่ผู้ใช้คนนี้เข้าทำงานได้ */
export async function saveScopeForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  if (!id) back("", "ไม่พบผู้ใช้งาน", true);

  const allCompanies = form.get("all_companies") === "on";
  const allBranches = form.get("all_branches") === "on";
  const companyIds = form.getAll("company_ids").map(String);
  const branchIds = form.getAll("branch_ids").map(String);
  const programIds = form.getAll("program_ids").map(String);

  try {
    await updateCoreUser(id, { all_companies: allCompanies, all_branches: allBranches });
    await Promise.all([
      setUserCompanies(id, allCompanies ? [] : companyIds),
      setUserBranches(id, allBranches ? [] : branchIds),
      setUserPrograms(id, programIds),
    ]);
    await logAudit({
      actor_id: actor.id,
      action: "update_user_scope",
      target_table: "employees",
      target_id: id,
      after: {
        all_companies: allCompanies,
        all_branches: allBranches,
        companies: companyIds.length,
        branches: branchIds.length,
        programs: programIds.length,
      },
    });
  } catch (err) {
    back(id, err instanceof Error ? err.message : "บันทึกขอบเขตการทำงานไม่สำเร็จ", true);
  }

  revalidatePath(`/core/users/${id}`);
  back(id, "บันทึกบริษัท สาขา และโปรแกรมที่ใช้งานได้เรียบร้อยแล้ว");
}

/**
 * สิทธิ์รายเมนู — เมนูที่ติ๊ก "ใช้ค่าตามระดับ" จะไม่เก็บแถว override ไว้
 * (จะได้เดินตามค่าเริ่มต้นของระดับที่แก้ทีหลังโดยอัตโนมัติ)
 */
export async function savePermissionsForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  if (!id) back("", "ไม่พบผู้ใช้งาน", true);

  const menuIds = form.getAll("menu_ids").map(String);
  const inherited = new Set(form.getAll("inherit").map(String));

  const rights = new Map<string, MenuRights>();
  for (const menuId of menuIds) {
    if (inherited.has(menuId)) continue;
    rights.set(menuId, {
      can_read: form.get(`read__${menuId}`) === "on",
      can_write: form.get(`write__${menuId}`) === "on",
      can_edit: form.get(`edit__${menuId}`) === "on",
      can_delete: form.get(`delete__${menuId}`) === "on",
    });
  }

  try {
    await setUserOverrides(id, rights);
    await logAudit({
      actor_id: actor.id,
      action: "update_user_permissions",
      target_table: "user_menu_permissions",
      target_id: id,
      after: { overrides: rights.size, inherited: menuIds.length - rights.size },
    });
  } catch (err) {
    back(id, err instanceof Error ? err.message : "บันทึกสิทธิ์ไม่สำเร็จ", true);
  }

  revalidatePath(`/core/users/${id}`);
  back(
    id,
    `บันทึกสิทธิ์เรียบร้อยแล้ว · กำหนดเฉพาะราย ${rights.size} เมนู · ใช้ค่าตามระดับ ${menuIds.length - rights.size} เมนู`,
  );
}

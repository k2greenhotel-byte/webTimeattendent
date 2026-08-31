"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteBranch, insertBranch, logAudit, updateBranch } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { Branch } from "@/lib/types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function optNum(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function back(message: string, isError = false): never {
  redirect(`/admin/branches?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readForm(form: FormData): Omit<Branch, "id"> {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    address: optText(form, "address"),
    phone: optText(form, "phone"),
    work_start: optText(form, "work_start"),
    work_end: optText(form, "work_end"),
    site_lat: optNum(form, "site_lat"),
    site_lng: optNum(form, "site_lng"),
    radius_m: optNum(form, "radius_m"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createBranchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const row = { ...readForm(form), is_active: true };

  if (!row.code || !row.name) back("กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await insertBranch(row);
    await logAudit({ actor_id: null, action: "create_branch", target_table: "branches", after: row });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back(`เพิ่มสาขา ${row.name} เรียบร้อยแล้ว`);
}

export async function updateBranchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const patch = readForm(form);

  if (!id) back("ไม่พบสาขา", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await updateBranch(id, patch);
    await logAudit({
      actor_id: null,
      action: "update_branch",
      target_table: "branches",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back("บันทึกข้อมูลสาขาเรียบร้อยแล้ว");
}

export async function deleteBranchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");

  try {
    await deleteBranch(id);
    await logAudit({
      actor_id: null,
      action: "delete_branch",
      target_table: "branches",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back("ลบสาขาเรียบร้อยแล้ว");
}

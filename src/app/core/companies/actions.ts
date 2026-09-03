"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteCompany, insertCompany, updateCompany } from "@/lib/core-db";
import type { Company } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requireCoreAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function back(message: string, isError = false): never {
  redirect(`/core/companies?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readForm(form: FormData): Omit<Company, "id"> {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    address: optText(form, "address"),
    tax_id: optText(form, "tax_id"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createCompanyForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const row = { ...readForm(form), is_active: true };

  if (!row.code || !row.name) back("กรุณากรอกรหัสบริษัทและชื่อบริษัท", true);

  try {
    await insertCompany(row);
    await logAudit({
      actor_id: actor.id,
      action: "create_company",
      target_table: "companies",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มบริษัทไม่สำเร็จ", true);
  }

  revalidatePath("/core/companies");
  back(`เพิ่มบริษัท ${row.name} เรียบร้อยแล้ว`);
}

export async function updateCompanyForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const patch = readForm(form);

  if (!id) back("ไม่พบบริษัทที่ต้องการแก้ไข", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสบริษัทและชื่อบริษัท", true);

  try {
    await updateCompany(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "update_company",
      target_table: "companies",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกบริษัทไม่สำเร็จ", true);
  }

  revalidatePath("/core/companies");
  back("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว");
}

export async function deleteCompanyForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const force = form.get("force") === "on";

  let affected = 0;
  try {
    ({ affected } = await deleteCompany(id, force));
    await logAudit({
      actor_id: actor.id,
      action: "delete_company",
      target_table: "companies",
      target_id: id,
      after: { forced: force, branchesUnassigned: affected },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบบริษัทไม่สำเร็จ", true);
  }

  revalidatePath("/core/companies");
  back(
    affected > 0
      ? `ลบบริษัทเรียบร้อยแล้ว · สาขา ${affected} สาขากลายเป็นไม่ระบุบริษัท`
      : "ลบบริษัทเรียบร้อยแล้ว",
  );
}

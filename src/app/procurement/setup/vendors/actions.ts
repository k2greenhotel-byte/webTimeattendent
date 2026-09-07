"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { validateVendor } from "@/lib/procurement";
import { deleteVendor, getVendor, insertVendor, updateVendor } from "@/lib/procurement-db";
import type { PrVendorInput } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

const PATH = "/procurement/setup/vendors";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readInput(form: FormData): PrVendorInput {
  const phone = str(form, "phone");

  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    address: str(form, "address") || null,
    // เก็บเบอร์เป็นตัวเลขล้วนถ้าเป็นเบอร์มือถือไทย นอกนั้นเก็บตามที่พิมพ์ (เบอร์บ้าน/ต่อภายใน)
    phone: (normalizePhone(phone) || phone) || null,
    note: str(form, "note") || null,
    sort_order: Number(str(form, "sort_order")) || 0,
    is_active: true,
  };
}

export async function createVendorForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_VENDOR", "write");
  const input = readInput(form);

  const problem = validateVendor(input);
  if (problem) back(problem, true);

  try {
    await insertVendor(input);
    await logAudit({
      actor_id: user.id,
      action: "pr_create_vendor",
      target_table: "pr_vendors",
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มเจ้าหนี้ไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`เพิ่มเจ้าหนี้ ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function updateVendorForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_VENDOR", "edit");
  const id = str(form, "id");
  const input = { ...readInput(form), is_active: form.get("is_active") === "on" };

  if (!id) back("ไม่พบเจ้าหนี้ที่ต้องการแก้ไข", true);
  const problem = validateVendor(input);
  if (problem) back(problem, true);

  try {
    await updateVendor(id, input);
    await logAudit({
      actor_id: user.id,
      action: "pr_update_vendor",
      target_table: "pr_vendors",
      target_id: id,
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกเจ้าหนี้ไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`บันทึกเจ้าหนี้ ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function deleteVendorForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_VENDOR", "delete");
  const id = str(form, "id");
  const name = str(form, "name");

  if (!id) back("ไม่พบเจ้าหนี้ที่ต้องการลบ", true);

  const vendor = await getVendor(id);
  if (form.get("confirm") !== "on") {
    back(
      `ต้องติ๊ก "ยืนยัน" ก่อน — เจ้าหนี้รายนี้มีใบเบิกอ้างถึง ${vendor?.payment_count ?? 0} ใบ` +
        " (ใบเบิกเก่ายังอยู่ครบ เพราะเก็บชื่อและที่อยู่ ณ วันที่จ่ายไว้บนใบแล้ว)",
      true,
    );
  }

  try {
    await deleteVendor(id);
    await logAudit({
      actor_id: user.id,
      action: "pr_delete_vendor",
      target_table: "pr_vendors",
      target_id: id,
      before: { name, payment_count: vendor?.payment_count ?? 0 },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบเจ้าหนี้ไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`ลบเจ้าหนี้ ${name} เรียบร้อยแล้ว`);
}

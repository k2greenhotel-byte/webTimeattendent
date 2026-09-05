"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAmount } from "@/lib/approval";
import { deleteLimit, insertLimit, updateLimit } from "@/lib/approval-db";
import type { ApvLimit } from "@/lib/approval-types";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`/approvals/setup/limits?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readLevel(value: string): AccessLevel | null {
  return (ACCESS_LEVELS as string[]).includes(value) ? (value as AccessLevel) : null;
}

/** อ่านฟอร์มกฎ — เลือกได้อย่างใดอย่างหนึ่ง: ตามระดับ หรือเจาะจงรายคน */
function readForm(form: FormData): Omit<ApvLimit, "id"> {
  const target = str(form, "target"); // "level" | "user"
  const rawAmount = str(form, "max_amount");

  return {
    level: target === "user" ? null : readLevel(str(form, "level")),
    user_id: target === "user" ? str(form, "user_id") || null : null,
    type_id: str(form, "type_id") || null,
    company_id: str(form, "company_id") || null,
    max_amount: rawAmount === "" ? null : parseAmount(rawAmount),
    can_reject: form.get("can_reject") === "on",
    is_final: form.get("is_final") === "on",
    note: str(form, "note") || null,
    is_active: form.get("is_active") !== "off",
  };
}

export async function createLimitForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "write");
  const row = { ...readForm(form), is_active: true };

  if (!row.level && !row.user_id) back("กรุณาเลือกว่าจะตั้งกฎตามระดับ หรือเจาะจงรายบุคคล", true);
  if (row.max_amount !== null && row.max_amount < 0) back("วงเงินต้องไม่ติดลบ", true);

  try {
    await insertLimit(row);
    await logAudit({
      actor_id: actor.id,
      action: "apv_create_limit",
      target_table: "apv_limits",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มกฎไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/limits");
  back("เพิ่มกฎอำนาจอนุมัติเรียบร้อยแล้ว — มีผลกับเรื่องที่รออยู่ทันที");
}

export async function updateLimitForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "edit");
  const id = str(form, "id");
  if (!id) back("ไม่พบกฎที่ต้องการแก้ไข", true);

  const patch = readForm(form);
  if (patch.max_amount !== null && patch.max_amount < 0) back("วงเงินต้องไม่ติดลบ", true);

  try {
    await updateLimit(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "apv_update_limit",
      target_table: "apv_limits",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกกฎไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/limits");
  back("บันทึกกฎอำนาจอนุมัติเรียบร้อยแล้ว");
}

export async function deleteLimitForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "delete");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") back('ต้องติ๊ก "ยืนยัน" ก่อนลบกฎ', true);

  try {
    await deleteLimit(id);
    await logAudit({
      actor_id: actor.id,
      action: "apv_delete_limit",
      target_table: "apv_limits",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบกฎไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/limits");
  back("ลบกฎเรียบร้อยแล้ว");
}

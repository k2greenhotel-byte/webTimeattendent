"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteType,
  insertRejectReason,
  insertType,
  updateRejectReason,
  updateType,
} from "@/lib/approval-db";
import { parseAmount } from "@/lib/approval";
import type { ApvType } from "@/lib/approval-types";
import { logAudit } from "@/lib/db";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback = 0): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

function back(message: string, isError = false): never {
  redirect(`/approvals/setup/types?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readType(form: FormData): Omit<ApvType, "id"> {
  const rawAuto = str(form, "auto_approve_limit");
  return {
    // ว่าง = ต้องขออนุมัติทุกใบ · เรื่องที่ไม่มีจำนวนเงินไม่มีอะไรให้เทียบ เก็บเป็นว่างเสมอ
    auto_approve_limit: rawAuto === "" || form.get("has_amount") !== "on" ? null : parseAmount(rawAuto),
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    description: str(form, "description") || null,
    program_id: str(form, "program_id") || null,
    has_amount: form.get("has_amount") === "on",
    amount_label: str(form, "amount_label") || "จำนวนเงิน (บาท)",
    allow_partial: form.get("allow_partial") === "on",
    form_enabled: form.get("form_enabled") === "on",
    icon: str(form, "icon") || null,
    sort_order: num(form, "sort_order"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_TYPES", "write");
  const row = { ...readType(form), is_active: true };

  if (!row.code || !row.name) back("กรุณากรอกรหัสและชื่อประเภทเรื่อง", true);

  try {
    await insertType(row);
    await logAudit({
      actor_id: actor.id,
      action: "apv_create_type",
      target_table: "apv_types",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มประเภทเรื่องไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/types");
  back(`เพิ่มประเภทเรื่อง ${row.name} แล้ว — อย่าลืมตั้งอำนาจอนุมัติของเรื่องนี้ด้วยถ้าต้องการแยกวงเงิน`);
}

export async function updateTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_TYPES", "edit");
  const id = str(form, "id");
  const patch = readType(form);

  if (!id) back("ไม่พบประเภทเรื่อง", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสและชื่อประเภทเรื่อง", true);
  if (patch.auto_approve_limit !== null && patch.auto_approve_limit < 0) {
    back("วงเงินไม่ต้องขออนุมัติต้องไม่ติดลบ (เว้นว่าง = ต้องขออนุมัติทุกใบ)", true);
  }

  try {
    await updateType(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "apv_update_type",
      target_table: "apv_types",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกประเภทเรื่องไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/types");
  back("บันทึกประเภทเรื่องเรียบร้อยแล้ว");
}

export async function deleteTypeForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_TYPES", "delete");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") back('ต้องติ๊ก "ยืนยัน" ก่อนลบ', true);

  try {
    await deleteType(id);
    await logAudit({
      actor_id: actor.id,
      action: "apv_delete_type",
      target_table: "apv_types",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบประเภทเรื่องไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/types");
  back("ลบประเภทเรื่องเรียบร้อยแล้ว");
}

// ---------- เหตุผลการไม่อนุมัติ ----------

export async function createReasonForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_TYPES", "write");
  const row = {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    sort_order: num(form, "sort_order"),
    is_active: true,
  };

  if (!row.code || !row.name) back("กรุณากรอกรหัสและข้อความเหตุผล", true);

  try {
    await insertRejectReason(row);
    await logAudit({
      actor_id: actor.id,
      action: "apv_create_reason",
      target_table: "apv_reject_reasons",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มเหตุผลไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/types");
  back("เพิ่มเหตุผลการไม่อนุมัติเรียบร้อยแล้ว");
}

export async function updateReasonForm(form: FormData): Promise<void> {
  await requirePermission("APV_TYPES", "edit");
  const id = str(form, "id");
  if (!id) back("ไม่พบเหตุผล", true);

  try {
    await updateRejectReason(id, {
      name: str(form, "name"),
      sort_order: num(form, "sort_order"),
      is_active: form.get("is_active") === "on",
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกเหตุผลไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/types");
  back("บันทึกเหตุผลเรียบร้อยแล้ว");
}

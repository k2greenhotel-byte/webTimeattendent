"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCheckType, validateDocType } from "@/lib/audit";
import {
  createCheckType,
  createDocType,
  deleteCheckType,
  deleteDocType,
  getCheckType,
  listCheckTypeRows,
  updateCheckType,
  updateDocType,
} from "@/lib/audit-db";
import {
  AUD_KIND_ORDER,
  type AudCheckKind,
  type AudCheckTypeInput,
  type AudDocTypeInput,
} from "@/lib/audit-types";
import { logAudit } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const PATH = "/audit/setup";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function on(form: FormData, key: string): boolean {
  return form.get(key) === "on";
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

// ---------- ทะเบียนเอกสารประกอบ ----------

function readDocType(form: FormData): AudDocTypeInput {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    note: str(form, "note") || null,
    sort_order: Number(str(form, "sort_order")) || 100,
    is_active: form.has("is_active") ? on(form, "is_active") : true,
  };
}

export async function createDocTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "write");
  const input = readDocType(form);

  const problem = validateDocType(input);
  if (problem) back(problem, true);

  try {
    await createDocType(input);
    await logAudit({
      actor_id: user.id,
      action: "aud_create_doc_type",
      target_table: "aud_doc_types",
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มเอกสารประกอบไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`เพิ่มเอกสาร “${input.name}” เรียบร้อยแล้ว`);
}

export async function updateDocTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "edit");
  const id = str(form, "id");
  const input = readDocType(form);

  if (!id) back("ไม่พบเอกสารที่ต้องการแก้ไข", true);
  const problem = validateDocType(input);
  if (problem) back(problem, true);

  try {
    await updateDocType(id, input);
    await logAudit({
      actor_id: user.id,
      action: "aud_update_doc_type",
      target_table: "aud_doc_types",
      target_id: id,
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกเอกสารประกอบไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`บันทึกเอกสาร “${input.name}” เรียบร้อยแล้ว`);
}

export async function deleteDocTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "delete");
  const id = str(form, "id");
  const name = str(form, "name");

  if (!id) back("ไม่พบเอกสารที่ต้องการลบ", true);

  try {
    await deleteDocType(id);
    await logAudit({
      actor_id: user.id,
      action: "aud_delete_doc_type",
      target_table: "aud_doc_types",
      target_id: id,
      before: { name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบเอกสารประกอบไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`ลบเอกสาร “${name}” เรียบร้อยแล้ว (ใบที่ตรวจไปแล้วยังเก็บชื่อเอกสารไว้ตามเดิม)`);
}

// ---------- รายการตรวจสอบ ----------

function readCheckType(form: FormData): AudCheckTypeInput {
  const kind = str(form, "kind") as AudCheckKind;

  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    kind: AUD_KIND_ORDER.includes(kind) ? kind : "custom",
    description: str(form, "description") || null,
    has_docs: on(form, "has_docs"),
    has_call: on(form, "has_call"),
    has_slip: on(form, "has_slip"),
    has_amount: on(form, "has_amount"),
    ref_label: str(form, "ref_label") || "เลขที่เอกสาร",
    title_label: str(form, "title_label") || "รายละเอียด",
    party_label: str(form, "party_label") || "ผู้เกี่ยวข้อง",
    sort_order: Number(str(form, "sort_order")) || 100,
    is_active: form.has("is_active") ? on(form, "is_active") : true,
  };
}

export async function createCheckTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "write");
  const input = readCheckType(form);

  const problem = validateCheckType(input);
  if (problem) back(problem, true);

  // รายการที่ผู้ใช้เพิ่มเองดึงข้อมูลจากระบบอื่นไม่ได้ — บังคับเป็นชนิดที่กรอกเองเสมอ
  if (input.kind !== "cash" && input.kind !== "custom") {
    back("รายการที่เพิ่มเองต้องเป็นชนิด “กรอกเอง” หรือ “กระทบยอดเงินสด”", true);
  }

  try {
    await createCheckType(input);
    await logAudit({
      actor_id: user.id,
      action: "aud_create_check_type",
      target_table: "aud_check_types",
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มรายการตรวจไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`เพิ่มรายการตรวจ “${input.name}” เรียบร้อยแล้ว`);
}

export async function updateCheckTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "edit");
  const id = str(form, "id");
  if (!id) back("ไม่พบรายการตรวจที่ต้องการแก้ไข", true);

  const existing = await getCheckType(id);
  if (!existing) back("ไม่พบรายการตรวจที่ต้องการแก้ไข", true);

  const input = readCheckType(form);
  const problem = validateCheckType(input);
  if (problem) back(problem, true);

  // รายการตั้งต้นของระบบ (ข้อ 1-3) ห้ามเปลี่ยนแหล่งข้อมูล เพราะหน้าจอดึงข้อมูลตาม kind
  const patch: Partial<AudCheckTypeInput> = existing.is_builtin
    ? { ...input, kind: existing.kind, code: existing.code }
    : input;

  try {
    await updateCheckType(id, patch);
    await logAudit({
      actor_id: user.id,
      action: "aud_update_check_type",
      target_table: "aud_check_types",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกรายการตรวจไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`บันทึกรายการตรวจ “${input.name}” เรียบร้อยแล้ว`);
}

export async function deleteCheckTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_SETUP", "delete");
  const id = str(form, "id");
  const name = str(form, "name");
  if (!id) back("ไม่พบรายการตรวจที่ต้องการลบ", true);

  const rows = await listCheckTypeRows(true);
  const target = rows.find((t) => t.id === id);
  if (!target) back("ไม่พบรายการตรวจที่ต้องการลบ", true);

  if (target.is_builtin) {
    back(
      "รายการตรวจตั้งต้นของระบบลบไม่ได้ — ถ้าไม่ใช้แล้วให้ติ๊ก “เปิดใช้งาน” ออกแทน",
      true,
    );
  }

  if (form.get("confirm") !== "on") {
    back(
      `ต้องติ๊ก "ยืนยัน" ก่อน — รายการนี้ถูกใช้ตรวจไปแล้ว ${target.use_count} ครั้ง` +
        " (ผลตรวจเก่ายังอยู่ครบ เพราะเก็บชื่อรายการ ณ ตอนตรวจไว้แล้ว)",
      true,
    );
  }

  try {
    await deleteCheckType(id);
    await logAudit({
      actor_id: user.id,
      action: "aud_delete_check_type",
      target_table: "aud_check_types",
      target_id: id,
      before: { name, use_count: target.use_count },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบรายการตรวจไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`ลบรายการตรวจ “${name}” เรียบร้อยแล้ว`);
}

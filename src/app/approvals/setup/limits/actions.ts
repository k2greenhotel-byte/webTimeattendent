"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildUserLimits,
  parseAmount,
  validateUserAuthority,
  type UserAuthorityInput,
} from "@/lib/approval";
import {
  deleteLimit,
  deleteLimitsOfUser,
  insertLimit,
  listTypes,
  replaceUserLimits,
  updateLimit,
  updateType,
} from "@/lib/approval-db";
import { getCoreUser } from "@/lib/core-db";
import type { ApvLimit } from "@/lib/approval-types";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false, userId = ""): never {
  const user = userId ? `user=${encodeURIComponent(userId)}&` : "";
  redirect(`/approvals/setup/limits?${user}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
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

// ---------- ผู้มีอำนาจอนุมัติรายบุคคล (เลือกคน → ติ๊กเรื่อง → ใส่วงเงิน) ----------

/** อ่านฟอร์มติ๊กประเภทเรื่อง — หนึ่ง checkbox + หนึ่งช่องวงเงิน ต่อประเภทเรื่องในทะเบียน */
async function readUserAuthority(form: FormData): Promise<UserAuthorityInput> {
  const types = await listTypes();
  return {
    userId: str(form, "user_id"),
    companyId: str(form, "company_id") || null,
    canReject: form.get("can_reject") === "on",
    isFinal: form.get("is_final") === "on",
    entries: types.map((type) => {
      const raw = str(form, `amount__${type.id}`);
      return {
        typeId: type.id,
        enabled: form.get(`enabled__${type.id}`) === "on",
        maxAmount: !type.has_amount || raw === "" ? null : parseAmount(raw),
      };
    }),
  };
}

export async function saveUserAuthorityForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "write");
  const input = await readUserAuthority(form);

  const problem = validateUserAuthority(input);
  if (problem) back(problem, true, input.userId);

  const target = await getCoreUser(input.userId);
  if (!target) back("ไม่พบผู้ใช้ที่เลือก", true);

  const rows = buildUserLimits(input);
  try {
    await replaceUserLimits(input.userId, rows);
    await logAudit({
      actor_id: actor.id,
      action: "apv_set_user_authority",
      target_table: "apv_limits",
      target_id: input.userId,
      after: { user: target.full_name, rules: rows.length, rows },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกอำนาจอนุมัติไม่สำเร็จ", true, input.userId);
  }

  revalidatePath("/approvals/setup/limits");
  revalidatePath("/approvals");
  back(
    rows.length === 0
      ? `บันทึกแล้ว — ${target.full_name} ไม่มีอำนาจอนุมัติเรื่องใดเลย (ใช้ค่าตามระดับแทนถ้ามี)`
      : `บันทึกอำนาจอนุมัติของ ${target.full_name} แล้ว ${rows.length} เรื่อง — มีผลทันที`,
    false,
    input.userId,
  );
}

/** ถอนอำนาจอนุมัติทั้งหมดของคนหนึ่งคน */
export async function revokeUserAuthorityForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "delete");
  const userId = str(form, "user_id");
  if (!userId) back("ไม่พบผู้ใช้", true);
  if (form.get("confirm") !== "on") back('ต้องติ๊ก "ยืนยัน" ก่อนถอนอำนาจ', true);

  let removed = 0;
  try {
    removed = await deleteLimitsOfUser(userId);
    await logAudit({
      actor_id: actor.id,
      action: "apv_revoke_user_authority",
      target_table: "apv_limits",
      target_id: userId,
      after: { removed },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ถอนอำนาจไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/limits");
  revalidatePath("/approvals");
  back(`ถอนอำนาจอนุมัติแล้ว (ลบกฎ ${removed} ข้อ) — คนนี้กลับไปใช้ค่าตามระดับการทำงาน`);
}

// ---------- วงเงินไม่ต้องขออนุมัติ (ต่อประเภทเรื่อง) ----------

export async function updateAutoApproveForm(form: FormData): Promise<void> {
  const actor = await requirePermission("APV_LIMITS", "edit");
  const typeId = str(form, "type_id");
  const raw = str(form, "auto_approve_limit");
  const limit = raw === "" ? null : parseAmount(raw);

  if (!typeId) back("ไม่พบประเภทเรื่อง", true);
  if (limit !== null && limit < 0) back("วงเงินไม่ต้องขออนุมัติต้องไม่ติดลบ (เว้นว่าง = ต้องขออนุมัติทุกใบ)", true);

  try {
    await updateType(typeId, { auto_approve_limit: limit });
    await logAudit({
      actor_id: actor.id,
      action: "apv_set_auto_approve",
      target_table: "apv_types",
      target_id: typeId,
      after: { auto_approve_limit: limit },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกวงเงินไม่สำเร็จ", true);
  }

  revalidatePath("/approvals/setup/limits");
  revalidatePath("/approvals/setup/types");
  back(
    limit === null
      ? "บันทึกแล้ว — เรื่องนี้ต้องขออนุมัติทุกใบ"
      : `บันทึกแล้ว — ยอดไม่เกิน ${limit.toLocaleString("th-TH")} บาท จะอนุมัติอัตโนมัติ ไม่ต้องรอผู้มีอำนาจ`,
  );
}

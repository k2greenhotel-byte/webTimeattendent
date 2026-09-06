"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { validateAccount } from "@/lib/procurement";
import {
  countAccountUsage,
  deleteAccount,
  getAccount,
  insertAccount,
  updateAccount,
} from "@/lib/procurement-db";
import { ACCOUNT_CATEGORY_ORDER, type PrAccountInput } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

const PATH = "/procurement/setup/accounts";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readInput(form: FormData): PrAccountInput {
  const category = str(form, "category");

  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    category: (ACCOUNT_CATEGORY_ORDER as string[]).includes(category)
      ? (category as PrAccountInput["category"])
      : "expense",
    parent_id: str(form, "parent_id") || null,
    sort_order: Number(str(form, "sort_order")) || 0,
    is_active: form.get("is_active") === "on",
  };
}

export async function createAccountForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_ACCOUNT", "write");
  const input = { ...readInput(form), is_active: true };

  const parent = input.parent_id ? await getAccount(input.parent_id) : null;
  const problem = validateAccount(input, parent);
  if (problem) back(problem, true);

  try {
    await insertAccount(input);
    await logAudit({
      actor_id: user.id,
      action: "pr_create_account",
      target_table: "pr_accounts",
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มบัญชีไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`เพิ่มบัญชี ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function updateAccountForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_ACCOUNT", "edit");
  const id = str(form, "id");
  const input = readInput(form);

  if (!id) back("ไม่พบบัญชีที่ต้องการแก้ไข", true);

  const parent = input.parent_id ? await getAccount(input.parent_id) : null;
  const problem = validateAccount(input, parent, id);
  if (problem) back(problem, true);

  try {
    await updateAccount(id, input);
    await logAudit({
      actor_id: user.id,
      action: "pr_update_account",
      target_table: "pr_accounts",
      target_id: id,
      after: input,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกบัญชีไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`บันทึกบัญชี ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function deleteAccountForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_ACCOUNT", "delete");
  const id = str(form, "id");
  const name = str(form, "name");

  if (!id) back("ไม่พบบัญชีที่ต้องการลบ", true);

  const usage = await countAccountUsage(id);
  if (form.get("confirm") !== "on") {
    back(
      `ต้องติ๊ก "ยืนยัน" ก่อน — บัญชีนี้มีใบเบิกอ้างถึง ${usage.payments} ใบ และมีบัญชีย่อย ${usage.children} บัญชี` +
        " (ลบแล้วรายการที่อ้างถึงจะกลายเป็นไม่ระบุบัญชี)",
      true,
    );
  }

  try {
    await deleteAccount(id);
    await logAudit({
      actor_id: user.id,
      action: "pr_delete_account",
      target_table: "pr_accounts",
      target_id: id,
      before: { name, ...usage },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบบัญชีไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`ลบบัญชี ${name} เรียบร้อยแล้ว`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { parseAmount, validateFund } from "@/lib/procurement";
import { createFund, deleteFund, fundUsage, getFund, updateFund } from "@/lib/procurement-db";
import type { PrFundInput } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

const PATH = "/procurement/setup/funds";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readFund(form: FormData): PrFundInput {
  return {
    holder_id: str(form, "holder_id"),
    company_id: str(form, "company_id") || null,
    branch_id: str(form, "branch_id") || null,
    limit_amount: parseAmount(str(form, "limit_amount")),
    note: str(form, "note") || null,
    is_active: form.get("is_active") === "on",
  };
}

export async function createFundForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_FUND", "write");
  const row = readFund(form);

  const problem = validateFund(row);
  if (problem) back(problem, true);

  try {
    await createFund(row);
    await logAudit({
      actor_id: user.id,
      action: "create_fund",
      target_table: "pr_funds",
      target_id: null,
      after: { holder_id: row.holder_id, limit_amount: row.limit_amount },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกวงเงินสำรองจ่ายไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back("เพิ่มวงเงินสำรองจ่ายเรียบร้อยแล้ว");
}

export async function updateFundForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_FUND", "edit");
  const id = str(form, "id");
  if (!id) back("ไม่พบวงเงินสำรองจ่ายที่ต้องการแก้ไข", true);

  const row = readFund(form);
  const problem = validateFund(row);
  if (problem) back(problem, true);

  /*
   * ลดวงเงินลงต่ำกว่าเงินที่ถืออยู่จริงไม่ได้ — เงินอยู่ในมือคนถือแล้ว
   * ถ้าจะลดวงเงินต้องให้เขาคืนเงินเข้าบริษัทก่อน ยอดคงเหลือจะได้ไม่เกินวงเงิน
   */
  const current = await getFund(id);
  if (current && row.limit_amount < current.balance) {
    back(
      `ลดวงเงินต่ำกว่าเงินที่ถืออยู่ (${current.balance.toLocaleString("th-TH")} บาท) ไม่ได้ — ให้คืนเงินเข้าบริษัทก่อน`,
      true,
    );
  }

  try {
    await updateFund(id, row);
    await logAudit({
      actor_id: user.id,
      action: "update_fund",
      target_table: "pr_funds",
      target_id: id,
      after: { limit_amount: row.limit_amount, is_active: row.is_active },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกวงเงินสำรองจ่ายไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back("แก้ไขวงเงินสำรองจ่ายเรียบร้อยแล้ว");
}

export async function deleteFundForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_FUND", "delete");
  const id = str(form, "id");
  if (!id) back("ไม่พบวงเงินสำรองจ่ายที่ต้องการลบ", true);

  // กองที่เคยเคลื่อนไหวแล้วลบไม่ได้ ไม่งั้นประวัติเงินจะขาดหาย — ให้ปิดใช้งานแทน
  const usage = await fundUsage(id);
  if (usage.moves > 0 || usage.payments > 0) {
    back(
      `กองนี้มีการเติมเงิน ${usage.moves} ครั้ง และใบจ่าย ${usage.payments} ใบแล้ว ลบไม่ได้ — ให้ติ๊ก "ใช้งาน" ออกเพื่อปิดกองแทน`,
      true,
    );
  }

  try {
    await deleteFund(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_fund",
      target_table: "pr_funds",
      target_id: id,
      after: null,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบวงเงินสำรองจ่ายไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back("ลบวงเงินสำรองจ่ายเรียบร้อยแล้ว");
}

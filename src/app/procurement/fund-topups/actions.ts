"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { parseAmount, validateFundMove } from "@/lib/procurement";
import { createFundMove, deleteFundMove, getFund, listFundMoves } from "@/lib/procurement-db";
import { FUND_MOVE_ORDER, type FundMoveKind } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

const PATH = "/procurement/fund-topups";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(fundId: string, message: string, isError = false): never {
  const query = new URLSearchParams();
  if (fundId) query.set("fund", fundId);
  query.set(isError ? "err" : "msg", message);
  redirect(`${PATH}?${query.toString()}`);
}

export async function createFundMoveForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_FUND_TOPUP", "write");

  const fundId = str(form, "fund_id");
  const kind = (FUND_MOVE_ORDER as string[]).includes(str(form, "kind"))
    ? (str(form, "kind") as FundMoveKind)
    : "topup";

  const row = {
    fund_id: fundId,
    move_date: str(form, "move_date"),
    kind,
    amount: parseAmount(str(form, "amount")),
    ref_no: str(form, "ref_no") || null,
    note: str(form, "note") || null,
    created_by: user.id,
    created_by_name: str(form, "created_by_name") || user.full_name,
  };

  if (!fundId) back("", "กรุณาเลือกกองเงินสำรอง", true);

  // อ่านยอดคงเหลือจริง ณ ตอนบันทึก แล้วค่อยตรวจ — กันสองคนเติมพร้อมกันจนเกินวงเงิน
  const fund = await getFund(fundId);
  const problem = validateFundMove(row, fund);
  if (problem) back(fundId, problem, true);

  let docNo = "";
  try {
    docNo = await createFundMove(row);
    await logAudit({
      actor_id: user.id,
      action: kind === "topup" ? "fund_topup" : "fund_return",
      target_table: "pr_fund_moves",
      target_id: null,
      after: { doc_no: docNo, fund_id: fundId, amount: row.amount },
    });
  } catch (err) {
    back(fundId, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(
    fundId,
    `${kind === "topup" ? "เติมเงินเข้ากอง" : "คืนเงินกลับบริษัท"} เลขที่ ${docNo} เรียบร้อยแล้ว`,
  );
}

export async function deleteFundMoveForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_FUND_TOPUP", "delete");
  const id = str(form, "id");
  const fundId = str(form, "fund_id");
  if (!id) back(fundId, "ไม่พบรายการที่ต้องการลบ", true);

  if (form.get("confirm") !== "on") {
    back(fundId, 'ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วยอดคงเหลือของกองจะเปลี่ยนตาม', true);
  }

  /*
   * ลบรายการเติมเงินแล้วยอดคงเหลือจะลดลง ถ้าลดจนติดลบแปลว่าเงินก้อนนั้นถูกจ่ายออกไปแล้ว
   * ต้องไปลบใบจ่ายก่อน ไม่งั้นกองจะมียอดติดลบซึ่งเป็นไปไม่ได้ในความจริง
   */
  const [fund, moves] = await Promise.all([getFund(fundId), listFundMoves({ fund_id: fundId })]);
  const target = moves.find((m) => m.id === id);

  if (fund && target && target.kind === "topup" && fund.balance - target.amount < 0) {
    back(
      fundId,
      `ลบไม่ได้ — เงินก้อนนี้ถูกจ่ายออกไปแล้วบางส่วน (คงเหลือ ${fund.balance.toLocaleString("th-TH")} บาท) ต้องไปลบใบจ่ายก่อน`,
      true,
    );
  }

  try {
    await deleteFundMove(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_fund_move",
      target_table: "pr_fund_moves",
      target_id: id,
      after: { doc_no: target?.doc_no, amount: target?.amount },
    });
  } catch (err) {
    back(fundId, err instanceof Error ? err.message : "ลบรายการไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(fundId, "ลบรายการเรียบร้อยแล้ว");
}

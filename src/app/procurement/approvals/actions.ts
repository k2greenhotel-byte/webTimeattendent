"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyEmployeePin } from "@/lib/auth";
import { logAudit } from "@/lib/db";
import { parseAmount, validateApproval } from "@/lib/procurement";
import { createApproval, getDoc } from "@/lib/procurement-db";
import {
  APPROVE_DECISION_ORDER,
  DOC_KIND_ORDER,
  REJECT_REASON_ORDER,
  type ApprovalInput,
} from "@/lib/procurement-types";
import {
  clearApproverSession,
  createApproverSession,
  requireApprover,
  requirePermission,
} from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function pick<T extends string>(form: FormData, key: string, allowed: readonly T[]): T | null {
  const value = str(form, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

// ---------- ประตูรหัสผ่านของหน้าอนุมัติ (ข้อ 3.1) ----------

export type ApproverGateState = { error: string | null };

/**
 * ยืนยันรหัสผ่านของผู้อนุมัติเองก่อนเข้าหน้าจออนุมัติ
 * ต้องมีสิทธิ์เมนู PR_APPROVE อยู่แล้ว รหัสผ่านเป็นด่านที่สอง ไม่ใช่ด่านเดียว
 */
export async function approverLoginAction(
  _prev: ApproverGateState,
  form: FormData,
): Promise<ApproverGateState> {
  const user = await requirePermission("PR_APPROVE", "write");
  const pin = str(form, "pin");

  const result = await verifyEmployeePin(user.id, pin);
  if (!result.ok) {
    await logAudit({
      actor_id: user.id,
      action: "approver_gate_failed",
      target_table: "pr_approvals",
      target_id: null,
      after: { reason: result.error },
    });
    return { error: result.error };
  }

  await createApproverSession(user.id);
  redirect("/procurement/approvals");
}

export async function approverLogoutAction(): Promise<void> {
  await clearApproverSession();
  redirect("/procurement/approvals");
}

// ---------- บันทึกผลการอนุมัติ (ข้อ 3.1.1-3.1.6) ----------

export async function createApprovalForm(form: FormData): Promise<void> {
  const user = await requireApprover();

  const kind = pick(form, "kind", DOC_KIND_ORDER);
  const docId = str(form, "doc_id");
  const path = kind && docId ? `/procurement/approvals/${kind}/${docId}` : "/procurement/approvals";

  if (!kind || !docId) back("/procurement/approvals", "ไม่พบเอกสารที่ต้องการอนุมัติ", true);

  const target = await getDoc(docId);
  const decision = pick(form, "decision", APPROVE_DECISION_ORDER);

  const row: ApprovalInput = {
    approve_date: str(form, "approve_date"),
    approver_id: user.id,
    approver_name: user.full_name,
    decision: decision ?? "pending",
    reject_reason: pick(form, "reject_reason", REJECT_REASON_ORDER),
    approved_amount: parseAmount(str(form, "approved_amount")),
    note: str(form, "note") || null,
    repair_id: kind === "repair" ? docId : null,
    purchase_id: kind === "purchase" ? docId : null,
  };

  const problem = validateApproval(row, target);
  if (problem) back(path, problem, true);

  let docNo = "";
  try {
    const created = await createApproval(row);
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_approval",
      target_table: "pr_approvals",
      target_id: created.id,
      after: {
        doc_no: docNo,
        decision: row.decision,
        approved_amount: row.approved_amount,
        target_doc: target?.doc_no,
      },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกผลการอนุมัติไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/approvals");
  revalidatePath(
    kind === "repair" ? `/procurement/repairs/${docId}` : `/procurement/purchases/${docId}`,
  );
  back("/procurement/approvals", `บันทึกใบอนุมัติเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

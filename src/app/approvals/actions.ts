"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAmount, validateDecision, validateRequest } from "@/lib/approval";
import {
  cancelRequest,
  createApprovalRequest,
  createDecision,
  getRequest,
  listTypes,
} from "@/lib/approval-db";
import { authorityFor, getLimits, requireApvApprover } from "@/lib/approval-session";
import { APV_DECISION_ORDER, type ApvDecision } from "@/lib/approval-types";
import { verifyEmployeePin } from "@/lib/auth";
import { logAudit } from "@/lib/db";
import { clearApproverSession, createApproverSession, requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

// ---------- ประตูรหัสผ่านของผู้อนุมัติ ----------

export type ApproverGateState = { error: string | null };

export async function apvApproverLoginAction(
  _prev: ApproverGateState,
  form: FormData,
): Promise<ApproverGateState> {
  const user = await requirePermission("APV_INBOX", "write");
  const result = await verifyEmployeePin(user.id, str(form, "pin"));

  if (!result.ok) {
    await logAudit({
      actor_id: user.id,
      action: "apv_gate_failed",
      target_table: "apv_requests",
      target_id: null,
      after: { reason: result.error },
    });
    return { error: result.error };
  }

  await createApproverSession(user.id);
  redirect("/approvals");
}

export async function apvApproverLogoutAction(): Promise<void> {
  await clearApproverSession();
  redirect("/approvals");
}

// ---------- ยื่นเรื่องขออนุมัติ ----------

export async function createRequestForm(form: FormData): Promise<void> {
  const user = await requirePermission("APV_NEW", "write");

  const typeId = str(form, "type_id");
  const input = {
    typeId,
    subject: str(form, "subject"),
    detail: str(form, "detail"),
    requestedAmount: parseAmount(str(form, "requested_amount")),
    neededBy: str(form, "needed_by") || null,
  };

  const type = (await listTypes(true)).find((t) => t.id === typeId) ?? null;
  const problem = validateRequest(input, type);
  if (problem || !type) back("/approvals/new", problem ?? "ไม่พบประเภทเรื่อง", true);

  let docNo = "";
  try {
    const created = await createApprovalRequest({
      typeCode: type.code,
      subject: input.subject,
      detail: input.detail || null,
      amount: type.has_amount ? input.requestedAmount : 0,
      neededBy: input.neededBy,
      companyId: user.company_id ?? null,
      branchId: user.branch_id ?? null,
      requesterId: user.id,
      requesterName: user.full_name,
    });
    docNo = created.doc_no;

    await logAudit({
      actor_id: user.id,
      action: "apv_create_request",
      target_table: "apv_requests",
      target_id: created.id,
      after: { doc_no: created.doc_no, type: type.code, amount: created.requested_amount },
    });
  } catch (err) {
    back("/approvals/new", err instanceof Error ? err.message : "ยื่นเรื่องไม่สำเร็จ", true);
  }

  revalidatePath("/approvals");
  revalidatePath("/approvals/mine");
  back("/approvals/mine", `ยื่นเรื่องเรียบร้อยแล้ว เลขที่ ${docNo} — รอผู้มีอำนาจพิจารณา`);
}

export async function cancelRequestForm(form: FormData): Promise<void> {
  const user = await requirePermission("APV_MINE", "read");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") {
    back(`/approvals/${id}`, 'ต้องติ๊ก "ยืนยัน" ก่อนยกเลิกเรื่อง', true);
  }

  try {
    await cancelRequest(id, user.id);
    await logAudit({
      actor_id: user.id,
      action: "apv_cancel_request",
      target_table: "apv_requests",
      target_id: id,
    });
  } catch (err) {
    back(`/approvals/${id}`, err instanceof Error ? err.message : "ยกเลิกเรื่องไม่สำเร็จ", true);
  }

  revalidatePath("/approvals");
  back("/approvals/mine", "ยกเลิกเรื่องเรียบร้อยแล้ว");
}

// ---------- ตัดสินเรื่อง ----------

export async function decideForm(form: FormData): Promise<void> {
  const user = await requireApvApprover();
  const id = str(form, "id");
  const path = `/approvals/${id}`;

  const row = await getRequest(id);
  if (!row) back("/approvals", "ไม่พบใบขออนุมัติ", true);

  const decisionValue = str(form, "decision");
  const decision = (APV_DECISION_ORDER as string[]).includes(decisionValue)
    ? (decisionValue as ApvDecision)
    : null;
  if (!decision) back(path, "กรุณาเลือกผลการพิจารณา", true);

  const input = {
    decision,
    approvedAmount: parseAmount(str(form, "approved_amount")),
    reasonId: str(form, "reason_id") || null,
    note: str(form, "note"),
  };

  const authority = authorityFor(await getLimits(), user, row);
  const problem = validateDecision(row, authority, input);
  if (problem) back(path, problem, true);

  try {
    await createDecision(row, input, {
      approverId: user.id,
      approverName: user.full_name,
      approverLevel: user.level,
      authorityLimit: authority.maxAmount,
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกการพิจารณาไม่สำเร็จ", true);
  }

  revalidatePath("/approvals");
  revalidatePath(path);

  const done: Record<ApvDecision, string> = {
    approve: `อนุมัติ ${row.doc_no} เรียบร้อยแล้ว`,
    partial: `อนุมัติบางส่วน ${row.doc_no} เรียบร้อยแล้ว`,
    reject: `บันทึกไม่อนุมัติ ${row.doc_no} เรียบร้อยแล้ว`,
    endorse: `เสนอ ${row.doc_no} ขึ้นผู้มีอำนาจสูงกว่าแล้ว`,
  };
  back("/approvals", done[decision]);
}

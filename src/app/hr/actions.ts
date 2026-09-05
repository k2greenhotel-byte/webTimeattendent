"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyEmployeePin } from "@/lib/auth";
import { workDateOf } from "@/lib/datetime";
import { logAudit } from "@/lib/db";
import {
  evaluateLeave,
  parseAmount,
  validateAdvanceDecision,
  validateAdvanceInput,
  validateLeaveDecision,
  validateLeaveInput,
  type AdvanceDecisionInput,
  type LeaveDecisionInput,
  type LeaveInput,
} from "@/lib/leave";
import {
  addLeaveFiles,
  cancelAdvanceRequest,
  cancelLeaveRequest,
  createAdvanceRequest,
  createLeaveRequest,
  decideAdvanceRequest,
  decideLeaveRequest,
  deleteLeaveFile,
  getAdvanceRequest,
  getHireDate,
  getLeaveRequest,
  listLeaveTypes,
  markCertReceived,
  usedLeaveDays,
  type NewLeaveFile,
} from "@/lib/leave-db";
import { advanceAuthorityFor, requireAdvanceApprover, requireLeaveApprover } from "@/lib/leave-session";
import {
  ADVANCE_DECISION_ORDER,
  ADVANCE_STATUS_LABEL,
  LEAVE_DECISION_ORDER,
  LEAVE_STATUS_LABEL,
  MAX_LEAVE_FILES,
  type AdvanceStatus,
  type LeaveFileKind,
  type LeaveStatus,
} from "@/lib/leave-types";
import { clearApproverSession, createApproverSession, requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** อ่านรายการไฟล์ที่ FileUploader ส่งมา (หนึ่ง JSON ต่อไฟล์) */
function readFiles(form: FormData, field: string, kind: LeaveFileKind): NewLeaveFile[] {
  const files: NewLeaveFile[] = [];

  for (const raw of form.getAll(field)) {
    const text = String(raw).trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as {
        path?: string;
        filename?: string;
        mime?: string | null;
        size?: number | null;
      };
      if (!parsed.path) continue;
      files.push({
        kind,
        path: parsed.path,
        filename: parsed.filename ?? parsed.path.split("/").pop() ?? "ไฟล์แนบ",
        mime: parsed.mime ?? null,
        size: parsed.size ?? null,
      });
    } catch {
      // บรรทัดที่อ่านไม่ออกให้ข้ามไป ไม่ควรทำให้บันทึกทั้งใบล้มเหลว
    }
  }
  return files.slice(0, MAX_LEAVE_FILES);
}

// ---------- ประตูรหัสผ่านของผู้อนุมัติ (ใช้ cookie ร่วมกับระบบอนุมัติกลาง) ----------

export type HrGateState = { error: string | null };

const GATE_MENU: Record<string, { menu: string; path: string }> = {
  leave: { menu: "HR_LEAVE_APPROVE", path: "/hr/approvals/leave" },
  advance: { menu: "HR_ADV_APPROVE", path: "/hr/approvals/advance" },
};

export async function hrApproverLoginAction(
  _prev: HrGateState,
  form: FormData,
): Promise<HrGateState> {
  const gate = GATE_MENU[str(form, "kind")] ?? GATE_MENU.leave;
  const user = await requirePermission(gate.menu, "write");
  const result = await verifyEmployeePin(user.id, str(form, "pin"));

  if (!result.ok) {
    await logAudit({
      actor_id: user.id,
      action: "hr_gate_failed",
      target_table: "hr_leave_requests",
      target_id: null,
      after: { reason: result.error, screen: gate.path },
    });
    return { error: result.error };
  }

  await createApproverSession(user.id);
  redirect(gate.path);
}

export async function hrApproverLogoutAction(form: FormData): Promise<void> {
  const gate = GATE_MENU[str(form, "kind")] ?? GATE_MENU.leave;
  await clearApproverSession();
  redirect(gate.path);
}

// ---------- แจ้งลา / หยุดงาน / เข้างานสาย ----------

export async function createLeaveForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_LEAVE_NEW", "write");

  const typeId = str(form, "type_id");
  const type = (await listLeaveTypes(true)).find((t) => t.id === typeId) ?? null;

  const startDate = str(form, "start_date");
  const endDate = type?.needs_date_range ? str(form, "end_date") || startDate : startDate;
  const input: LeaveInput = {
    typeId,
    detail: str(form, "detail"),
    startDate,
    endDate,
    totalDays: type?.needs_date_range ? Number(str(form, "total_days") || 1) : 1,
    arrivalTime: str(form, "arrival_time") || null,
  };

  const problem = validateLeaveInput(input, type);
  if (problem || !type) back("/hr/leave/new", problem ?? "ไม่พบประเภทการลา", true);

  // เวลาที่แจ้งต้องมาจาก server เสมอ — เครื่องผู้ใช้ปรับนาฬิกาได้ และเวลานี้มีผลต่อการหักเงิน
  const reportedAt = new Date();
  const requestDate = workDateOf(reportedAt);

  const evaluation = evaluateLeave(type, input, {
    requestDate,
    reportedAt,
    hireDate: await getHireDate(user.id),
    usedDaysThisYear: await usedLeaveDays(user.id, type.id, Number(requestDate.slice(0, 4))),
  });
  if (evaluation.blocked) back("/hr/leave/new", evaluation.blocked, true);

  const files = [
    ...readFiles(form, "attach_file", "attach"),
    ...readFiles(form, "cert_file", "cert"),
  ];

  let docNo = "";
  try {
    const created = await createLeaveRequest({
      typeId: type.id,
      detail: input.detail,
      startDate: input.startDate,
      endDate: input.endDate,
      totalDays: input.totalDays,
      arrivalTime: input.arrivalTime,
      employeeId: user.id,
      employeeName: user.full_name,
      companyId: user.company_id ?? null,
      branchId: user.branch_id ?? null,
      requestDate,
      reportedAt,
      noticeDays: evaluation.noticeDays,
      serviceMonths: evaluation.serviceMonths,
      countsAsAbsent: evaluation.countsAsAbsent,
      isLateNotice: evaluation.isLateNotice,
      penaltyMultiplier: evaluation.penaltyMultiplier,
      certDueDate: evaluation.certDueDate,
      files,
    });
    docNo = created.doc_no;

    await logAudit({
      actor_id: user.id,
      action: "hr_leave_create",
      target_table: "hr_leave_requests",
      target_id: created.id,
      after: {
        doc_no: created.doc_no,
        type: type.code,
        start_date: created.start_date,
        counts_as_absent: created.counts_as_absent,
        is_late_notice: created.is_late_notice,
      },
    });
  } catch (err) {
    back("/hr/leave/new", err instanceof Error ? err.message : "บันทึกใบแจ้งลาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/approvals/leave");

  const extra = evaluation.warnings.length ? ` · ${evaluation.warnings.join(" · ")}` : "";
  back("/hr/leave", `บันทึกใบแจ้งเรียบร้อยแล้ว เลขที่ ${docNo} — รอผู้มีอำนาจพิจารณา${extra}`);
}

export async function cancelLeaveForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_LEAVE_MINE", "read");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") {
    back(`/hr/leave/${id}`, 'ต้องติ๊ก "ยืนยัน" ก่อนยกเลิกใบแจ้ง', true);
  }

  try {
    await cancelLeaveRequest(id, user.id);
    await logAudit({
      actor_id: user.id,
      action: "hr_leave_cancel",
      target_table: "hr_leave_requests",
      target_id: id,
    });
  } catch (err) {
    back(`/hr/leave/${id}`, err instanceof Error ? err.message : "ยกเลิกใบแจ้งไม่สำเร็จ", true);
  }

  revalidatePath("/hr/leave");
  back("/hr/leave", "ยกเลิกใบแจ้งเรียบร้อยแล้ว");
}

/** แนบใบรับรองแพทย์/เอกสารเพิ่มเติมหลังยื่นไปแล้ว (ลาป่วยมีเวลา 3 วัน) */
export async function addLeaveFilesForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_LEAVE_MINE", "read");
  const id = str(form, "id");
  const path = `/hr/leave/${id}`;

  const row = await getLeaveRequest(id);
  if (!row) back("/hr/leave", "ไม่พบใบแจ้งลา", true);
  if (row.employee_id !== user.id) {
    back(path, "แนบไฟล์ได้เฉพาะใบแจ้งของตัวเอง", true);
  }

  const kind: LeaveFileKind = str(form, "kind") === "cert" ? "cert" : "attach";
  const files = readFiles(form, "new_file", kind);
  if (files.length === 0) back(path, "ยังไม่ได้เลือกไฟล์", true);

  try {
    await addLeaveFiles(id, files, user.id);
    await logAudit({
      actor_id: user.id,
      action: "hr_leave_file_add",
      target_table: "hr_leave_requests",
      target_id: id,
      after: { doc_no: row.doc_no, kind, count: files.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "แนบไฟล์ไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(path, kind === "cert" ? "แนบใบรับรองแพทย์เรียบร้อยแล้ว" : "แนบเอกสารเรียบร้อยแล้ว");
}

export async function deleteLeaveFileForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_LEAVE_MINE", "read");
  const id = str(form, "id");
  const fileId = str(form, "file_id");
  const path = `/hr/leave/${id}`;

  const row = await getLeaveRequest(id);
  if (!row) back("/hr/leave", "ไม่พบใบแจ้งลา", true);
  if (row.employee_id !== user.id) back(path, "ลบไฟล์ได้เฉพาะใบแจ้งของตัวเอง", true);
  if (row.status !== "pending" && row.status !== "need_docs") {
    back(path, "ใบนี้ตัดสินไปแล้ว ลบไฟล์แนบไม่ได้", true);
  }

  try {
    await deleteLeaveFile(fileId, user.id);
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบไฟล์ไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(path, "ลบไฟล์แนบเรียบร้อยแล้ว");
}

// ---------- อนุมัติการลา ----------

export async function decideLeaveForm(form: FormData): Promise<void> {
  const user = await requireLeaveApprover();
  const id = str(form, "id");
  const backTo = str(form, "back") || "/hr/approvals/leave";

  const row = await getLeaveRequest(id);
  if (!row) back(backTo, "ไม่พบใบแจ้งลา", true);

  const value = str(form, "status");
  const status = (LEAVE_DECISION_ORDER as string[]).includes(value) ? (value as LeaveStatus) : null;
  if (!status) back(backTo, `กรุณาเลือกผลการพิจารณาของใบ ${row.doc_no}`, true);

  const input: LeaveDecisionInput = {
    status,
    note: str(form, "note"),
    reasonId: str(form, "reason_id") || null,
  };

  const problem = validateLeaveDecision(row, input);
  if (problem) back(backTo, problem, true);

  try {
    await decideLeaveRequest(row, input, { id: user.id, name: user.full_name });
  } catch (err) {
    back(backTo, err instanceof Error ? err.message : "บันทึกผลการพิจารณาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/approvals/leave");
  revalidatePath(`/hr/leave/${id}`);
  revalidatePath("/approvals");
  back(backTo, `${row.doc_no}: ${LEAVE_STATUS_LABEL[status]} เรียบร้อยแล้ว`);
}

export async function markCertForm(form: FormData): Promise<void> {
  const user = await requireLeaveApprover();
  const id = str(form, "id");
  const backTo = str(form, "back") || `/hr/leave/${id}`;

  try {
    await markCertReceived(id, str(form, "received") === "1", user.id);
  } catch (err) {
    back(backTo, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath(backTo);
  back(backTo, "บันทึกสถานะใบรับรองแพทย์เรียบร้อยแล้ว");
}

// ---------- ขอเบิกเงินเดือน ----------

export async function createAdvanceForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_ADV_NEW", "write");

  const input = {
    purpose: str(form, "purpose"),
    detail: str(form, "detail"),
    amount: parseAmount(str(form, "amount")),
  };

  const problem = validateAdvanceInput(input);
  if (problem) back("/hr/advance/new", problem, true);

  let docNo = "";
  try {
    const created = await createAdvanceRequest({
      ...input,
      employeeId: user.id,
      employeeName: user.full_name,
      companyId: user.company_id ?? null,
      branchId: user.branch_id ?? null,
      requestDate: workDateOf(),
    });
    docNo = created.doc_no;

    await logAudit({
      actor_id: user.id,
      action: "hr_advance_create",
      target_table: "hr_advance_requests",
      target_id: created.id,
      after: { doc_no: created.doc_no, amount: created.amount, purpose: created.purpose },
    });
  } catch (err) {
    back("/hr/advance/new", err instanceof Error ? err.message : "บันทึกใบขอเบิกไม่สำเร็จ", true);
  }

  revalidatePath("/hr/advance");
  revalidatePath("/hr/approvals/advance");
  back("/hr/advance", `บันทึกใบขอเบิกเรียบร้อยแล้ว เลขที่ ${docNo} — รอผู้มีอำนาจพิจารณา`);
}

export async function cancelAdvanceForm(form: FormData): Promise<void> {
  const user = await requirePermission("HR_ADV_MINE", "read");
  const id = str(form, "id");

  if (form.get("confirm") !== "on") {
    back(`/hr/advance/${id}`, 'ต้องติ๊ก "ยืนยัน" ก่อนยกเลิกใบขอเบิก', true);
  }

  try {
    await cancelAdvanceRequest(id, user.id);
    await logAudit({
      actor_id: user.id,
      action: "hr_advance_cancel",
      target_table: "hr_advance_requests",
      target_id: id,
    });
  } catch (err) {
    back(`/hr/advance/${id}`, err instanceof Error ? err.message : "ยกเลิกใบขอเบิกไม่สำเร็จ", true);
  }

  revalidatePath("/hr/advance");
  back("/hr/advance", "ยกเลิกใบขอเบิกเรียบร้อยแล้ว");
}

// ---------- อนุมัติขอเบิกเงิน ----------

export async function decideAdvanceForm(form: FormData): Promise<void> {
  const user = await requireAdvanceApprover();
  const id = str(form, "id");
  const backTo = str(form, "back") || "/hr/approvals/advance";

  const row = await getAdvanceRequest(id);
  if (!row) back(backTo, "ไม่พบใบขอเบิกเงิน", true);

  const value = str(form, "status");
  const status = (ADVANCE_DECISION_ORDER as string[]).includes(value)
    ? (value as AdvanceStatus)
    : null;
  if (!status) back(backTo, `กรุณาเลือกผลการพิจารณาของใบ ${row.doc_no}`, true);

  const input: AdvanceDecisionInput = {
    status,
    approvedAmount: parseAmount(str(form, "approved_amount")),
    note: str(form, "note"),
    reasonId: str(form, "reason_id") || null,
  };

  const authority = await advanceAuthorityFor(user, row.company_id);
  const problem = validateAdvanceDecision(row, input, authority);
  if (problem) back(backTo, problem, true);

  try {
    await decideAdvanceRequest(row, input, { id: user.id, name: user.full_name });
  } catch (err) {
    back(backTo, err instanceof Error ? err.message : "บันทึกผลการพิจารณาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/approvals/advance");
  revalidatePath(`/hr/advance/${id}`);
  revalidatePath("/approvals");
  back(backTo, `${row.doc_no}: ${ADVANCE_STATUS_LABEL[status]} เรียบร้อยแล้ว`);
}

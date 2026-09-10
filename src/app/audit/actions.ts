"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isAuditEditable,
  validateAudit,
  validateCheckResult,
} from "@/lib/audit";
import {
  addChecks,
  createAudit,
  deleteAudit,
  deleteCheck,
  getAudit,
  getCheck,
  getCheckType,
  saveCheckResult,
  setAuditStatus,
  updateAudit,
} from "@/lib/audit-db";
import type {
  AudAuditInput,
  AudCallResult,
  AudAmountResult,
  AudCheckResultInput,
  AudCheckSource,
  AudDocResult,
  AudInfoResult,
  AudResult,
  AudSlipResult,
  AudStatus,
} from "@/lib/audit-types";
import { getBranchById } from "@/lib/db";
import { listCompanies } from "@/lib/core-db";
import { db2Sales } from "@/lib/db2-api";
import { logAudit } from "@/lib/db";
import { getPayment } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";

const LIST_PATH = "/audit/audits";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function optNum(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** ใบคุมงานที่แก้ไขได้เท่านั้นถึงจะเพิ่ม/แก้รายการตรวจได้ */
async function requireOpenAudit(auditId: string, action: "write" | "edit" | "delete") {
  const user = await requirePermission("AUD_ENTRY", action);
  const audit = await getAudit(auditId);
  if (!audit) back(LIST_PATH, "ไม่พบใบคุมงานที่ต้องการ", true);
  if (!isAuditEditable(audit.status)) {
    back(
      `${LIST_PATH}/${auditId}`,
      "ใบคุมงานนี้ส่งผลหรือยกเลิกแล้ว กด “เปิดกลับมาแก้ไข” ก่อนจึงจะบันทึกต่อได้",
      true,
    );
  }
  return { user, audit };
}

// ---------- ใบคุมงาน ----------

/** เปิดใบคุมงานใหม่ — ผู้ตรวจสอบดึงจากบัญชีที่ล็อกอินอยู่เสมอ (ไม่ให้พิมพ์เอง) */
export async function createAuditForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_ENTRY", "write");

  const companyId = str(form, "company_id") || null;
  const branchId = str(form, "branch_id") || null;
  const [companies, branch] = await Promise.all([
    companyId ? listCompanies(true) : Promise.resolve([]),
    branchId ? getBranchById(branchId) : Promise.resolve(null),
  ]);

  const input: AudAuditInput = {
    audit_date: str(form, "audit_date"),
    auditor_id: user.id,
    auditor_name: user.full_name,
    company_id: companyId,
    company_name: companies.find((c) => c.id === companyId)?.name ?? null,
    branch_id: branchId,
    branch_name: branch?.name ?? null,
    status: "draft",
    note: optText(form, "note"),
  };

  const problem = validateAudit(input);
  if (problem) back(`${LIST_PATH}/new`, problem, true);

  let id: string;
  try {
    id = await createAudit(input, user.id);
    await logAudit({
      actor_id: user.id,
      action: "aud_create_audit",
      target_table: "aud_audits",
      target_id: id,
      after: input,
    });
  } catch (err) {
    back(`${LIST_PATH}/new`, err instanceof Error ? err.message : "เปิดใบคุมงานไม่สำเร็จ", true);
  }

  revalidatePath(LIST_PATH);
  back(`${LIST_PATH}/${id}`, "เปิดใบคุมงานเรียบร้อยแล้ว — เลือกรายการที่ต้องตรวจได้เลย");
}

/** แก้หัวใบคุมงาน (วันที่ทำงาน สาขา หมายเหตุ) */
export async function updateAuditForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const { user } = await requireOpenAudit(id, "edit");

  const companyId = str(form, "company_id") || null;
  const branchId = str(form, "branch_id") || null;
  const [companies, branch] = await Promise.all([
    companyId ? listCompanies(true) : Promise.resolve([]),
    branchId ? getBranchById(branchId) : Promise.resolve(null),
  ]);

  const patch = {
    audit_date: str(form, "audit_date"),
    company_id: companyId,
    company_name: companies.find((c) => c.id === companyId)?.name ?? null,
    branch_id: branchId,
    branch_name: branch?.name ?? null,
    note: optText(form, "note"),
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.audit_date)) {
    back(`${LIST_PATH}/${id}`, "รูปแบบวันที่ทำงานไม่ถูกต้อง", true);
  }

  try {
    await updateAudit(id, patch);
    await logAudit({
      actor_id: user.id,
      action: "aud_update_audit",
      target_table: "aud_audits",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(`${LIST_PATH}/${id}`, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath(`${LIST_PATH}/${id}`);
  back(`${LIST_PATH}/${id}`, "บันทึกหัวใบคุมงานเรียบร้อยแล้ว");
}

/** ส่งผล / เปิดกลับมาแก้ไข / ยกเลิกใบคุมงาน */
export async function setAuditStatusForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_ENTRY", "edit");
  const id = str(form, "id");
  const status = str(form, "status") as AudStatus;

  if (!["draft", "submitted", "cancelled"].includes(status)) {
    back(`${LIST_PATH}/${id}`, "สถานะไม่ถูกต้อง", true);
  }

  const audit = await getAudit(id);
  if (!audit) back(LIST_PATH, "ไม่พบใบคุมงานที่ต้องการ", true);

  if (status === "submitted") {
    if (audit.check_count === 0) {
      back(`${LIST_PATH}/${id}`, "ยังไม่มีรายการที่ตรวจในใบนี้ — เพิ่มรายการก่อนส่งผล", true);
    }
    if (audit.pending_count > 0) {
      back(
        `${LIST_PATH}/${id}`,
        `ยังมี ${audit.pending_count} รายการที่ยังไม่ได้ลงผลตรวจ — ลงผลให้ครบก่อนส่ง`,
        true,
      );
    }
  }

  try {
    await setAuditStatus(id, status);
    await logAudit({
      actor_id: user.id,
      action: "aud_set_status",
      target_table: "aud_audits",
      target_id: id,
      before: { status: audit.status },
      after: { status },
    });
  } catch (err) {
    back(`${LIST_PATH}/${id}`, err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ", true);
  }

  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath(LIST_PATH);
  const label = { draft: "เปิดกลับมาแก้ไข", submitted: "ส่งผลการตรวจ", cancelled: "ยกเลิกใบคุมงาน" }[status];
  back(`${LIST_PATH}/${id}`, `${label}เรียบร้อยแล้ว`);
}

export async function deleteAuditForm(form: FormData): Promise<void> {
  const user = await requirePermission("AUD_ENTRY", "delete");
  const id = str(form, "id");

  const audit = await getAudit(id);
  if (!audit) back(LIST_PATH, "ไม่พบใบคุมงานที่ต้องการลบ", true);

  if (form.get("confirm") !== "on") {
    back(
      `${LIST_PATH}/${id}`,
      `ต้องติ๊ก "ยืนยัน" ก่อน — ใบนี้จะถูกลบพร้อมผลตรวจ ${audit.check_count} รายการ`,
      true,
    );
  }

  try {
    await deleteAudit(id);
    await logAudit({
      actor_id: user.id,
      action: "aud_delete_audit",
      target_table: "aud_audits",
      target_id: id,
      before: { doc_no: audit.doc_no, checks: audit.check_count },
    });
  } catch (err) {
    back(`${LIST_PATH}/${id}`, err instanceof Error ? err.message : "ลบใบคุมงานไม่สำเร็จ", true);
  }

  revalidatePath(LIST_PATH);
  back(LIST_PATH, `ลบใบคุมงาน ${audit.doc_no} พร้อมผลตรวจ ${audit.check_count} รายการเรียบร้อยแล้ว`);
}

// ---------- ดึงรายการที่ต้องตรวจเข้าใบคุมงาน ----------

/**
 * ดึงใบสั่งขายจากระบบขาย (Db2) เข้าใบคุมงาน
 * ยิงถามระบบขายซ้ำอีกครั้งด้วยเงื่อนไขเดิม แล้วหยิบเฉพาะเลขที่สัญญาที่ผู้ใช้ติ๊กมา
 * (ไม่เชื่อข้อมูลที่ browser ส่งมา — ราคา/ชื่อลูกค้าต้องมาจากระบบขายเท่านั้น)
 */
export async function pullSalesForm(form: FormData): Promise<void> {
  const auditId = str(form, "audit_id");
  const { user } = await requireOpenAudit(auditId, "write");
  const path = `${LIST_PATH}/${auditId}`;

  const typeId = str(form, "type_id");
  const type = await getCheckType(typeId);
  if (!type) back(path, "ไม่พบรายการตรวจที่เลือก", true);

  const picked = new Set(form.getAll("ref").map((v) => String(v)));
  if (picked.size === 0) back(path, "ยังไม่ได้เลือกใบสั่งขาย — ติ๊กรายการที่ต้องการตรวจก่อน", true);

  const from = str(form, "from");
  const to = str(form, "to");
  const locat = str(form, "locat");

  let sources: AudCheckSource[];
  try {
    const result = await db2Sales({ from, to, locat: locat || undefined, limit: 2000 });
    sources = result.sales
      .filter((s) => picked.has(s.contno))
      .map((s) => ({
        type_id: type.id,
        type_code: type.code,
        type_name: type.name,
        kind: "sale" as const,
        ref_no: s.contno,
        ref_date: s.saleDate,
        title: s.customer || s.cuscod || null,
        party: s.salesman || s.salcod || null,
        branch_label: s.locat || null,
        amount: s.gross ?? s.price ?? null,
        extra: {
          brand: s.brand,
          model: s.modelName,
          finance: s.finance,
          channel: s.channelLabel,
          chassis: s.strno,
          customer_phone: s.mobile,
          salesman_code: s.salcod,
        },
        payment_id: null,
      }));
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ดึงข้อมูลจากระบบขายไม่สำเร็จ", true);
  }

  if (sources.length === 0) back(path, "ไม่พบใบสั่งขายที่เลือกในระบบขายแล้ว กรุณาดึงรายการใหม่", true);

  // redirect() ทำงานด้วยการโยน error — ต้องเรียกนอก try ไม่งั้น catch จะกลืนไปเป็น "NEXT_REDIRECT"
  let result: { added: number; skipped: string[] };
  try {
    result = await addChecks(auditId, sources, user.id);
  } catch (err) {
    back(path, err instanceof Error ? err.message : "เพิ่มรายการไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(
    path,
    `เพิ่มใบสั่งขายเข้าใบคุมงาน ${result.added} รายการ` +
      (result.skipped.length
        ? ` · ข้าม ${result.skipped.length} รายการ: ${result.skipped.join(", ")}`
        : ""),
  );
}

/** ดึงใบเบิกเงินสดย่อยจากระบบขอซ่อมขอซื้อเข้าใบคุมงาน */
export async function pullPaymentsForm(form: FormData): Promise<void> {
  const auditId = str(form, "audit_id");
  const { user } = await requireOpenAudit(auditId, "write");
  const path = `${LIST_PATH}/${auditId}`;

  const typeId = str(form, "type_id");
  const type = await getCheckType(typeId);
  if (!type) back(path, "ไม่พบรายการตรวจที่เลือก", true);

  const ids = form.getAll("payment_id").map((v) => String(v));
  if (ids.length === 0) back(path, "ยังไม่ได้เลือกใบเบิก — ติ๊กรายการที่ต้องการตรวจก่อน", true);

  const payments = (await Promise.all(ids.map((id) => getPayment(id)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  if (payments.length === 0) back(path, "ไม่พบใบเบิกที่เลือกแล้ว กรุณาดึงรายการใหม่", true);

  const sources: AudCheckSource[] = payments.map((p) => ({
    type_id: type.id,
    type_code: type.code,
    type_name: type.name,
    kind: "payment" as const,
    ref_no: p.doc_no,
    ref_date: p.pay_date,
    title: p.expense_detail,
    party: p.payee_name,
    branch_label: p.branch_name,
    amount: p.paid_amount,
    extra: {
      maker: p.created_by_name ?? p.created_by_full_name ?? "",
      expense_type: p.account_name ? `${p.account_code ?? ""} ${p.account_name}`.trim() : "",
      approval_no: p.ref_no ?? "",
      approver: p.approver_name ?? "",
    },
    payment_id: p.id,
  }));

  // redirect() ทำงานด้วยการโยน error — ต้องเรียกนอก try ไม่งั้น catch จะกลืนไปเป็น "NEXT_REDIRECT"
  let result: { added: number; skipped: string[] };
  try {
    result = await addChecks(auditId, sources, user.id);
  } catch (err) {
    back(path, err instanceof Error ? err.message : "เพิ่มรายการไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(
    path,
    `เพิ่มใบเบิกเข้าใบคุมงาน ${result.added} รายการ` +
      (result.skipped.length
        ? ` · ข้าม ${result.skipped.length} รายการ: ${result.skipped.join(", ")}`
        : ""),
  );
}

/** เพิ่มรายการที่ตรวจเอง (กระทบยอดเงินสด และรายการที่ผู้ใช้ตั้งขึ้นเอง) */
export async function addManualCheckForm(form: FormData): Promise<void> {
  const auditId = str(form, "audit_id");
  const { user, audit } = await requireOpenAudit(auditId, "write");
  const path = `${LIST_PATH}/${auditId}`;

  const type = await getCheckType(str(form, "type_id"));
  if (!type) back(path, "ไม่พบรายการตรวจที่เลือก", true);

  const title = optText(form, "title");
  if (!title) back(path, `กรุณากรอก${type.title_label}`, true);

  const source: AudCheckSource = {
    type_id: type.id,
    type_code: type.code,
    type_name: type.name,
    kind: type.kind,
    ref_no: optText(form, "ref_no"),
    ref_date: str(form, "ref_date") || audit.audit_date,
    title,
    party: optText(form, "party"),
    branch_label: optText(form, "branch_label") ?? audit.branch_name,
    amount: optNum(form, "amount"),
    extra: {},
    payment_id: null,
  };

  try {
    await addChecks(auditId, [source], user.id);
  } catch (err) {
    back(path, err instanceof Error ? err.message : "เพิ่มรายการไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(path, `เพิ่มรายการ “${title}” เรียบร้อยแล้ว`);
}

// ---------- บันทึกผลตรวจรายรายการ ----------

function readResultInput(form: FormData): AudCheckResultInput {
  const missing = form
    .getAll("missing")
    .map((v) => String(v))
    .map((raw) => {
      const [id, ...rest] = raw.split("|");
      return { doc_type_id: id || null, doc_name: rest.join("|").trim() };
    })
    .filter((m) => m.doc_name);

  // ช่อง "อื่น ๆ" พิมพ์ได้หลายรายการ คั่นด้วยจุลภาค
  for (const name of str(form, "missing_other").split(",")) {
    const clean = name.trim();
    if (clean) missing.push({ doc_type_id: null, doc_name: clean });
  }

  return {
    result: (str(form, "result") || "pending") as AudResult,
    result_note: optText(form, "result_note"),
    doc_result: (str(form, "doc_result") || "pending") as AudDocResult,
    doc_note: optText(form, "doc_note"),
    call_result: (str(form, "call_result") || "pending") as AudCallResult,
    info_result: (str(form, "info_result") || "pending") as AudInfoResult,
    call_note: optText(form, "call_note"),
    slip_result: (str(form, "slip_result") || "pending") as AudSlipResult,
    slip_amount_result: (str(form, "slip_amount_result") || "pending") as AudAmountResult,
    slip_amount: optNum(form, "slip_amount"),
    deposit_amount: optNum(form, "deposit_amount"),
    missing,
  };
}

export async function saveCheckForm(form: FormData): Promise<void> {
  const auditId = str(form, "audit_id");
  const { user } = await requireOpenAudit(auditId, "edit");
  const path = `${LIST_PATH}/${auditId}`;

  const id = str(form, "id");
  const check = await getCheck(id);
  if (!check || check.audit_id !== auditId) back(path, "ไม่พบรายการที่ต้องการบันทึก", true);

  // ช่องที่เปิดใช้อ่านจากรายการตรวจในฐานข้อมูลเสมอ ไม่เชื่อค่าที่ browser ส่งมา
  const type = check.type_id ? await getCheckType(check.type_id) : null;
  const flags = {
    has_docs: type?.has_docs ?? true,
    has_call: type?.has_call ?? true,
    has_slip: type?.has_slip ?? false,
  };

  const input = readResultInput(form);
  const problem = validateCheckResult(input, flags);
  if (problem) back(path, `${check.ref_no ?? check.title ?? "รายการที่ตรวจ"}: ${problem}`, true);

  try {
    await saveCheckResult(id, input, user.id);
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกผลการตรวจไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(path, `บันทึกผลการตรวจ ${check.ref_no ?? check.title ?? ""} เรียบร้อยแล้ว`);
}

export async function deleteCheckForm(form: FormData): Promise<void> {
  const auditId = str(form, "audit_id");
  const { user } = await requireOpenAudit(auditId, "delete");
  const path = `${LIST_PATH}/${auditId}`;

  const id = str(form, "id");
  const check = await getCheck(id);
  if (!check || check.audit_id !== auditId) back(path, "ไม่พบรายการที่ต้องการลบ", true);

  try {
    await deleteCheck(id);
    await logAudit({
      actor_id: user.id,
      action: "aud_delete_check",
      target_table: "aud_checks",
      target_id: id,
      before: { ref_no: check.ref_no, title: check.title, type: check.type_name },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบรายการไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(path, `เอารายการ ${check.ref_no ?? check.title ?? ""} ออกจากใบคุมงานแล้ว`);
}

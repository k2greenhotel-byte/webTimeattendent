"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectableContext } from "@/lib/core-db";
import { logAudit } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { parseAmount, parseTags, validatePayment } from "@/lib/procurement";
import {
  createPayment,
  deletePayment,
  getDocsByIds,
  getPayment,
  listPaymentItems,
  setPaymentTags,
  updatePayment,
} from "@/lib/procurement-db";
import {
  MAX_PAYMENT_DOCS,
  MAX_PHOTOS,
  MAX_TAGS_PER_PAYMENT,
  PAY_SOURCES,
  type PaySourceSpec,
  type PaymentFile,
  type PaymentInput,
  type PaymentItem,
} from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/**
 * บริษัท/สาขาที่ทำจ่ายต้องอยู่ในขอบเขตของผู้ใช้คนนี้
 * (ตั้งค่าได้ที่เมนูกำหนดสิทธิ์: ทุกบริษัท-ทุกสาขา หรือเจาะจงเป็นรายบริษัท/รายสาขา)
 * ตรวจฝั่ง server ด้วย เพราะ dropdown ฝั่งหน้าเว็บถูกแก้ค่าได้
 */
async function checkScope(
  userId: string,
  companyId: string | null,
  branchId: string | null,
): Promise<string | null> {
  const { companies, branches } = await getSelectableContext(userId);

  if (companyId && !companies.some((c) => c.id === companyId)) {
    return "บัญชีนี้ไม่มีสิทธิ์ทำจ่ายให้บริษัทที่เลือก กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (branchId && !branches.some((b) => b.id === branchId)) {
    return "บัญชีนี้ไม่มีสิทธิ์ทำจ่ายให้สาขาที่เลือก กรุณาติดต่อผู้ดูแลระบบ";
  }
  return null;
}

/**
 * รายการเอกสารที่ผู้ใช้ติ๊กเลือก — ฟอร์มส่งมาเป็น pick="repair:<id>" คู่กับ amount_<id>
 * (ยอดของแต่ละใบอยู่คนละช่อง เพื่อให้แก้ยอดรายใบได้โดยไม่ต้องแก้ทั้งก้อน)
 */
function readItems(form: FormData): PaymentItem[] {
  const items: PaymentItem[] = [];

  for (const raw of form.getAll("pick")) {
    const [kind, id] = String(raw).split(":");
    if (!id || (kind !== "repair" && kind !== "purchase")) continue;

    items.push({
      repair_id: kind === "repair" ? id : null,
      purchase_id: kind === "purchase" ? id : null,
      amount: parseAmount(str(form, `amount_${id}`)),
    });
  }
  return items;
}

/** รูปภาพประกอบ (ข้อ 4.5) */
function readPhotoFiles(form: FormData): PaymentFile[] {
  return form
    .getAll("photo")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, MAX_PHOTOS)
    .map((path) => ({
      kind: "photo" as const,
      path,
      filename: path.split("/").pop() ?? "รูปภาพ",
      mime: null,
      size_bytes: null,
    }));
}

/** ไฟล์เอกสารแนบ ใบเสร็จ/ใบรับสินค้า (ข้อ 4.6) — FileUploader ส่งมาเป็น JSON บรรทัดละไฟล์ */
function readDocumentFiles(form: FormData): PaymentFile[] {
  const files: PaymentFile[] = [];

  for (const raw of form.getAll("file_document")) {
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
        kind: "document",
        path: parsed.path,
        filename: parsed.filename ?? parsed.path.split("/").pop() ?? "ไฟล์แนบ",
        mime: parsed.mime ?? null,
        size_bytes: parsed.size ?? null,
      });
    } catch {
      // บรรทัดที่อ่านไม่ออกให้ข้ามไป ไม่ควรทำให้บันทึกทั้งใบล้มเหลว
    }
  }
  return files.slice(0, MAX_PAYMENT_DOCS);
}

function readFiles(form: FormData): PaymentFile[] {
  return [...readPhotoFiles(form), ...readDocumentFiles(form)];
}

/**
 * แหล่งจ่ายที่ฟอร์มส่งมา — ตัดสินว่าใช้ชุดเลขที่ เมนู และชื่อเอกสารของแบบไหน
 * ค่าที่ไม่รู้จักถือเป็นเงินสดย่อย (ค่าเริ่มต้นของระบบ)
 */
function readSource(form: FormData): PaySourceSpec {
  const value = str(form, "pay_source");
  return PAY_SOURCES[value === "central" ? "central" : "petty"];
}

/** ช่องของใบเบิกที่ไม่เกี่ยวกับเอกสารที่อ้างถึง */
function readPaymentFields(form: FormData) {
  return {
    pay_date: str(form, "pay_date"),
    paid_amount: parseAmount(str(form, "paid_amount")),
    ref_no: str(form, "ref_no") || null,
    payee_name: str(form, "payee_name") || null,
    payee_address: str(form, "payee_address") || null,
    payee_phone: normalizePhone(str(form, "payee_phone")) || str(form, "payee_phone") || null,
    expense_detail: str(form, "expense_detail") || null,
    vendor_id: str(form, "vendor_id") || null,
    account_id: str(form, "account_id") || null,
    payer_name: str(form, "payer_name") || null,
    approver_name: str(form, "approver_name") || null,
    payee_signature: str(form, "payee_signature") || null,
    payer_signature: str(form, "payer_signature") || null,
    note: str(form, "note") || null,
    company_id: str(form, "company_id") || null,
    branch_id: str(form, "branch_id") || null,
  };
}

/** ตรวจรายการที่เลือกกับสถานะจริงของเอกสารต้นทาง ณ ตอนบันทึก */
async function checkItems(
  input: {
    pay_date: string;
    paid_amount: number;
    payee_name?: string | null;
    company_id?: string | null;
    branch_id?: string | null;
  },
  items: PaymentItem[],
  /** ตอนแก้ไข ยอดที่ใบนี้เคยเบิกไว้ไม่ควรถูกนับซ้ำเป็นยอดที่เบิกไปแล้ว */
  alreadyOnThisPayment: Map<string, number> = new Map(),
): Promise<string | null> {
  const ids = items.map((i) => i.repair_id ?? i.purchase_id ?? "").filter(Boolean);
  const docs = await getDocsByIds(ids);

  for (const [id, doc] of docs) {
    const previous = alreadyOnThisPayment.get(id) ?? 0;
    docs.set(id, { ...doc, actual_amount: Math.max(0, doc.actual_amount - previous) });
  }

  return validatePayment(input, items, docs);
}

export async function createPaymentForm(form: FormData): Promise<void> {
  const spec = readSource(form);
  const user = await requirePermission(spec.menuCode, "write");
  const path = `${spec.basePath}/new`;

  const items = readItems(form);
  const input = { ...readPaymentFields(form), pay_source: spec.source };

  const scopeProblem = await checkScope(user.id, input.company_id, input.branch_id);
  if (scopeProblem) back(path, scopeProblem, true);

  const problem = await checkItems(input, items);
  if (problem) back(path, problem, true);

  const row: PaymentInput = {
    ...input,
    created_by: user.id,
    created_by_name: str(form, "created_by_name") || user.full_name,
  };

  let id = "";
  let docNo = "";
  try {
    const created = await createPayment(row, items, readFiles(form));
    id = created.id;
    docNo = created.doc_no;
    await setPaymentTags(id, parseTags(str(form, "tags"), MAX_TAGS_PER_PAYMENT));
    await logAudit({
      actor_id: user.id,
      action: "create_payment",
      target_table: "pr_payments",
      target_id: id,
      after: { doc_no: docNo, paid_amount: row.paid_amount, items: items.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : `บันทึก${spec.docLabel}ไม่สำเร็จ`, true);
  }

  revalidatePath(spec.basePath);
  back(`${spec.basePath}/${id}`, `บันทึก${spec.docLabel}เลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updatePaymentForm(form: FormData): Promise<void> {
  const spec = readSource(form);
  const user = await requirePermission(spec.menuCode, "edit");
  const id = str(form, "id");
  if (!id) back(spec.basePath, `ไม่พบ${spec.docLabel}ที่ต้องการแก้ไข`, true);

  const path = `${spec.basePath}/${id}`;
  const current = await getPayment(id);
  if (!current) back(spec.basePath, `ไม่พบ${spec.docLabel}นี้ อาจถูกลบไปแล้ว`, true);

  // ยอดที่ใบนี้เคยเบิกไว้ ต้องหักออกก่อนตรวจ ไม่งั้นจะถูกนับซ้ำว่าเบิกเกิน
  const before = await listPaymentItems(id);
  const previous = new Map<string, number>();
  for (const item of before) {
    const key = item.repair_id ?? item.purchase_id;
    if (key) previous.set(key, (previous.get(key) ?? 0) + item.amount);
  }

  const items = readItems(form);
  const input = readPaymentFields(form);

  const scopeProblem = await checkScope(user.id, input.company_id, input.branch_id);
  if (scopeProblem) back(path, scopeProblem, true);

  const problem = await checkItems(input, items, previous);
  if (problem) back(path, problem, true);

  try {
    await updatePayment(
      id,
      { ...input, created_by_name: str(form, "created_by_name") || null },
      items,
      readFiles(form),
    );
    await setPaymentTags(id, parseTags(str(form, "tags"), MAX_TAGS_PER_PAYMENT));
    await logAudit({
      actor_id: user.id,
      action: "update_payment",
      target_table: "pr_payments",
      target_id: id,
      after: { doc_no: current.doc_no, paid_amount: input.paid_amount, items: items.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : `บันทึก${spec.docLabel}ไม่สำเร็จ`, true);
  }

  revalidatePath(path);
  revalidatePath(spec.basePath);
  back(path, `บันทึก${spec.docLabel}เรียบร้อยแล้ว`);
}

export async function deletePaymentForm(form: FormData): Promise<void> {
  const spec = readSource(form);
  const user = await requirePermission(spec.menuCode, "delete");
  const id = str(form, "id");
  const path = `${spec.basePath}/${id}`;

  if (!id) back(spec.basePath, `ไม่พบ${spec.docLabel}ที่ต้องการลบ`, true);
  if (form.get("confirm") !== "on") {
    back(
      path,
      'ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วรูปและไฟล์แนบทั้งหมดจะหายตามไปด้วย และยอดเบิกจริงของเอกสารที่อ้างถึงจะถูกคำนวณใหม่',
      true,
    );
  }

  let filesDeleted = 0;
  try {
    ({ filesDeleted } = await deletePayment(id));
    await logAudit({
      actor_id: user.id,
      action: "delete_payment",
      target_table: "pr_payments",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : `ลบ${spec.docLabel}ไม่สำเร็จ`, true);
  }

  revalidatePath(spec.basePath);
  back(spec.basePath, `ลบ${spec.docLabel}และไฟล์แนบ ${filesDeleted} ไฟล์เรียบร้อยแล้ว`);
}

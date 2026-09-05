"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { parseAmount, sumItems, validatePayment } from "@/lib/procurement";
import {
  createPayment,
  deletePayment,
  getDocsByIds,
  getPayment,
  listPaymentItems,
  updatePayment,
} from "@/lib/procurement-db";
import {
  MAX_PAYMENT_DOCS,
  MAX_PHOTOS,
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

/** ตรวจรายการที่เลือกกับสถานะจริงของเอกสารต้นทาง ณ ตอนบันทึก */
async function checkItems(
  input: { pay_date: string; paid_amount: number },
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
  const user = await requirePermission("PR_PAYMENT", "write");
  const path = "/procurement/payments/new";

  const items = readItems(form);
  const input = { pay_date: str(form, "pay_date"), paid_amount: sumItems(items) };

  const problem = await checkItems(input, items);
  if (problem) back(path, problem, true);

  const row: PaymentInput = {
    ...input,
    note: str(form, "note") || null,
    company_id: user.company_id ?? null,
    branch_id: user.branch_id ?? null,
    created_by: user.id,
    created_by_name: str(form, "created_by_name") || user.full_name,
  };

  let id = "";
  let docNo = "";
  try {
    const created = await createPayment(row, items, readFiles(form));
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_payment",
      target_table: "pr_payments",
      target_id: id,
      after: { doc_no: docNo, paid_amount: row.paid_amount, items: items.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบเบิกจ่ายไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/payments");
  back(`/procurement/payments/${id}`, `บันทึกใบเบิกจ่ายเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updatePaymentForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_PAYMENT", "edit");
  const id = str(form, "id");
  if (!id) back("/procurement/payments", "ไม่พบใบเบิกจ่ายที่ต้องการแก้ไข", true);

  const path = `/procurement/payments/${id}`;
  const current = await getPayment(id);
  if (!current) back("/procurement/payments", "ไม่พบใบเบิกจ่ายนี้ อาจถูกลบไปแล้ว", true);

  // ยอดที่ใบนี้เคยเบิกไว้ ต้องหักออกก่อนตรวจ ไม่งั้นจะถูกนับซ้ำว่าเบิกเกิน
  const before = await listPaymentItems(id);
  const previous = new Map<string, number>();
  for (const item of before) {
    const key = item.repair_id ?? item.purchase_id;
    if (key) previous.set(key, (previous.get(key) ?? 0) + item.amount);
  }

  const items = readItems(form);
  const input = { pay_date: str(form, "pay_date"), paid_amount: sumItems(items) };

  const problem = await checkItems(input, items, previous);
  if (problem) back(path, problem, true);

  try {
    await updatePayment(
      id,
      { ...input, note: str(form, "note") || null, created_by_name: str(form, "created_by_name") || null },
      items,
      readFiles(form),
    );
    await logAudit({
      actor_id: user.id,
      action: "update_payment",
      target_table: "pr_payments",
      target_id: id,
      after: { doc_no: current.doc_no, paid_amount: input.paid_amount, items: items.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบเบิกจ่ายไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/procurement/payments");
  back(path, "บันทึกใบเบิกจ่ายเรียบร้อยแล้ว");
}

export async function deletePaymentForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_PAYMENT", "delete");
  const id = str(form, "id");
  const path = `/procurement/payments/${id}`;

  if (!id) back("/procurement/payments", "ไม่พบใบเบิกจ่ายที่ต้องการลบ", true);
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
    back(path, err instanceof Error ? err.message : "ลบใบเบิกจ่ายไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/payments");
  back("/procurement/payments", `ลบใบเบิกจ่ายและไฟล์แนบ ${filesDeleted} ไฟล์เรียบร้อยแล้ว`);
}

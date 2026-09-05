import Link from "next/link";
import { notFound } from "next/navigation";
import PaymentForm, { type PickedItem } from "@/components/procurement/PaymentForm";
import { remainingToPay } from "@/lib/procurement";
import {
  getDocsByIds,
  getPayment,
  listDocs,
  listPaymentFiles,
  listPaymentItems,
} from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deletePaymentForm, updatePaymentForm } from "../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 4 — แก้ไขใบเบิกจ่าย พร้อมสั่งพิมพ์ (4.7) และลบ */
export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("PR_PAYMENT", "read");
  const { id } = await params;
  const query = await searchParams;

  const payment = await getPayment(id);
  if (!payment) notFound();

  const [items, files, approved, canEdit, canDelete] = await Promise.all([
    listPaymentItems(id),
    listPaymentFiles(id),
    listDocs({ approve_status: "approved" }),
    checkPermission("PR_PAYMENT", "edit"),
    checkPermission("PR_PAYMENT", "delete"),
  ]);

  // เอกสารที่ใบนี้เคยเลือกไว้แล้ว ต้องบวกยอดของใบนี้กลับเข้าไปในยอดที่ยังเบิกได้
  // ไม่งั้นตัวเลข "เบิกได้อีก" จะเพี้ยน (นับยอดของตัวเองเป็นยอดที่เบิกไปแล้วซ้ำ)
  const pickedIds = items.map((i) => i.repair_id ?? i.purchase_id ?? "").filter(Boolean);
  const pickedDocsRaw = await getDocsByIds(pickedIds);

  const pickedAmountOf = new Map<string, number>();
  for (const item of items) {
    const key = item.repair_id ?? item.purchase_id;
    if (key) pickedAmountOf.set(key, (pickedAmountOf.get(key) ?? 0) + item.amount);
  }

  const docsById = new Map(approved.map((d) => [d.id, d]));
  for (const [docId, doc] of pickedDocsRaw) {
    if (!docsById.has(docId)) {
      docsById.set(docId, { ...doc, actual_amount: Math.max(0, doc.actual_amount - (pickedAmountOf.get(docId) ?? 0)) });
    }
  }

  const docs = [...docsById.values()].filter((d) => remainingToPay(d) > 0 || pickedAmountOf.has(d.id));
  const picked: PickedItem[] = items
    .map((i) => ({ docId: i.repair_id ?? i.purchase_id ?? "", amount: i.amount }))
    .filter((p) => p.docId);

  const photos = files.filter((f) => f.kind === "photo").map((f) => f.path);
  const documents = files
    .filter((f) => f.kind === "document")
    .map((f) => ({ path: f.path, filename: f.filename, mime: f.mime, size: f.size_bytes }));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">
            ใบเบิกจ่ายเลขที่ {payment.doc_no}
          </h1>
          <p className="text-sm text-slate-500">
            ผู้บันทึก {payment.created_by_name ?? payment.created_by_full_name ?? "—"}
          </p>
        </div>
        <Link href={`/procurement/payments/${payment.id}/print`} className="btn-secondary">
          พิมพ์เอกสาร
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <PaymentForm
          payment={payment}
          docs={docs}
          picked={picked}
          photos={photos}
          documents={documents}
          defaultRecorderName={user.full_name}
          action={updatePaymentForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <p className="card text-sm text-slate-600">บัญชีนี้ไม่มีสิทธิ์แก้ไขใบเบิกจ่าย (ดูอย่างเดียว)</p>
      )}

      {canDelete && (
        <section className="card space-y-2 border-rose-200">
          <h2 className="font-semibold text-rose-700">ลบใบเบิกจ่ายนี้</h2>
          <p className="text-sm text-slate-600">
            ลบแล้วรูปและไฟล์แนบทั้งหมดจะหายตามไปด้วย และยอดเบิกจริงของเอกสารที่อ้างถึงจะถูกคำนวณใหม่ ย้อนกลับไม่ได้
          </p>
          <form action={deletePaymentForm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={payment.id} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm" />
              ยืนยันลบใบเบิกจ่าย {payment.doc_no}
            </label>
            <button type="submit" className="btn-danger">
              ลบใบเบิกจ่าย
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

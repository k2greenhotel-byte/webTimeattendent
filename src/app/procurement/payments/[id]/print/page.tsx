import { notFound } from "next/navigation";
import PrintButton from "@/components/procurement/PrintButton";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { getDocsByIds, getPayment, listPaymentFiles, listPaymentItems } from "@/lib/procurement-db";
import { DOC_KIND_LABEL, PAYMENT_FILE_KIND_LABEL } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 4.7 — เอกสารประกอบการจ่ายเงิน สั่งพิมพ์ได้ (Ctrl+P ของเบราว์เซอร์)
 * ดึงข้อมูลจากใบขอซ่อม/ใบขอซื้อที่ใบเบิกจ่ายนี้อ้างถึงมาประกอบเอกสารให้อัตโนมัติ
 */
export default async function PaymentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("PR_PAYMENT", "read");
  const { id } = await params;

  const payment = await getPayment(id);
  if (!payment) notFound();

  const [items, files] = await Promise.all([listPaymentItems(id), listPaymentFiles(id)]);
  const ids = items.map((i) => i.repair_id ?? i.purchase_id ?? "").filter(Boolean);
  const docs = await getDocsByIds(ids);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 print:max-w-full print:p-0">
      {/* เอกสารประกอบการจ่ายเงินพิมพ์แนวตั้ง ต่างจากค่าเริ่มต้นของระบบ (A4 แนวนอน) */}
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <header className="space-y-1 text-center">
        <h1 className="text-lg font-bold text-slate-800">เอกสารประกอบการจ่ายเงิน</h1>
        <p className="text-sm text-slate-500">เลขที่ {payment.doc_no}</p>
      </header>

      <section className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-slate-500">วันที่ขอเบิกเงิน:</span> {formatThaiDate(payment.pay_date)}
        </div>
        <div>
          <span className="text-slate-500">ยอดเงินที่จ่ายจริง:</span>{" "}
          <span className="font-semibold">{formatBaht(payment.paid_amount)}</span>
        </div>
        <div>
          <span className="text-slate-500">บริษัท / สาขา:</span> {payment.company_name ?? "—"}{" "}
          {payment.branch_name ? `· ${payment.branch_name}` : ""}
        </div>
        <div>
          <span className="text-slate-500">ผู้บันทึก:</span>{" "}
          {payment.created_by_name ?? payment.created_by_full_name ?? "—"}
        </div>
      </section>

      {payment.note && (
        <p className="rounded-lg bg-slate-50 p-2 text-sm">
          <span className="text-slate-500">หมายเหตุ:</span> {payment.note}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">รายการที่เบิกจ่าย ({items.length} รายการ)</h2>
        <table className="table-report w-full">
          <thead>
            <tr>
              <th>ชนิด</th>
              <th>เลขที่เอกสาร</th>
              <th className="text-left">รายการ</th>
              <th>วันที่</th>
              <th>ยอดที่เบิก</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const docId = item.repair_id ?? item.purchase_id ?? "";
              const doc = docs.get(docId);
              return (
                <tr key={i}>
                  <td>{doc ? DOC_KIND_LABEL[doc.kind] : "—"}</td>
                  <td>{doc?.doc_no ?? "ไม่พบเอกสาร"}</td>
                  <td className="text-left">{doc?.item_name ?? "—"}</td>
                  <td className="text-xs">{doc ? formatThaiDate(doc.doc_date) : "—"}</td>
                  <td>{formatBaht(item.amount)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={4} className="text-right font-semibold">
                รวม
              </td>
              <td className="font-semibold">{formatBaht(payment.paid_amount)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {files.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-800">เอกสารแนบ ({files.length} ไฟล์)</h2>
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.path}>
                {PAYMENT_FILE_KIND_LABEL[f.kind]}: {f.filename}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-2 print:grid-cols-4">
            {files
              .filter((f) => f.kind === "photo")
              .map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f.path}
                  src={`/api/procurement/photo?path=${encodeURIComponent(f.path)}`}
                  alt={f.filename}
                  className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                />
              ))}
          </div>
        </section>
      )}

      <footer className="grid grid-cols-2 gap-8 pt-12 text-center text-sm">
        <div>
          <div className="mb-8 border-b border-slate-400" />
          ผู้จัดทำ
        </div>
        <div>
          <div className="mb-8 border-b border-slate-400" />
          ผู้อนุมัติจ่ายเงิน
        </div>
      </footer>
    </main>
  );
}

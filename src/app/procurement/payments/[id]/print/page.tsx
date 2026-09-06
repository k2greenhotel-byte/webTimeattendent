import { notFound } from "next/navigation";
import PrintButton from "@/components/procurement/PrintButton";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { getDocsByIds, getPayment, listPaymentFiles, listPaymentItems } from "@/lib/procurement-db";
import { formatPhone } from "@/lib/phone";
import { DOC_KIND_LABEL, PAYMENT_FILE_KIND_LABEL } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="break-words text-sm text-slate-800">{value || "—"}</div>
    </div>
  );
}

/** ช่องลงนาม — มีลายเซ็นดิจิทัลก็วางรูปลงไป ไม่มีก็เว้นเส้นให้เซ็นด้วยปากกา */
function Signature({
  path,
  name,
  role,
}: {
  path: string | null;
  name: string | null;
  role: string;
}) {
  return (
    <div>
      <div className="flex h-16 items-end justify-center border-b border-slate-400">
        {path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/procurement/photo?path=${encodeURIComponent(path)}`}
            alt={`ลายเซ็น${role}`}
            className="max-h-16 object-contain"
          />
        )}
      </div>
      <div className="mt-1 text-slate-700">{name || "\u00a0"}</div>
      <div className="text-xs text-slate-500">{role}</div>
    </div>
  );
}

/**
 * หน้าจอ 4.7 — ใบเบิกเงินสดย่อย สั่งพิมพ์ได้ (Ctrl+P ของเบราว์เซอร์)
 * ดึงเลขที่และวันที่อนุมัติจากใบขอซ่อม/ใบขอซื้อที่อ้างถึงมาประกอบให้อัตโนมัติ
 * และวางลายเซ็นดิจิทัลของผู้อนุมัติกับผู้รับเงินลงในช่องลงนาม
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

      <header className="space-y-1 border-b border-slate-300 pb-3 text-center">
        <h1 className="text-lg font-bold text-slate-800">ใบเบิกเงินสดย่อย</h1>
        <p className="text-sm text-slate-600">
          {payment.company_name ?? "—"}
          {payment.branch_name ? ` · สาขา ${payment.branch_name}` : ""}
        </p>
        <p className="text-sm text-slate-500">
          เลขที่ {payment.doc_no} · วันที่ทำจ่าย {formatThaiDate(payment.pay_date)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Field label="เลขที่อ้างอิง (เลขที่อนุมัติ)" value={payment.ref_no} />
        <Field
          label="ประเภทค่าใช้จ่าย"
          value={payment.account_code ? `${payment.account_code} · ${payment.account_name}` : null}
        />
        <Field
          label="จำนวนเงิน"
          value={<span className="font-semibold">{formatBaht(payment.paid_amount)}</span>}
        />
        <Field label="ชื่อผู้ขาย / ผู้รับเงิน" value={payment.payee_name} />
        <Field label="เบอร์โทร" value={formatPhone(payment.payee_phone)} />
        <Field label="ผู้บันทึก" value={payment.created_by_name ?? payment.created_by_full_name} />
        <div className="col-span-2 sm:col-span-3">
          <Field label="ที่อยู่ผู้รับเงิน" value={payment.payee_address} />
        </div>
      </section>

      {payment.note && (
        <p className="rounded-lg bg-slate-50 p-2 text-sm">
          <span className="text-slate-500">หมายเหตุ:</span> {payment.note}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">
          ใบขอซ่อม / ใบขอจัดซื้อที่อ้างถึง ({items.length} รายการ)
        </h2>
        {items.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
            รายการทั่วไป — ไม่ได้อ้างใบขอซ่อมหรือใบขอจัดซื้อ
          </p>
        ) : (
        <table className="table-report w-full">
          <thead>
            <tr>
              <th>ชนิด</th>
              <th>เลขที่เอกสาร</th>
              <th className="text-left">รายการ</th>
              <th>เลขที่อนุมัติ</th>
              <th>วันที่อนุมัติ</th>
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
                  <td className="text-xs">{doc?.approval_no ?? "—"}</td>
                  <td className="text-xs">
                    {doc?.approved_date ? formatThaiDate(doc.approved_date) : "—"}
                  </td>
                  <td>{formatBaht(item.amount)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="text-right font-semibold">
                รวม
              </td>
              <td className="font-semibold">{formatBaht(payment.paid_amount)}</td>
            </tr>
          </tbody>
        </table>
        )}
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

      <footer className="grid grid-cols-1 gap-6 pt-10 text-center text-sm sm:grid-cols-3">
        <Signature
          path={null}
          name={payment.created_by_name ?? payment.created_by_full_name}
          role="ผู้จัดทำ"
        />
        <Signature path={payment.approver_signature} name={payment.approver_name} role="ผู้อนุมัติจ่ายเงิน" />
        <Signature path={payment.payee_signature} name={payment.payee_name} role="ผู้รับเงิน" />
      </footer>
    </main>
  );
}

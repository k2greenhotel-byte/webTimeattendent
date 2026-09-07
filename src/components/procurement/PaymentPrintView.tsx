import { notFound } from "next/navigation";
import PrintButton from "@/components/procurement/PrintButton";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { getDocsByIds, getPayment, listPaymentFiles, listPaymentItems } from "@/lib/procurement-db";
import { DOC_KIND_LABEL, URGENCY_LABEL } from "@/lib/procurement-types";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";
import { PAY_SOURCES, type PaySource } from "@/lib/procurement-types";

export const dynamic = "force-dynamic";

const PHOTO = "/api/procurement/photo";

/** จำนวนเงินเป็นตัวหนังสือไทย — เอกสารการเงินต้องมีกำกับไว้กันแก้ตัวเลข */
function bahtText(amount: number): string {
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const readInt = (nRaw: number): string => {
    const n = Math.floor(nRaw);
    if (n === 0) return "ศูนย์";
    if (n >= 1_000_000) {
      const high = Math.floor(n / 1_000_000);
      const rest = n % 1_000_000;
      return `${readInt(high)}ล้าน${rest > 0 ? readInt(rest) : ""}`;
    }

    const text = String(n);
    let out = "";
    for (let i = 0; i < text.length; i += 1) {
      const digit = Number(text[i]);
      const place = text.length - i - 1;
      if (digit === 0) continue;

      if (place === 0 && digit === 1 && text.length > 1) out += "เอ็ด";
      else if (place === 1 && digit === 1) out += "";
      else if (place === 1 && digit === 2) out += "ยี่";
      else out += digits[digit];

      out += units[place];
    }
    return out;
  };

  const whole = Math.floor(amount);
  const satang = Math.round((amount - whole) * 100);
  return satang === 0
    ? `${readInt(whole)}บาทถ้วน`
    : `${readInt(whole)}บาท${readInt(satang)}สตางค์`;
}

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
  path?: string | null;
  name: string | null;
  role: string;
}) {
  return (
    <div className="text-center">
      <div className="flex h-16 items-end justify-center border-b border-slate-400">
        {path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${PHOTO}?path=${encodeURIComponent(path)}`}
            alt={`ลายเซ็น${role}`}
            className="max-h-16 object-contain"
          />
        )}
      </div>
      <div className="mt-1 text-sm text-slate-700">{name || " "}</div>
      <div className="text-xs text-slate-500">{role}</div>
      <div className="mt-1 text-[11px] text-slate-400">วันที่ ......../......../........</div>
    </div>
  );
}

/**
 * แบบฟอร์มใบเบิกเงินสดย่อย สั่งพิมพ์ได้ (A4 แนวตั้ง)
 *
 * มีสองแบบในหน้าเดียว ตัดสินจากว่าใบนี้อ้างใบขอซ่อม/ใบขอซื้อไว้หรือไม่:
 *   แบบที่ 1 — รายการทั่วไป: ไม่มีส่วนอนุมัติ ใช้กับค่าใช้จ่ายย่อยที่ไม่ต้องขออนุมัติ
 *   แบบที่ 2 — มีรายการอนุมัติ: เพิ่มแถบเลขที่/วันที่/ชื่อผู้อนุมัติ และตารางเอกสารที่อ้างถึง
 */
export default async function PaymentPrintView({
  source,
  id,
  auto = false,
}: {
  source: PaySource;
  id: string;
  /** เปิดหน้าต่างพิมพ์ให้ทันทีที่เข้าหน้า */
  auto?: boolean;
}) {
  const spec = PAY_SOURCES[source];
  await requirePermission(spec.menuCode, "read");

  const payment = await getPayment(id);
  if (!payment) notFound();

  const [items, files] = await Promise.all([listPaymentItems(id), listPaymentFiles(id)]);
  const docIds = items.map((i) => i.repair_id ?? i.purchase_id ?? "").filter(Boolean);
  const docs = await getDocsByIds(docIds);

  const withApproval = items.length > 0;
  const photos = files.filter((f) => f.kind === "photo");
  const documents = files.filter((f) => f.kind === "document");

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4 print:max-w-full print:p-0">
      {/* เอกสารการเงินพิมพ์แนวตั้ง ต่างจากค่าเริ่มต้นของระบบที่เป็น A4 แนวนอน */}
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <PrintButton auto={auto} label={`🖨 พิมพ์${spec.docLabel}`} />

      {/* ---------- หัวเอกสาร ---------- */}
      <header className="border-b-2 border-slate-800 pb-3 text-center">
        <h1 className="text-lg font-bold text-slate-900">{spec.docLabel}</h1>
        <p className="text-sm text-slate-700">
          {payment.company_name ?? "—"}
          {payment.branch_name ? ` · สาขา ${payment.branch_name}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 text-sm text-slate-600">
          <span>
            เลขที่ <span className="font-semibold text-slate-900">{payment.doc_no}</span>
          </span>
          <span>วันที่ทำจ่าย {formatThaiDate(payment.pay_date)}</span>
          <span className="text-slate-400">
            {withApproval ? "(ประกอบการอนุมัติ)" : "(รายการทั่วไป)"}
          </span>
        </div>
      </header>

      {/* ---------- แบบที่ 2: แถบข้อมูลการอนุมัติ ---------- */}
      {withApproval && (
        <section className="rounded-lg border border-slate-400 bg-slate-50 p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">ข้อมูลการอนุมัติ</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="เลขที่อนุมัติ" value={payment.ref_no} />
            <Field
              label="วันที่อนุมัติ"
              value={[...docs.values()]
                .map((d) => (d.approved_date ? formatThaiDate(d.approved_date) : null))
                .filter(Boolean)
                .join(", ")}
            />
            <Field
              label="ชื่อผู้อนุมัติ"
              value={
                payment.approver_name ??
                [...new Set([...docs.values()].map((d) => d.approved_by).filter(Boolean))].join(", ")
              }
            />
            <Field label="จำนวนเอกสารที่อ้างถึง" value={`${items.length} ใบ`} />
          </div>
        </section>
      )}

      {/* ---------- รายละเอียดการจ่าย ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <Field label="รายการค่าใช้จ่าย" value={payment.expense_detail} />
        </div>
        <Field
          label="ประเภทค่าใช้จ่าย (ผังบัญชี)"
          value={payment.account_code ? `${payment.account_code} · ${payment.account_name}` : null}
        />
        {!withApproval && <Field label="เลขที่อ้างอิง" value={payment.ref_no} />}
        <Field label="ชื่อผู้ขาย / ผู้รับเงิน" value={payment.payee_name} />
        <Field label="เบอร์โทร" value={formatPhone(payment.payee_phone)} />
        <div className="col-span-2 sm:col-span-3">
          <Field label="ที่อยู่ผู้รับเงิน" value={payment.payee_address} />
        </div>
      </section>

      {/* ---------- จำนวนเงิน ---------- */}
      <section className="rounded-lg border-2 border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm text-slate-600">จำนวนเงินที่จ่ายจริง</span>
          <span className="text-lg font-bold text-slate-900">{formatBaht(payment.paid_amount)}</span>
        </div>
        <div className="border-t border-slate-300 px-3 py-1.5 text-center text-sm text-slate-700">
          ({bahtText(payment.paid_amount)})
        </div>
      </section>

      {/* ---------- แบบที่ 2: ตารางเอกสารขอซื้อ/ขอซ่อมที่อ้างถึง ---------- */}
      {withApproval && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">
            เอกสารขอซ่อม / ขอจัดซื้อ ที่ประกอบการเบิกจ่าย
          </h2>
          <div className="overflow-x-auto">
            <table className="table-report w-full">
              <thead>
                <tr>
                  <th>ชนิด</th>
                  <th>เลขที่เอกสาร</th>
                  <th className="text-left">รายการ</th>
                  <th>เลขที่อนุมัติ</th>
                  <th>วันที่อนุมัติ</th>
                  <th>ผู้อนุมัติ</th>
                  <th>ยอดที่เบิก</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const doc = docs.get(item.repair_id ?? item.purchase_id ?? "");
                  return (
                    <tr key={i}>
                      <td className="text-xs">{doc ? DOC_KIND_LABEL[doc.kind] : "—"}</td>
                      <td className="text-xs font-medium">{doc?.doc_no ?? "ไม่พบเอกสาร"}</td>
                      <td className="whitespace-normal text-left text-xs">
                        {doc?.item_name ?? "—"}
                        {doc?.type_name && (
                          <div className="text-[11px] text-slate-400">
                            {doc.type_name} · {doc ? URGENCY_LABEL[doc.urgency] : ""}
                          </div>
                        )}
                      </td>
                      <td className="text-xs">{doc?.approval_no ?? "—"}</td>
                      <td className="text-xs">
                        {doc?.approved_date ? formatThaiDate(doc.approved_date) : "—"}
                      </td>
                      <td className="text-xs">{doc?.approved_by ?? "—"}</td>
                      <td className="text-xs">{formatBaht(item.amount)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6} className="text-right font-semibold">
                    รวม
                  </td>
                  <td className="font-semibold">
                    {formatBaht(items.reduce((sum, i) => sum + i.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {payment.note && (
        <p className="text-sm text-slate-700">
          <span className="text-slate-500">หมายเหตุ:</span> {payment.note}
        </p>
      )}

      {/* ---------- เอกสารและรูปแนบ ---------- */}
      {documents.length > 0 && (
        <section className="text-sm">
          <h2 className="mb-1 font-semibold text-slate-800">เอกสารแนบ ({documents.length} ไฟล์)</h2>
          <ul className="list-inside list-disc text-slate-700">
            {documents.map((f) => (
              <li key={f.path}>{f.filename}</li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">รูปถ่ายประกอบ</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.path}
                src={`${PHOTO}?path=${encodeURIComponent(f.path)}`}
                alt={f.filename}
                className="h-28 w-full rounded border border-slate-200 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- ช่องลงนาม ---------- */}
      {/*
        แบบมีอนุมัติจะมี 4 ช่อง (เพิ่มผู้อนุมัติที่ดึงชื่อมาจากใบอนุมัติ)
        แบบรายการทั่วไปมี 3 ช่อง เพราะไม่มีผู้อนุมัติในกระบวนการ
      */}
      <section
        className={`grid grid-cols-1 gap-6 pt-8 sm:grid-cols-3 ${
          withApproval ? "lg:grid-cols-4" : ""
        }`}
      >
        <Signature
          name={payment.created_by_name ?? payment.created_by_full_name}
          role="ผู้จัดทำ"
        />
        <Signature path={payment.payer_signature} name={payment.payer_name} role="ผู้ทำจ่าย" />
        <Signature path={payment.payee_signature} name={payment.payee_name} role="ผู้รับเงิน" />
        {withApproval && <Signature name={payment.approver_name} role="ผู้อนุมัติ" />}
      </section>

      {withApproval && (
        <p className="pt-2 text-center text-[11px] text-slate-400">
          ผู้อนุมัติได้ลงนามไว้ในใบอนุมัติ {payment.ref_no ?? ""} แล้ว ใบเบิกนี้แสดงชื่อเพื่อประกอบการตรวจสอบ
        </p>
      )}
    </main>
  );
}

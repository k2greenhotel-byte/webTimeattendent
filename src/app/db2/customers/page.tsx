import Link from "next/link";
import {
  Db2ApiError,
  db2Customer,
  db2SearchCustomers,
  fmtBaht,
  fmtDate,
  type Db2Customer,
  type Db2CustomerDetail,
} from "@/lib/db2-api";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Db2CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuscod?: string }>;
}) {
  await requirePermission("DB2_CUSTOMER");
  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const cuscod = (p.cuscod ?? "").trim().toUpperCase();

  let results: Db2Customer[] | null = null;
  let truncated = false;
  let detail: Db2CustomerDetail | null = null;
  let error: string | null = null;

  try {
    if (q.length >= 2) {
      const r = await db2SearchCustomers(q);
      results = r.customers;
      truncated = r.truncated;
    }
    if (cuscod) detail = await db2Customer(cuscod);
  } catch (err) {
    error = err instanceof Db2ApiError ? err.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ค้นลูกค้า / สัญญาผ่อนจากระบบขาย</h1>
        <p className="text-sm text-slate-500">
          ค้นด้วยรหัสลูกค้า ชื่อ นามสกุล เลขบัตรประชาชน หรือเบอร์โทร · ข้อมูลสดจากระบบขายในบริษัท
        </p>
      </div>

      <form method="get" className="card flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          className="input w-full sm:w-96"
          placeholder="เช่น NRPM-0022146 หรือ สมเกียรติ"
          autoFocus
        />
        <button type="submit" className="btn-secondary">
          ค้นหา
        </button>
        {q && q.length < 2 && <span className="text-xs text-rose-600">พิมพ์อย่างน้อย 2 ตัวอักษร</span>}
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {results && (
        <section className="card">
          <p className="mb-2 text-sm text-slate-500">
            พบ {results.length} ราย{truncated && " (แสดง 50 รายแรก — ลองค้นให้แคบลง)"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">รหัสลูกค้า</th>
                  <th className="py-1">ชื่อ-นามสกุล</th>
                  <th className="py-1">เบอร์</th>
                  <th className="py-1">ที่อยู่</th>
                  <th className="py-1">สาขา</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.cuscod} className={`border-t border-slate-100 ${c.cuscod === cuscod ? "bg-brand-50" : ""}`}>
                    <td className="py-1 font-mono text-xs">{c.cuscod}</td>
                    <td className="py-1">{c.fullName || "—"}</td>
                    <td className="py-1">{c.mobile || c.phone || "—"}</td>
                    <td className="py-1 max-w-xs truncate">
                      {[c.address.line, c.address.moo && `ม.${c.address.moo}`, c.address.subdistrict].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-1">{c.branch || "—"}</td>
                    <td className="py-1 text-right">
                      <Link href={`?q=${encodeURIComponent(q)}&cuscod=${encodeURIComponent(c.cuscod)}`} className="text-brand-600 hover:underline">
                        ดู
                      </Link>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-slate-500">
                      ไม่พบลูกค้าที่ตรงกับคำค้นนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detail && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-slate-800">
              {detail.customer.fullName} <span className="font-mono text-xs text-slate-500">{detail.customer.cuscod}</span>
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="เบอร์มือถือ" value={detail.customer.mobile} />
              <Field label="โทรศัพท์" value={detail.customer.phone} />
              <Field label="เลขบัตรประชาชน" value={detail.customer.idcard} />
              <Field label="วันเกิด" value={fmtDate(detail.customer.birthDate)} />
              <Field label="อาชีพ" value={detail.customer.occupation} />
              <Field label="สาขา" value={detail.customer.branch} />
              <Field
                label="ที่อยู่"
                value={[
                  detail.customer.address.line,
                  detail.customer.address.moo && `ม.${detail.customer.address.moo}`,
                  detail.customer.address.subdistrict,
                  detail.customer.address.zip,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              สัญญาผ่อน {detail.hirePurchase.count} สัญญา · คงเหลือรวม {fmtBaht(detail.hirePurchase.remainingTotal)} บาท
            </h3>
            {detail.hirePurchase.contracts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="mt-1 w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1">สาขา</th>
                      <th className="py-1">เลขสัญญา</th>
                      <th className="py-1">วันที่ทำสัญญา</th>
                      <th className="py-1 text-right">ยอดรวม</th>
                      <th className="py-1 text-right">ชำระแล้ว</th>
                      <th className="py-1 text-right">คงเหลือ</th>
                      <th className="py-1">ชำระล่าสุด</th>
                      <th className="py-1">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.hirePurchase.contracts.map((c) => (
                      <tr key={`${c.locat}/${c.contno}`} className="border-t border-slate-100">
                        <td className="py-1">{c.locat}</td>
                        <td className="py-1 font-mono text-xs">{c.contno}</td>
                        <td className="py-1">{fmtDate(c.saleDate)}</td>
                        <td className="py-1 text-right tabular-nums">{fmtBaht(c.total)}</td>
                        <td className="py-1 text-right tabular-nums">{fmtBaht(c.paidSum)}</td>
                        <td className={`py-1 text-right tabular-nums ${c.remaining > 0 ? "font-semibold text-rose-600" : "text-emerald-700"}`}>
                          {c.remaining > 0 ? fmtBaht(c.remaining) : "ชำระครบ"}
                        </td>
                        <td className="py-1">
                          {c.lastPayDate ? `${fmtDate(c.lastPayDate)} · ${fmtBaht(c.lastPayAmount)}` : "—"}
                        </td>
                        <td className="py-1">{c.contstat || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700">รถที่เคยซื้อ ({detail.purchases.length})</h3>
            {detail.purchases.length === 0 ? (
              <p className="text-sm text-slate-500">ไม่พบรายการซื้อ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-1 w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1">วันที่</th>
                      <th className="py-1">ช่องทาง</th>
                      <th className="py-1">รุ่น</th>
                      <th className="py-1">สี</th>
                      <th className="py-1">สภาพ</th>
                      <th className="py-1">เลขตัวถัง</th>
                      <th className="py-1">สาขา</th>
                      <th className="py-1 text-right">ราคา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.purchases.map((x) => (
                      <tr key={`${x.locat}/${x.contno}/${x.strno}`} className="border-t border-slate-100">
                        <td className="py-1">{fmtDate(x.saleDate)}</td>
                        <td className="py-1">{x.channelLabel}</td>
                        <td className="py-1">{x.model || "—"}</td>
                        <td className="py-1">{x.color || "—"}</td>
                        <td className="py-1">{x.condition === "N" ? "ใหม่" : x.condition === "O" ? "เก่า" : x.condition || "—"}</td>
                        <td className="py-1 font-mono text-xs">{x.strno}</td>
                        <td className="py-1">{x.locat}</td>
                        <td className="py-1 text-right tabular-nums">{fmtBaht(x.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "—"}</dd>
    </div>
  );
}

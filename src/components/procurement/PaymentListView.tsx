import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { listPayments } from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { PAY_SOURCES, type PaySource } from "@/lib/procurement-types";

export const dynamic = "force-dynamic";

/** รายการใบเบิกของแหล่งจ่ายหนึ่ง — ใช้ร่วมกันทั้งเงินสดย่อย (4.1) และส่วนกลาง (4.2) */
export default async function PaymentListView({
  source,
  params,
}: {
  source: PaySource;
  params: { q?: string; from?: string; to?: string; msg?: string; err?: string };
}) {
  const spec = PAY_SOURCES[source];
  // หน้ารายการก็ต้องมีสิทธิ์อ่านเมนูนี้ ไม่ใช่แค่มีสิทธิ์เข้าโปรแกรม PR
  await requirePermission(spec.menuCode, "read");

  const [rows, canWrite] = await Promise.all([
    listPayments({
      pay_source: source,
      keyword: params.q,
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    checkPermission(spec.menuCode, "write"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{spec.title}</h1>
          <p className="text-sm text-slate-500">
            เลขที่{spec.docLabel}รันแยกตามบริษัทและสาขาที่ทำจ่าย ({spec.prefix}-…) ·
            จ่ายได้ทั้งรายการที่ผ่านอนุมัติและรายการทั่วไป
          </p>
        </div>
        {canWrite && (
          <Link href={`${spec.basePath}/new`} className="btn-primary">
            + บันทึก{spec.docLabel}ใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            className="input w-full sm:w-72"
            placeholder="เลขที่ใบเบิก / เลขที่อนุมัติ / ผู้รับเงิน / ประเภทค่าใช้จ่าย"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-secondary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href={spec.basePath} className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มี{spec.docLabel}ในระบบ</p>
        ) : (
          <>
            {/* ---------- มือถือ: การ์ด ---------- */}
            <ul className="space-y-2 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`${spec.basePath}/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.doc_no}
                    </Link>
                    <span className="text-xs text-slate-500">{formatThaiDate(r.pay_date)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatBaht(r.paid_amount)}
                    <span className="ml-2 font-normal text-slate-600">
                      {r.payee_name ?? "— ไม่ระบุผู้รับเงิน —"}
                    </span>
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                    <div>
                      <dt className="text-slate-400">บริษัท / สาขา</dt>
                      <dd className="truncate">
                        {r.company_name ?? "—"}
                        {r.branch_name ? ` · ${r.branch_name}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">เลขที่อ้างอิง</dt>
                      <dd className="truncate">{r.ref_no ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">ประเภทค่าใช้จ่าย</dt>
                      <dd className="truncate">{r.account_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">ผู้บันทึก</dt>
                      <dd className="truncate">
                        {r.created_by_name ?? r.created_by_full_name ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>อ้างเอกสาร {r.item_count} ใบ</span>
                    <span>· แนบ {r.file_count} ไฟล์</span>
                    <Link
                      href={`${spec.basePath}/${r.id}/print`}
                      className="ml-auto text-brand-600 hover:underline"
                    >
                      พิมพ์เอกสาร
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th>เลขที่เอกสาร</th>
                    <th>วันที่ทำจ่าย</th>
                    <th>บริษัท / สาขา</th>
                    <th>เลขที่อ้างอิง</th>
                    <th className="text-left">ผู้รับเงิน</th>
                    <th className="text-left">ประเภทค่าใช้จ่าย</th>
                    <th>จำนวนเงิน</th>
                    <th>อ้างเอกสาร</th>
                    <th>ไฟล์แนบ</th>
                    <th>ผู้บันทึก</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        <Link
                          href={`${spec.basePath}/${r.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {r.doc_no}
                        </Link>
                      </td>
                      <td className="text-xs">{formatThaiDate(r.pay_date)}</td>
                      <td className="text-xs">
                        {r.company_name ?? "—"}
                        {r.branch_name && (
                          <div className="text-[11px] text-slate-400">{r.branch_name}</div>
                        )}
                      </td>
                      <td className="text-xs">{r.ref_no ?? "—"}</td>
                      <td className="whitespace-normal text-left text-xs">{r.payee_name ?? "—"}</td>
                      <td className="whitespace-normal text-left text-xs">
                        {r.account_code ? `${r.account_code} · ${r.account_name}` : "—"}
                      </td>
                      <td className="text-xs font-medium">{formatBaht(r.paid_amount)}</td>
                      <td className="text-xs">{r.item_count} ใบ</td>
                      <td className="text-xs">{r.file_count} ไฟล์</td>
                      <td className="text-xs">{r.created_by_name ?? r.created_by_full_name ?? "—"}</td>
                      <td>
                        <Link
                          href={`${spec.basePath}/${r.id}/print`}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          พิมพ์
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

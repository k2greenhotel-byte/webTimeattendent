import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { listPayments } from "@/lib/procurement-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 4.1 — รายการใบเบิกจ่ายทั้งหมด */
export default async function PaymentListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;

  const [rows, canWrite] = await Promise.all([
    listPayments({ keyword: params.q, from: params.from || undefined, to: params.to || undefined }),
    checkPermission("PR_PAYMENT", "write"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">4.1 บันทึกประกอบการจ่ายเงิน</h1>
          <p className="text-sm text-slate-500">เลขที่เบิกจ่ายระบบรันให้อัตโนมัติ</p>
        </div>
        {canWrite && (
          <Link href="/procurement/payments/new" className="btn-primary">
            + บันทึกเบิกจ่ายใหม่
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
            placeholder="เลขที่เบิกจ่าย / สาขา / ผู้บันทึก"
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
        <Link href="/procurement/payments" className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีใบเบิกจ่ายในระบบ</p>
        ) : (
          <>
            {/* ---------- มือถือ: การ์ด ---------- */}
            <ul className="space-y-2 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/procurement/payments/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.doc_no}
                    </Link>
                    <span className="text-xs text-slate-500">{formatThaiDate(r.pay_date)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatBaht(r.paid_amount)} · {r.item_count} รายการ · แนบ {r.file_count} ไฟล์
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.branch_name ?? "—"} · ผู้บันทึก {r.created_by_name ?? r.created_by_full_name ?? "—"}
                  </p>
                </li>
              ))}
            </ul>

            {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th>เลขที่เบิกจ่าย</th>
                    <th>วันที่</th>
                    <th>สาขา</th>
                    <th>ยอดจ่ายจริง</th>
                    <th>รายการอ้างอิง</th>
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
                          href={`/procurement/payments/${r.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {r.doc_no}
                        </Link>
                      </td>
                      <td className="text-xs">{formatThaiDate(r.pay_date)}</td>
                      <td className="text-xs">{r.branch_name ?? "—"}</td>
                      <td className="text-xs">{formatBaht(r.paid_amount)}</td>
                      <td className="text-xs">{r.item_count} รายการ</td>
                      <td className="text-xs">{r.file_count} ไฟล์</td>
                      <td className="text-xs">{r.created_by_name ?? r.created_by_full_name ?? "—"}</td>
                      <td>
                        <Link
                          href={`/procurement/payments/${r.id}/print`}
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

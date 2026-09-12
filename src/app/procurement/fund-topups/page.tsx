import Link from "next/link";
import { workDateOf, formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import { listFundMoves, listFunds } from "@/lib/procurement-db";
import { listPayments } from "@/lib/procurement-db";
import {
  FUND_MOVE_CLASS,
  FUND_MOVE_LABEL,
  FUND_MOVE_ORDER,
  PAY_SOURCES,
} from "@/lib/procurement-types";
import { checkPermission, requirePermission } from "@/lib/session";
import { createFundMoveForm, deleteFundMoveForm } from "./actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 4.5 — เติมเงินสำรองจ่าย
 *
 * เลือกกอง → เห็นยอดคงเหลือทันที → เติมเงินเข้า หรือคืนเงินกลับบริษัท
 * ด้านล่างเป็นความเคลื่อนไหวของกองนั้น ทั้งการเติมและใบจ่ายที่ตัดออกไป
 * จะได้กระทบยอดได้ในหน้าเดียวโดยไม่ต้องเปิดหลายจอ
 */
export default async function FundTopupPage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("PR_FUND_TOPUP", "read");
  const params = await searchParams;

  const [canWrite, canDelete, funds] = await Promise.all([
    checkPermission("PR_FUND_TOPUP", "write"),
    checkPermission("PR_FUND_TOPUP", "delete"),
    listFunds(),
  ]);

  // ไม่ได้เลือกกองมา ให้เปิดกองของตัวเองก่อน ถ้าไม่มีค่อยใช้กองแรก
  const selected =
    funds.find((f) => f.id === params.fund) ??
    funds.find((f) => f.holder_id === user.id) ??
    funds[0] ??
    null;

  const [moves, payments] = selected
    ? await Promise.all([
        listFundMoves({ fund_id: selected.id }),
        listPayments({ pay_source: "fund" }),
      ])
    : [[], []];

  const fundPayments = payments.filter((p) => p.fund_id === selected?.id);
  const today = workDateOf();

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">4.5 เติมเงินสำรองจ่าย</h1>
          <p className="text-sm text-slate-500">
            เติมเงินเข้ากองที่ผู้ถือเงินถือไว้ · ยอดคงเหลือคิดจาก เติมเข้า − คืนคืน − ที่จ่ายออกไปแล้ว
          </p>
        </div>
        <Link href={PAY_SOURCES.fund.basePath} className="btn-secondary w-full sm:w-auto">
          ไปหน้าจ่ายเงินจากเงินสำรอง
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {funds.length === 0 ? (
        <p className="card text-sm text-slate-600">
          ยังไม่มีกองเงินสำรอง — ให้ผู้ดูแลระบบไปตั้งวงเงินที่เมนู “ตั้งค่า วงเงินสำรองจ่าย” ก่อน
        </p>
      ) : (
        <>
          {/* ---------- เลือกกอง ---------- */}
          <form method="get" className="card flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <label className="label" htmlFor="fund">
                กองเงินสำรอง
              </label>
              <select id="fund" name="fund" defaultValue={selected?.id ?? ""} className="input">
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.holder_name} ({f.holder_code}) · คงเหลือ {formatBaht(f.balance)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary w-full sm:w-auto">
              เปิดกองนี้
            </button>
          </form>

          {selected && (
            <>
              {/* ---------- ยอดคงเหลือ ---------- */}
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "วงเงินที่อนุมัติ", value: selected.limit_amount, tone: "text-slate-800" },
                  { label: "ถืออยู่ตอนนี้", value: selected.balance, tone: "text-emerald-700" },
                  { label: "เติมได้อีก", value: selected.topup_room, tone: "text-brand-600" },
                  { label: "จ่ายออกไปแล้ว", value: selected.paid_total, tone: "text-slate-800" },
                ].map((box) => (
                  <div key={box.label} className="card">
                    <p className="text-xs text-slate-500">{box.label}</p>
                    <p className={`mt-1 text-lg font-bold ${box.tone}`}>{formatBaht(box.value)}</p>
                  </div>
                ))}
              </section>

              {/* ---------- เติม / คืน ---------- */}
              {canWrite && (
                <section className="card space-y-3">
                  <h2 className="font-semibold text-slate-800">
                    เติมเงิน / คืนเงิน — {selected.holder_name}
                  </h2>
                  <form
                    action={createFundMoveForm}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12"
                  >
                    <input type="hidden" name="fund_id" value={selected.id} />

                    <div className="lg:col-span-2">
                      <label className="label" htmlFor="move_date">
                        วันที่ *
                      </label>
                      <input
                        id="move_date"
                        name="move_date"
                        type="date"
                        defaultValue={today}
                        className="input"
                        required
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="label" htmlFor="kind">
                        ประเภท *
                      </label>
                      <select id="kind" name="kind" defaultValue="topup" className="input">
                        {FUND_MOVE_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {FUND_MOVE_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="label" htmlFor="amount">
                        จำนวนเงิน *
                      </label>
                      <input
                        id="amount"
                        name="amount"
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="label" htmlFor="ref_no">
                        เลขที่อ้างอิง
                      </label>
                      <input
                        id="ref_no"
                        name="ref_no"
                        className="input"
                        placeholder="เลขที่โอน/ใบสำคัญ"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="label" htmlFor="note">
                        หมายเหตุ
                      </label>
                      <input id="note" name="note" className="input" />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="label" htmlFor="created_by_name">
                        ผู้บันทึก
                      </label>
                      <input
                        id="created_by_name"
                        name="created_by_name"
                        defaultValue={user.full_name}
                        className="input"
                      />
                    </div>
                    <div className="flex items-end lg:col-span-2">
                      <button type="submit" className="btn-primary w-full">
                        บันทึก
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 lg:col-span-7 lg:self-end">
                      เติมได้อีกไม่เกิน {formatBaht(selected.topup_room)} · คืนได้ไม่เกิน{" "}
                      {formatBaht(selected.balance)}
                    </p>
                  </form>
                </section>
              )}

              {/* ---------- ความเคลื่อนไหว ---------- */}
              <section className="card space-y-3">
                <h2 className="font-semibold text-slate-800">
                  ความเคลื่อนไหวของกอง ({moves.length + fundPayments.length} รายการ)
                </h2>

                {moves.length === 0 && fundPayments.length === 0 ? (
                  <p className="text-sm text-slate-500">ยังไม่มีความเคลื่อนไหวในกองนี้</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-report w-full">
                      <thead>
                        <tr>
                          <th>วันที่</th>
                          <th>เลขที่</th>
                          <th>ประเภท</th>
                          <th className="text-left">รายละเอียด</th>
                          <th>เข้า</th>
                          <th>ออก</th>
                          {canDelete && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...moves.map((m) => ({
                            key: m.id,
                            date: m.move_date,
                            docNo: m.doc_no,
                            label: FUND_MOVE_LABEL[m.kind],
                            cls: FUND_MOVE_CLASS[m.kind],
                            detail: [m.ref_no, m.note, m.created_by_name]
                              .filter(Boolean)
                              .join(" · "),
                            inAmount: m.kind === "topup" ? m.amount : 0,
                            outAmount: m.kind === "return" ? m.amount : 0,
                            movable: true as const,
                            href: null as string | null,
                          })),
                          ...fundPayments.map((p) => ({
                            key: p.id,
                            date: p.pay_date,
                            docNo: p.doc_no,
                            label: "จ่ายออกจากกอง",
                            cls: "bg-rose-100 text-rose-700",
                            detail: [p.payee_name, p.expense_detail].filter(Boolean).join(" · "),
                            inAmount: 0,
                            outAmount: p.paid_amount,
                            movable: false as const,
                            href: `${PAY_SOURCES.fund.basePath}/${p.id}`,
                          })),
                        ]
                          .sort((a, b) => (a.date === b.date ? b.docNo.localeCompare(a.docNo) : b.date.localeCompare(a.date)))
                          .map((row) => (
                            <tr key={row.key}>
                              <td className="text-xs">{formatThaiDate(row.date)}</td>
                              <td className="text-xs font-medium">
                                {row.href ? (
                                  <Link href={row.href} className="text-brand-600 hover:underline">
                                    {row.docNo}
                                  </Link>
                                ) : (
                                  row.docNo
                                )}
                              </td>
                              <td>
                                <span className={`badge ${row.cls}`}>{row.label}</span>
                              </td>
                              <td className="whitespace-normal text-left text-xs">
                                {row.detail || "—"}
                              </td>
                              <td className="text-xs text-emerald-700">
                                {row.inAmount > 0 ? formatBaht(row.inAmount) : "—"}
                              </td>
                              <td className="text-xs text-rose-700">
                                {row.outAmount > 0 ? formatBaht(row.outAmount) : "—"}
                              </td>
                              {canDelete && (
                                <td>
                                  {row.movable ? (
                                    <form action={deleteFundMoveForm} className="flex items-center gap-1">
                                      <input type="hidden" name="id" value={row.key} />
                                      <input type="hidden" name="fund_id" value={selected.id} />
                                      <input type="checkbox" name="confirm" aria-label="ยืนยันลบ" />
                                      <button type="submit" className="text-xs text-rose-600 hover:underline">
                                        ลบ
                                      </button>
                                    </form>
                                  ) : (
                                    <span className="text-xs text-slate-400">ลบที่ใบจ่าย</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

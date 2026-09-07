import Link from "next/link";
import PrintButton from "@/components/procurement/PrintButton";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, monthBounds, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht, summarizeByTag } from "@/lib/procurement";
import { listPaymentTagRows, listTags } from "@/lib/procurement-db";
import {
  PAY_SOURCES,
  PAY_SOURCE_CLASS,
  PAY_SOURCE_LABEL,
  PAY_SOURCE_ORDER,
  type PaySource,
  type TagReportQuery,
} from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;

/** สัดส่วนของแต่ละป้ายเทียบกับป้ายที่มากที่สุด — ใช้วาดแท่งเทียบสายตา */
function barWidth(amount: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.max(2, Math.round((amount / max) * 100))}%`;
}

/**
 * หน้าจอ 4.3 — รายงานสรุปยอดจ่ายตามป้ายกำกับ
 *
 * รวมทั้งใบเบิกเงินสดย่อยและใบเบิกจ่ายส่วนกลาง กรองตามช่วงวันที่ บริษัท สาขา แหล่งจ่าย และป้ายได้
 * ใบที่ติดหลายป้ายจะถูกนับเข้าทุกป้ายที่ติดไว้ ผลรวมของทุกป้ายจึงมากกว่ายอดจริงได้
 * ตัวเลข "รวมทั้งหมด" ด้านบนจึงนับจากใบที่ไม่ซ้ำ ไม่ใช่บวกยอดของทุกป้าย
 */
export default async function TagReportPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requirePermission("PR_TAG_REPORT", "read");
  const params = await searchParams;

  // ค่าเริ่มต้นคือเดือนปัจจุบัน ผู้ใช้เปลี่ยนช่วงเองได้
  const today = workDateOf();
  const thisMonth = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const source = (PAY_SOURCE_ORDER as string[]).includes(params.source ?? "")
    ? (params.source as PaySource)
    : null;

  const query: TagReportQuery = {
    from: params.from || thisMonth.from,
    to: params.to || thisMonth.to,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    pay_source: source,
    tag_id: params.tag_id || null,
  };

  const [rows, companies, branches, tags] = await Promise.all([
    listPaymentTagRows(query),
    listCompanies(true),
    listBranches(true),
    listTags(),
  ]);

  const summary = summarizeByTag(rows);
  const maxAmount = Math.max(0, ...summary.lines.map((l) => l.amount));

  /** ใบเบิกไม่ซ้ำ เรียงวันที่ล่าสุดก่อน — ใช้แสดงรายการด้านล่าง */
  const payments = [...new Map(rows.map((r) => [r.payment_id, r])).values()];
  const tagsOfPayment = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.tag_name) continue;
    tagsOfPayment.set(r.payment_id, [...(tagsOfPayment.get(r.payment_id) ?? []), r.tag_name]);
  }

  return (
    <main className="mx-auto max-w-[100rem] space-y-4 p-3 sm:p-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">4.3 รายงานสรุปตามป้ายกำกับ</h1>
          <p className="text-sm text-slate-500">
            สรุปยอดจ่ายของใบเบิกเงินสดย่อยและใบเบิกจ่ายส่วนกลาง แยกตามป้ายที่ติดไว้
          </p>
        </div>
        <PrintButton />
      </div>

      {/* ---------- เงื่อนไข ---------- */}
      <form method="get" className="no-print card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={query.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={query.to ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="source">
            แหล่งจ่าย
          </label>
          <select id="source" name="source" defaultValue={params.source ?? ""} className="input">
            <option value="">ทั้งสองแหล่ง</option>
            {PAY_SOURCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {PAY_SOURCES[s].title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="company_id">
            บริษัท
          </label>
          <select id="company_id" name="company_id" defaultValue={params.company_id ?? ""} className="input">
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขา
          </label>
          <select id="branch_id" name="branch_id" defaultValue={params.branch_id ?? ""} className="input">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tag_id">
            ป้ายกำกับ
          </label>
          <select id="tag_id" name="tag_id" defaultValue={params.tag_id ?? ""} className="input">
            <option value="">ทุกป้าย</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            ดูรายงาน
          </button>
          <Link href="/procurement/tag-report" className="btn-secondary w-full sm:w-auto">
            ล้างเงื่อนไข
          </Link>
        </div>
      </form>

      {/* ---------- สรุปหัวรายงาน ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "จำนวนใบเบิก", value: `${summary.totalPayments} ใบ` },
          { label: "ยอดจ่ายรวม", value: formatBaht(summary.totalAmount) },
          { label: "จำนวนป้ายที่ใช้", value: `${summary.lines.filter((l) => l.tag_id).length} ป้าย` },
          {
            label: "ช่วงวันที่",
            value: `${formatThaiDate(query.from ?? today)} – ${formatThaiDate(query.to ?? today)}`,
          },
        ].map((card) => (
          <div key={card.label} className="card">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </section>

      {/* ---------- ยอดตามป้าย ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ยอดจ่ายแยกตามป้าย</h2>

        {summary.lines.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีใบเบิกในช่วงและเงื่อนไขที่เลือก</p>
        ) : (
          <>
            {/* มือถือ: แท่งเทียบสัดส่วน อ่านง่ายกว่าตารางแคบ ๆ */}
            <ul className="space-y-2 md:hidden">
              {summary.lines.map((line) => (
                <li key={line.tag_id ?? "none"} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={line.tag_id ? "font-medium text-slate-800" : "text-slate-500"}>
                      {line.tag_id ? `#${line.tag_name}` : line.tag_name}
                    </span>
                    <span className="font-semibold text-slate-800">{formatBaht(line.amount)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${line.tag_id ? "bg-brand-500" : "bg-slate-300"}`}
                      style={{ width: barWidth(line.amount, maxAmount) }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{line.count} ใบ</p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th className="text-left">ป้ายกำกับ</th>
                    <th>จำนวนใบ</th>
                    <th>ยอดรวม</th>
                    <th className="text-left">สัดส่วน</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.map((line) => (
                    <tr key={line.tag_id ?? "none"}>
                      <td className="text-left font-medium">
                        {line.tag_id ? (
                          <span className="badge bg-brand-100 text-brand-700">#{line.tag_name}</span>
                        ) : (
                          <span className="text-slate-400">{line.tag_name}</span>
                        )}
                      </td>
                      <td>{line.count}</td>
                      <td className="font-medium">{formatBaht(line.amount)}</td>
                      <td className="w-1/3">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${line.tag_id ? "bg-brand-500" : "bg-slate-300"}`}
                            style={{ width: barWidth(line.amount, maxAmount) }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500">
              ใบที่ติดหลายป้ายถูกนับเข้าทุกป้ายที่ติดไว้ ผลรวมของทุกป้ายจึงมากกว่ายอดจ่ายจริงได้ ·
              ตัวเลข “ยอดจ่ายรวม” ด้านบนนับจากใบที่ไม่ซ้ำ
            </p>
          </>
        )}
      </section>

      {/* ---------- ใบเบิกในช่วงที่เลือก ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ใบเบิกในเงื่อนไขนี้ ({payments.length} ใบ)</h2>

        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีใบเบิก</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่</th>
                  <th>แหล่งจ่าย</th>
                  <th className="text-left">รายการค่าใช้จ่าย</th>
                  <th className="text-left">ผู้รับเงิน</th>
                  <th>สาขา</th>
                  <th className="text-left">ป้ายกำกับ</th>
                  <th>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td className="font-medium">
                      <Link
                        href={`${PAY_SOURCES[p.pay_source].basePath}/${p.payment_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {p.doc_no}
                      </Link>
                    </td>
                    <td className="text-xs">{formatThaiDate(p.pay_date)}</td>
                    <td>
                      <span className={`badge whitespace-nowrap ${PAY_SOURCE_CLASS[p.pay_source]}`}>
                        {PAY_SOURCE_LABEL[p.pay_source]}
                      </span>
                    </td>
                    <td className="whitespace-normal text-left text-xs">{p.expense_detail ?? "—"}</td>
                    <td className="whitespace-normal text-left text-xs">{p.payee_name ?? "—"}</td>
                    <td className="text-xs">{p.branch_name ?? "—"}</td>
                    <td className="whitespace-normal text-left text-xs">
                      {(tagsOfPayment.get(p.payment_id) ?? []).map((t) => `#${t}`).join(" ") || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-xs font-medium">{formatBaht(p.paid_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

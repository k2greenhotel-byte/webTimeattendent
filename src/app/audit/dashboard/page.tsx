import Link from "next/link";
import AuditTable from "@/components/audit/AuditTable";
import CheckTable from "@/components/audit/CheckTable";
import {
  checkQueryFromParams,
  countMissingDocs,
  formatBaht,
  formatPct,
  groupChecks,
  isProblem,
  rangeLabel,
  summarizeChecks,
  type AudParams,
} from "@/lib/audit";
import { listAudits, listCheckRows } from "@/lib/audit-db";
import { AUD_KIND_SHORT } from "@/lib/audit-types";
import { addDays, workDateOf } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 4 — Dashboard ภาพรวมงานตรวจสอบบัญชี (ค่าเริ่มต้น 30 วันล่าสุด) */
export default async function AuditDashboardPage({
  searchParams,
}: {
  searchParams: Promise<AudParams>;
}) {
  await requirePermission("AUD_DASH", "read");
  const params = await searchParams;

  const today = workDateOf();
  const from = params.from || addDays(today, -29);
  const to = params.to || today;
  const query = { ...checkQueryFromParams(params), from, to };

  const [rows, audits] = await Promise.all([
    listCheckRows(query),
    listAudits({ from, to, limit: 100 }),
  ]);

  const summary = summarizeChecks(rows);
  const byBranch = groupChecks(rows, (r) => r.branch_label ?? r.branch_name, "— ไม่ระบุสาขา —");
  const byKind = groupChecks(rows, (r) => AUD_KIND_SHORT[r.kind]);
  const missingDocs = countMissingDocs(rows).slice(0, 8);
  const problems = rows.filter(isProblem).slice(0, 30);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">4. Dashboard ตรวจสอบบัญชี</h1>
          <p className="text-sm text-slate-500">ช่วงที่แสดง: {rangeLabel(from, to)}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">ตั้งแต่</label>
            <input name="from" type="date" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label">ถึง</label>
            <input name="to" type="date" defaultValue={to} className="input" />
          </div>
          <button type="submit" className="btn-primary">
            แสดง
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="ใบคุมงาน" value={String(audits.length)} sub={`${rows.length} รายการที่ตรวจ`} />
        <Stat label="ถูกต้อง" value={String(summary.correct)} sub={formatPct(summary.correctPct)} tone="text-emerald-600" />
        <Stat label="ไม่ถูกต้อง" value={String(summary.wrong)} tone="text-rose-600" />
        <Stat label="เอกสารไม่ครบ" value={String(summary.docIncomplete)} tone="text-amber-600" />
        <Stat
          label="ข้อมูลไม่ตรง"
          value={String(summary.abnormal + summary.branchError)}
          sub={`ผิดปกติ ${summary.abnormal} · สาขาสื่อสารผิด ${summary.branchError}`}
          tone="text-rose-600"
        />
        <Stat label="ยอดเงินที่ตรวจ" value={formatBaht(summary.amountTotal)} sub="บาท" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">สาขาที่ต้องจับตา</h2>
          {byBranch.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">ยังไม่มีข้อมูลในช่วงนี้</p>
          ) : (
            <table className="table-report">
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th className="w-20 text-right">ตรวจ</th>
                  <th className="w-24 text-right">ไม่ถูกต้อง</th>
                  <th className="w-24 text-right">เอกสารไม่ครบ</th>
                  <th className="w-24 text-right">ข้อมูลไม่ตรง</th>
                </tr>
              </thead>
              <tbody>
                {byBranch.slice(0, 12).map((g) => (
                  <tr key={g.label}>
                    <td className="text-left">{g.label}</td>
                    <td className="text-right tabular-nums">{g.summary.count}</td>
                    <td className="text-right tabular-nums text-rose-600">{g.summary.wrong || "—"}</td>
                    <td className="text-right tabular-nums text-amber-600">{g.summary.docIncomplete || "—"}</td>
                    <td className="text-right tabular-nums text-rose-600">
                      {g.summary.abnormal + g.summary.branchError || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">แยกตามชนิดของงานตรวจ</h2>
          {byKind.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">ยังไม่มีข้อมูลในช่วงนี้</p>
          ) : (
            <table className="table-report">
              <thead>
                <tr>
                  <th>ชนิดงานตรวจ</th>
                  <th className="w-20 text-right">ตรวจ</th>
                  <th className="w-24 text-right">ไม่ถูกต้อง</th>
                  <th className="w-28 text-right">% ถูกต้อง</th>
                </tr>
              </thead>
              <tbody>
                {byKind.map((g) => (
                  <tr key={g.label}>
                    <td className="text-left">{g.label}</td>
                    <td className="text-right tabular-nums">{g.summary.count}</td>
                    <td className="text-right tabular-nums text-rose-600">{g.summary.wrong || "—"}</td>
                    <td className="text-right tabular-nums">{formatPct(g.summary.correctPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="mb-2 mt-4 font-semibold text-slate-800">เอกสารที่ขาดบ่อย</h3>
          {missingDocs.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">ไม่มีเอกสารขาดในช่วงนี้</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {missingDocs.map((d) => (
                <li key={d.name} className="flex justify-between">
                  <span className="text-slate-600">{d.name}</span>
                  <span className="tabular-nums font-medium text-amber-700">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">รายการที่ต้องตามต่อ (30 รายการแรก)</h2>
          <Link href={`/audit/reports?from=${from}&to=${to}`} className="text-sm text-brand-700 hover:underline">
            ดูรายงานเต็ม →
          </Link>
        </div>
        <CheckTable rows={problems} empty="ไม่มีรายการที่ต้องตามต่อในช่วงนี้ 🎉" />
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">ใบคุมงานล่าสุด</h2>
        <AuditTable rows={audits.slice(0, 20)} />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-slate-800",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

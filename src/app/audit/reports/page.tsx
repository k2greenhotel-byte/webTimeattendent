import CheckFilters from "@/components/audit/CheckFilters";
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
import { listCheckRows, listCheckTypes } from "@/lib/audit-db";
import type { AudSummary } from "@/lib/audit";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees } from "@/lib/db";
import { formatThaiDate } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 3 — รายงานสรุปผลการตรวจสอบ (พิมพ์ได้ + โหลด Excel/CSV) */
export default async function AuditReportPage({
  searchParams,
}: {
  searchParams: Promise<AudParams>;
}) {
  await requirePermission("AUD_REPORT", "read");
  const params = await searchParams;
  const query = checkQueryFromParams(params);

  const [rows, companies, branches, employees, types] = await Promise.all([
    listCheckRows(query),
    listCompanies(true),
    listBranches(true),
    listEmployees(true),
    listCheckTypes(true),
  ]);

  const summary = summarizeChecks(rows);
  const byBranch = groupChecks(rows, (r) => r.branch_label ?? r.branch_name, "— ไม่ระบุสาขา —");
  const byType = groupChecks(rows, (r) => r.type_name);
  const byAuditor = groupChecks(rows, (r) => r.auditor_name, "— ไม่ระบุผู้ตรวจสอบ —");
  const missingDocs = countMissingDocs(rows);
  const problems = rows.filter(isProblem);

  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3. รายงานผลการตรวจสอบ</h1>
          <p className="text-sm text-slate-500">ช่วงที่เลือก: {rangeLabel(query.from, query.to)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <a href={`/api/audit/export?${qs}&format=xlsx`} className="btn-secondary">
            โหลด Excel
          </a>
          <a href={`/api/audit/export?${qs}&format=csv`} className="btn-secondary">
            โหลด CSV
          </a>
        </div>
      </div>

      <CheckFilters
        params={params}
        companies={companies}
        branches={branches}
        auditors={employees}
        types={types}
        resetHref="/audit/reports"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="รายการที่ตรวจ" value={String(summary.count)} sub={`ยังไม่ลงผล ${summary.pending}`} />
        <Stat label="ถูกต้อง" value={String(summary.correct)} sub={formatPct(summary.correctPct)} tone="text-emerald-600" />
        <Stat label="ไม่ถูกต้อง" value={String(summary.wrong)} tone="text-rose-600" />
        <Stat label="เอกสารไม่ครบ" value={String(summary.docIncomplete)} tone="text-amber-600" />
        <Stat label="ติดต่อไม่ได้" value={String(summary.noContact)} tone="text-slate-600" />
        <Stat label="ยอดเงินที่ตรวจ" value={formatBaht(summary.amountTotal)} sub="บาท" />
      </div>

      <GroupTable title="สรุปตามสาขา (มีปัญหามากสุดขึ้นก่อน)" head="สาขา" groups={byBranch} />
      <GroupTable title="สรุปตามรายการตรวจ" head="รายการตรวจ" groups={byType} />
      <GroupTable title="สรุปตามผู้ตรวจสอบ" head="ผู้ตรวจสอบ" groups={byAuditor} />

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">เอกสารที่ขาดบ่อยที่สุด</h2>
        {missingDocs.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">ไม่พบรายการที่เอกสารขาดในช่วงนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เอกสาร</th>
                  <th className="w-32 text-right">จำนวนครั้งที่ขาด</th>
                </tr>
              </thead>
              <tbody>
                {missingDocs.map((d) => (
                  <tr key={d.name}>
                    <td className="text-left">{d.name}</td>
                    <td className="text-right tabular-nums text-amber-700">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">
          รายการที่ต้องตามต่อ ({problems.length} รายการ)
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          ตรวจแล้วไม่ถูกต้อง เอกสารไม่ครบ ติดต่อไม่ได้ ข้อมูลไม่ตรง หรือสลิปนำฝากมีปัญหา
        </p>
        <CheckTable rows={problems} empty="ไม่มีรายการที่ต้องตามต่อในช่วงนี้ 🎉" />
      </section>

      <p className="text-xs text-slate-400">
        พิมพ์เมื่อ {formatThaiDate(new Date().toISOString().slice(0, 10))}
      </p>
    </main>
  );
}

function GroupTable({
  title,
  head,
  groups,
}: {
  title: string;
  head: string;
  groups: { label: string; summary: AudSummary }[];
}) {
  if (groups.length === 0) return null;

  return (
    <section className="card">
      <h2 className="mb-2 font-semibold text-slate-800">{title}</h2>
      <div className="overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>{head}</th>
              <th className="w-24 text-right">ตรวจทั้งหมด</th>
              <th className="w-24 text-right">ถูกต้อง</th>
              <th className="w-24 text-right">ไม่ถูกต้อง</th>
              <th className="w-24 text-right">เอกสารไม่ครบ</th>
              <th className="w-24 text-right">ติดต่อไม่ได้</th>
              <th className="w-24 text-right">ผิดปกติ</th>
              <th className="w-28 text-right">สาขาสื่อสารผิด</th>
              <th className="w-28 text-right">% ถูกต้อง</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.label}>
                <td className="text-left">{g.label}</td>
                <td className="text-right tabular-nums">{g.summary.count}</td>
                <td className="text-right tabular-nums text-emerald-600">{g.summary.correct || "—"}</td>
                <td className="text-right tabular-nums text-rose-600">{g.summary.wrong || "—"}</td>
                <td className="text-right tabular-nums text-amber-600">{g.summary.docIncomplete || "—"}</td>
                <td className="text-right tabular-nums">{g.summary.noContact || "—"}</td>
                <td className="text-right tabular-nums text-rose-600">{g.summary.abnormal || "—"}</td>
                <td className="text-right tabular-nums text-amber-600">{g.summary.branchError || "—"}</td>
                <td className="text-right tabular-nums">{formatPct(g.summary.correctPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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

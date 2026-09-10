import CheckFilters from "@/components/audit/CheckFilters";
import CheckTable from "@/components/audit/CheckTable";
import {
  checkQueryFromParams,
  formatBaht,
  formatPct,
  isProblem,
  summarizeChecks,
  type AudParams,
} from "@/lib/audit";
import { listCheckRows, listCheckTypes } from "@/lib/audit-db";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 2 — สอบถามผลการตรวจย้อนหลังรายเอกสาร */
export default async function AuditSearchPage({
  searchParams,
}: {
  searchParams: Promise<AudParams>;
}) {
  await requirePermission("AUD_SEARCH", "read");
  const params = await searchParams;

  const [rows, companies, branches, employees, types] = await Promise.all([
    listCheckRows(checkQueryFromParams(params)),
    listCompanies(true),
    listBranches(true),
    listEmployees(true),
    listCheckTypes(true),
  ]);

  const summary = summarizeChecks(rows);
  const problems = rows.filter(isProblem);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">2. สอบถามผลการตรวจสอบ</h1>
        <p className="text-sm text-slate-500">
          ค้นย้อนหลังรายเอกสาร — กดเลขที่ใบคุมงานเพื่อเปิดดูใบเต็มพร้อมผลตรวจทุกรายการ
        </p>
      </div>

      <CheckFilters
        params={params}
        companies={companies}
        branches={branches}
        auditors={employees}
        types={types}
        resetHref="/audit/search"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="รายการที่พบ" value={String(summary.count)} sub={`ยังไม่ลงผล ${summary.pending}`} />
        <Stat label="ถูกต้อง" value={String(summary.correct)} sub={formatPct(summary.correctPct)} tone="text-emerald-600" />
        <Stat label="ไม่ถูกต้อง" value={String(summary.wrong)} tone="text-rose-600" />
        <Stat label="เอกสารไม่ครบ" value={String(summary.docIncomplete)} tone="text-amber-600" />
        <Stat label="ติดต่อไม่ได้" value={String(summary.noContact)} tone="text-slate-600" />
        <Stat
          label="ข้อมูลไม่ตรง"
          value={String(summary.abnormal + summary.branchError)}
          sub={`ผิดปกติ ${summary.abnormal} · สาขาสื่อสารผิด ${summary.branchError}`}
          tone="text-rose-600"
        />
      </div>

      <p className="text-sm text-slate-500">
        ยอดเงินรวมของรายการที่พบ {formatBaht(summary.amountTotal)} บาท · ต้องตามต่อ {problems.length} รายการ
      </p>

      <div className="card">
        <CheckTable rows={rows} />
      </div>
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

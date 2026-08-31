import BranchFilter from "@/components/BranchFilter";
import ExportButtons from "@/components/ExportButtons";
import ReportTable from "@/components/ReportTable";
import TotalsCards from "@/components/TotalsCards";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { buildDailyReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : workDateOf();
  const branchId = params.branch || undefined;

  const [branches, { rows, totals, settings }] = await Promise.all([
    listBranches(),
    buildDailyReport(date, branchId),
  ]);
  const currentBranch = branches.find((b) => b.id === branchId);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">รายงานการลงเวลา — รายวัน</h1>
          <p className="text-sm text-slate-500">
            {settings.org_name} · {formatThaiDate(date)} ·{" "}
            {currentBranch ? `สาขา ${currentBranch.name}` : "ทุกสาขา"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="no-print flex items-end gap-2">
            <div>
              <label className="label" htmlFor="date">
                เลือกวันที่
              </label>
              <input id="date" name="date" type="date" defaultValue={date} className="input" />
            </div>
            <BranchFilter branches={branches} value={branchId} />
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>
          <ExportButtons
            query={`kind=daily&date=${date}${branchId ? `&branch=${branchId}` : ""}`}
          />
        </div>
      </div>

      <TotalsCards totals={totals} />

      <section className="card">
        <ReportTable rows={rows} showEmployee editBase="/admin/records" />
      </section>
    </main>
  );
}

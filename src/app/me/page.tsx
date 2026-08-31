import AppHeader from "@/components/AppHeader";
import ExportButtons from "@/components/ExportButtons";
import ReportTable from "@/components/ReportTable";
import TotalsCards from "@/components/TotalsCards";
import { formatThaiMonth, monthBounds, workDateOf } from "@/lib/datetime";
import { buildEmployeeReport } from "@/lib/reports";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const today = workDateOf();
  const year = Number(params.year) || Number(today.slice(0, 4));
  const month = Number(params.month) || Number(today.slice(5, 7));
  const { from, to } = monthBounds(year, month);

  const { rows, totals } = await buildEmployeeReport({ employeeId: user.id, from, to });

  return (
    <div className="min-h-screen">
      <AppHeader user={user} links={[{ href: "/punch", label: "ลงเวลา" }]} />

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ประวัติการลงเวลาของฉัน</h1>
            <p className="text-sm text-slate-500">{formatThaiMonth(year, month)}</p>
          </div>

          <form className="no-print flex items-end gap-2" method="get">
            <div>
              <label className="label" htmlFor="month">
                เดือน
              </label>
              <select id="month" name="month" defaultValue={month} className="input">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {formatThaiMonth(year, m).split(" ")[0]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="year">
                ปี (ค.ศ.)
              </label>
              <input id="year" name="year" type="number" defaultValue={year} className="input w-28" />
            </div>
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>

          <ExportButtons query={`kind=employee&employeeId=${user.id}&from=${from}&to=${to}`} />
        </div>

        <TotalsCards totals={totals} />

        <section className="card">
          <ReportTable rows={rows} />
        </section>
      </main>
    </div>
  );
}

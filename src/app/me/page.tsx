import AppHeader from "@/components/AppHeader";
import ChangePinForm from "@/components/ChangePinForm";
import ExportButtons from "@/components/ExportButtons";
import ReportTable from "@/components/ReportTable";
import TotalsCards from "@/components/TotalsCards";
import { addDays, formatThaiDate, formatThaiMonth, monthBounds, workDateOf } from "@/lib/datetime";
import { listAssignments } from "@/lib/db";
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

  const [{ rows, totals }, upcoming] = await Promise.all([
    buildEmployeeReport({ employeeId: user.id, from, to }),
    // ตารางเวร 7 วันข้างหน้าของตัวเอง (มีเฉพาะคนที่หัวหน้าจัดเวรให้)
    listAssignments({ from: today, to: addDays(today, 6), employeeIds: [user.id] }),
  ]);

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

        {upcoming.length > 0 && (
          <section className="card">
            <p className="mb-2 font-semibold text-slate-700">ตารางเวร 7 วันข้างหน้า</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {upcoming.map((a) => (
                <div
                  key={a.work_date}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    a.is_day_off ? "bg-slate-100 text-slate-600" : "bg-sky-50 text-sky-800"
                  }`}
                >
                  <p className="text-xs">{formatThaiDate(a.work_date)}</p>
                  <p className="font-semibold">{a.is_day_off ? "หยุดเวร" : (a.schedule_name ?? "-")}</p>
                  {a.note && <p className="text-xs text-slate-500">{a.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <TotalsCards totals={totals} />

        <section className="card">
          <ReportTable rows={rows} />
        </section>

        <ChangePinForm />
      </main>
    </div>
  );
}

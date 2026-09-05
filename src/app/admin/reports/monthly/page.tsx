import Link from "next/link";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { getCompanyScope } from "@/lib/att-scope";
import ExportButtons from "@/components/ExportButtons";
import { formatDuration, formatThaiMonth, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/reports";
import type { DayStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const CELL: Record<DayStatus, { text: string; cls: string }> = {
  complete: { text: "✓", cls: "bg-emerald-50 text-emerald-700" },
  incomplete: { text: "!", cls: "bg-amber-50 text-amber-700" },
  absent: { text: "✕", cls: "bg-rose-50 text-rose-600" },
  holiday: { text: "-", cls: "bg-slate-50 text-slate-300" },
  off: { text: "○", cls: "bg-sky-50 text-sky-500" },
};

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; branch?: string; company?: string }>;
}) {
  const params = await searchParams;
  const today = workDateOf();
  const year = Number(params.year) || Number(today.slice(0, 4));
  const month = Number(params.month) || Number(today.slice(5, 7));
  const branchId = params.branch || undefined;

  const scope = await getCompanyScope(params.company);
  const [branches, { dates, employees, settings }] = await Promise.all([
    listBranches(false, scope.companyId),
    buildMonthlyReport(year, month, branchId, scope.companyId),
  ]);
  const currentBranch = branches.find((b) => b.id === branchId);

  return (
    <main className="mx-auto max-w-full space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">รายงานการลงเวลา — รายเดือน</h1>
          <p className="text-sm text-slate-500">
            {settings.org_name} · {formatThaiMonth(year, month)} ·{" "}
            {currentBranch ? `สาขา ${currentBranch.name}` : "ทุกสาขา"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="no-print flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
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
            <BranchFilter branches={branches} value={branchId} />
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>
          <ExportButtons
            query={`kind=monthly&year=${year}&month=${month}${branchId ? `&branch=${branchId}` : ""}`}
          />
        </div>
      </div>

      <section className="card table-wrap">
        <table className="table-report">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50">พนักงาน</th>
              {dates.map((d) => (
                <th key={d} className="px-1 text-xs">
                  {Number(d.slice(8, 10))}
                </th>
              ))}
              <th>ชม.รวม</th>
              <th>สาย<br />(วัน)</th>
              <th>ขาด<br />(วัน)</th>
              <th>ไม่ครบ<br />(วัน)</th>
              <th>พักเกิน<br />(นาที)</th>
              <th>งานพิเศษ<br />นอกสถานที่</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((row) => (
              <tr key={row.employee.id}>
                <td className="sticky left-0 z-10 bg-white text-left">
                  <Link
                    href={`/admin/reports/employee?employeeId=${row.employee.id}&from=${dates[0]}&to=${dates[dates.length - 1]}`}
                    className="text-brand-600 hover:underline"
                  >
                    {row.employee.emp_code} · {row.employee.full_name}
                  </Link>
                </td>
                {dates.map((d) => {
                  const s = row.byDate.get(d);
                  const cell = CELL[s?.status ?? "holiday"];
                  return (
                    <td key={d} className={`px-1 ${cell.cls}`} title={s?.flags.join(", ")}>
                      {s && s.lateMinutes > 0 ? "L" : cell.text}
                    </td>
                  );
                })}
                <td className="font-medium">{formatDuration(row.totals.workMinutes)}</td>
                <td>{row.totals.lateDays || "-"}</td>
                <td>{row.totals.absentDays || "-"}</td>
                <td>{row.totals.incompleteDays || "-"}</td>
                <td>{row.totals.overBreakMinutes || "-"}</td>
                <td className="text-violet-700">
                  {row.totals.fieldMinutes > 0 ? formatDuration(row.totals.fieldMinutes) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-slate-500">
          ✓ = ลงเวลาครบ 4 ครั้ง · L = มาสาย · ! = ลงเวลาไม่ครบ · ✕ = ขาดงาน · - = วันหยุด · ○ = หยุดเวร ·
          งานพิเศษนอกสถานที่ = ชั่วโมงจากภารกิจที่นับชั่วโมง (แยกจาก OT)
        </p>
      </section>
    </main>
  );
}

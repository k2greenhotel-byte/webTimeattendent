import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { getCompanyScope } from "@/lib/att-scope";
import ExportButtons from "@/components/ExportButtons";
import FieldReportTable from "@/components/FieldReportTable";
import ReportTable from "@/components/ReportTable";
import TotalsCards from "@/components/TotalsCards";
import { formatDuration, formatThaiDate, monthBounds, workDateOf } from "@/lib/datetime";
import { listBranches, listEmployees } from "@/lib/db";
import { buildEmployeeReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function EmployeeReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    from?: string;
    to?: string;
    branch?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const branchId = params.branch || undefined;
  const scope = await getCompanyScope(params.company);
  const [employees, branches] = await Promise.all([
    listEmployees({ branchId, companyId: scope.companyId }),
    listBranches(false, scope.companyId),
  ]);

  const today = workDateOf();
  const bounds = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const from = params.from ?? bounds.from;
  const to = params.to ?? bounds.to;
  const employeeId = params.employeeId ?? employees[0]?.id;

  const report = employeeId
    ? await buildEmployeeReport({ employeeId, from, to, companyId: scope.companyId })
    : null;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">รายงานการลงเวลา — รายบุคคล</h1>
          <p className="text-sm text-slate-500">
            {report?.employee
              ? `${report.employee.full_name} (${report.employee.emp_code})${
                  report.rows[0]?.branchName ? ` · สาขา ${report.rows[0].branchName}` : ""
                }`
              : "ยังไม่มีพนักงานในระบบ"}{" "}
            · {formatThaiDate(from)} - {formatThaiDate(to)}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="no-print flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
            <BranchFilter branches={branches} value={branchId} />
            <div>
              <label className="label" htmlFor="employeeId">
                พนักงาน
              </label>
              <select id="employeeId" name="employeeId" defaultValue={employeeId} className="input">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emp_code} · {e.full_name}
                    {e.is_active ? "" : " (ปิดใช้งาน)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="from">
                ตั้งแต่
              </label>
              <input id="from" name="from" type="date" defaultValue={from} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="to">
                ถึง
              </label>
              <input id="to" name="to" type="date" defaultValue={to} className="input" />
            </div>
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>
          {employeeId && (
            <ExportButtons query={`kind=employee&employeeId=${employeeId}&from=${from}&to=${to}`} />
          )}
        </div>
      </div>

      {report && (
        <>
          <TotalsCards totals={report.totals} />
          <section className="card">
            <ReportTable rows={report.rows} editBase="/admin/records" />
          </section>
          {report.fieldRows.length > 0 && (
            <section className="card">
              <p className="mb-2 font-semibold text-slate-700">
                งานนอกสถานที่ในช่วงนี้ · ชั่วโมงงานพิเศษรวม {formatDuration(report.totals.fieldMinutes)}
              </p>
              <FieldReportTable rows={report.fieldRows} />
            </section>
          )}
        </>
      )}
    </main>
  );
}

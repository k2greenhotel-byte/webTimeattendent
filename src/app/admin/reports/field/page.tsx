import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import ExportButtons from "@/components/ExportButtons";
import FieldReportTable from "@/components/FieldReportTable";
import { requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
import { formatDuration, formatThaiDate, monthBounds, workDateOf } from "@/lib/datetime";
import { listBranches, listEmployees, listFieldTaskTypes } from "@/lib/db";
import { buildFieldReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function FieldReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    branch?: string;
    employeeId?: string;
    type?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const today = workDateOf();
  const bounds = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : bounds.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to! : bounds.to;
  const branchId = params.branch || undefined;
  const employeeId = params.employeeId || undefined;
  const typeId = params.type || undefined;

  const access = await requireMenuAccess("ATT_REP_FIELD", "read");
  const scope = await getCompanyScope(params.company);
  const [allBranches, allEmployees, types, report] = await Promise.all([
    listBranches(false, scope.companyId),
    listEmployees({ companyId: scope.companyId, branchId }),
    listFieldTaskTypes(scope.companyId),
    buildFieldReport({ from, to, companyId: scope.companyId, branchId, employeeId, typeId }),
  ]);
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const employees = access.branchIds
    ? allEmployees.filter((e) => e.branch_id !== null && access.branchIds!.has(e.branch_id))
    : allEmployees;

  const query = new URLSearchParams({ kind: "field", from, to });
  if (scope.companyId) query.set("company", scope.companyId);
  if (branchId) query.set("branch", branchId);
  if (employeeId) query.set("employeeId", employeeId);
  if (typeId) query.set("type", typeId);

  return (
    <>
    {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">รายงานงานนอกสถานที่</h1>
          <p className="text-sm text-slate-500">
            ออกบูธ ส่งรถ งานพิเศษ · {formatThaiDate(from)} – {formatThaiDate(to)} ·
            ชั่วโมงงานพิเศษรวม <strong>{formatDuration(report.totalMinutes)}</strong>
            {scope.companyName ? ` · ${scope.companyName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="no-print flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
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
            <BranchFilter branches={branches} value={branchId} />
            <div>
              <label className="label" htmlFor="employeeId">
                พนักงาน
              </label>
              <select id="employeeId" name="employeeId" defaultValue={employeeId ?? ""} className="input">
                <option value="">ทุกคน</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emp_code} · {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="type">
                ประเภท
              </label>
              <select id="type" name="type" defaultValue={typeId ?? ""} className="input">
                <option value="">ทุกประเภท</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>
          <ExportButtons query={query.toString()} />
        </div>
      </div>

      {report.perEmployee.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {report.perEmployee.map((p) => (
            <div key={p.employeeId} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="truncate text-xs text-slate-500">
                {p.empCode} · {p.fullName}
              </p>
              <p className="mt-1 text-lg font-semibold text-violet-700">{formatDuration(p.minutes)}</p>
              <p className="text-xs text-slate-500">{p.tasks} งาน</p>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <FieldReportTable rows={report.rows} showEmployee />
      </section>
    </main>
    </>
  );
}

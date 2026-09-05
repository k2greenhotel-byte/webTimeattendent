import AdvanceTable from "@/components/hr/AdvanceTable";
import HrReportFilters, { type HrReportParams } from "@/components/hr/HrReportFilters";
import PrintButton from "@/components/procurement/PrintButton";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees } from "@/lib/db";
import { buildAdvanceOverview, formatBaht } from "@/lib/leave";
import { listAdvanceRequests } from "@/lib/leave-db";
import { ADVANCE_STATUS_LABEL, ADVANCE_STATUS_ORDER, type AdvanceStatus } from "@/lib/leave-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ลิงก์ดาวน์โหลดที่พกเงื่อนไขค้นหาปัจจุบันไปด้วย */
function exportHref(params: HrReportParams, format: "xlsx" | "csv"): string {
  const sp = new URLSearchParams();
  sp.set("kind", "advance");
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "msg" && key !== "err") sp.set(key, value);
  }
  sp.set("format", format);
  return `/api/hr/export?${sp.toString()}`;
}

/** หน้าจอ 9 — สอบถามข้อมูลขอเบิกเงินเดือน แยกรายบริษัท/สาขา/พนักงาน พร้อมดาวน์โหลด Excel/CSV/พิมพ์เป็น PDF */
export default async function AdvanceSearchPage({
  searchParams,
}: {
  searchParams: Promise<HrReportParams>;
}) {
  await requirePermission("HR_SEARCH_ADV", "read");
  const params = await searchParams;

  const status = (ADVANCE_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as AdvanceStatus)
    : undefined;

  const [rows, companies, branches, employees] = await Promise.all([
    listAdvanceRequests({
      companyId: params.company || undefined,
      branchId: params.branch || undefined,
      employeeId: params.employee || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      statuses: status ? [status] : undefined,
      limit: 1000,
    }),
    listCompanies(true),
    listBranches(true, params.company || undefined),
    listEmployees({ companyId: params.company || undefined, branchId: params.branch || undefined }),
  ]);

  const overview = buildAdvanceOverview(rows);

  const cards = [
    { label: "จำนวนใบทั้งหมด", value: String(overview.total), tone: "text-slate-800" },
    { label: "รออนุมัติ", value: String(overview.byStatus.pending), tone: "text-amber-600" },
    { label: "อนุมัติแล้ว", value: String(overview.byStatus.approved), tone: "text-emerald-600" },
    { label: "อนุมัติบางส่วน", value: String(overview.byStatus.partial), tone: "text-teal-600" },
    { label: "ยอดที่ขอรวม", value: formatBaht(overview.totalRequested), tone: "text-slate-800" },
    { label: "ยอดที่อนุมัติรวม", value: formatBaht(overview.totalApproved), tone: "text-emerald-700" },
  ];

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">9. สอบถามข้อมูลขอเบิกเงินเดือน</h1>
          <p className="text-sm text-slate-500">
            เลือกบริษัท สาขา หรือพนักงานเพื่อกรองข้อมูล — เงื่อนไขที่กรองไว้จะติดไปกับไฟล์ที่ดาวน์โหลดด้วย
          </p>
        </div>
        <div className="no-print flex w-full flex-wrap gap-2 sm:w-auto">
          <a href={exportHref(params, "xlsx")} className="btn-primary w-full text-center sm:w-auto">
            ⬇ ดาวน์โหลด Excel
          </a>
          <a href={exportHref(params, "csv")} className="btn-secondary w-full text-center sm:w-auto">
            ⬇ CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <HrReportFilters
        basePath="/hr/search/advance"
        params={params}
        companies={companies}
        branches={branches}
        employees={employees}
        statusOptions={ADVANCE_STATUS_ORDER.map((s) => ({ value: s, label: ADVANCE_STATUS_LABEL[s] }))}
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <AdvanceTable rows={rows} emptyText="ไม่พบใบขอเบิกเงินที่ตรงกับเงื่อนไข" />
      </section>
    </main>
  );
}

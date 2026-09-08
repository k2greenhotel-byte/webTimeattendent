import Link from "next/link";
import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { summarizePeriod } from "@/lib/attendance";
import { readableMenuCodes, requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
import ExportButtons from "@/components/ExportButtons";
import ReportGroups, { GROUP_LABEL, parseGroupBy } from "@/components/ReportGroups";
import TotalsCards, { SUMMARY_FLAG_LABEL, type SummaryFlag } from "@/components/TotalsCards";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { buildDailyReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    branch?: string;
    company?: string;
    group?: string;
    flag?: string;
  }>;
}) {
  const params = await searchParams;
  const access = await requireMenuAccess("ATT_REP_DAILY", "read");
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : workDateOf();
  const branchId = params.branch || undefined;
  const groupBy = parseGroupBy(params.group);

  const scope = await getCompanyScope(params.company);
  const [allBranches, { rows: allRows, totals: allTotals, settings }, canEditRecords] = await Promise.all([
    listBranches(false, scope.companyId),
    buildDailyReport(date, branchId, scope.companyId),
    readableMenuCodes(["ATT_RECORDS"]),
  ]);

  // ผู้ที่เข้าด้วยสิทธิ์รายเมนู เห็นเฉพาะสาขาในขอบเขตของตัวเอง
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const scopedRows = access.branchIds
    ? allRows.filter((r) => r.branchId !== null && access.branchIds!.has(r.branchId))
    : allRows;
  const totals = access.branchIds ? summarizePeriod(scopedRows.map((r) => r.summary)) : allTotals;
  const currentBranch = branches.find((b) => b.id === branchId);

  // ---- คลิกกล่องสรุปเพื่อกรองเฉพาะกลุ่มที่สนใจ ----
  const FLAGS: Record<SummaryFlag, (r: (typeof scopedRows)[number]) => boolean> = {
    incomplete: (r) => r.summary.status === "incomplete",
    absent: (r) => r.summary.status === "absent",
    late: (r) => r.summary.lateMinutes > 0,
    overbreak: (r) => r.summary.overBreakMinutes > 0,
    leave: (r) => r.summary.status === "leave",
  };
  const flag = (params.flag && params.flag in FLAGS ? params.flag : null) as SummaryFlag | null;
  const rows = flag ? scopedRows.filter(FLAGS[flag]) : scopedRows;

  // ลิงก์ฐานของกล่องสรุป (query เดิมทั้งหมด ยกเว้น flag)
  const base = new URLSearchParams();
  if (scope.companyId) base.set("company", scope.companyId);
  base.set("date", date);
  if (branchId) base.set("branch", branchId);
  if (groupBy !== "none") base.set("group", groupBy);
  const filterBase = `/admin/reports/daily?${base.toString()}`;

  return (
    <>
    {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
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
          <form method="get" className="no-print flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
            <div>
              <label className="label" htmlFor="date">
                เลือกวันที่
              </label>
              <input id="date" name="date" type="date" defaultValue={date} className="input" />
            </div>
            <BranchFilter branches={branches} value={branchId} />
            <div>
              <label className="label" htmlFor="group">
                จัดกลุ่ม
              </label>
              <select id="group" name="group" defaultValue={groupBy} className="input">
                {(["none", "branch", "company"] as const).map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABEL[g]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              ดูข้อมูล
            </button>
          </form>
          <ExportButtons
            query={`kind=daily&date=${date}${branchId ? `&branch=${branchId}` : ""}`}
          />
        </div>
      </div>

      <TotalsCards totals={totals} filterBase={filterBase} activeFlag={flag} />

      {flag && (
        <p className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <span>
            กำลังดูเฉพาะ <strong>{SUMMARY_FLAG_LABEL[flag]}</strong> · {rows.length} รายการ
            {canEditRecords.has("ATT_RECORDS") ? " · คลิกชื่อพนักงานเพื่อแก้ไขเวลา" : ""}
          </span>
          <Link href={filterBase} className="btn-secondary">
            ล้างตัวกรอง
          </Link>
        </p>
      )}

      <ReportGroups
        rows={rows}
        groupBy={groupBy}
        editBase={canEditRecords.has("ATT_RECORDS") ? "/admin/records" : undefined}
      />
    </main>
    </>
  );
}

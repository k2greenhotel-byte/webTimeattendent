import AdvanceGroupTable from "@/components/hr/AdvanceGroupTable";
import HrReportFilters, { type HrReportParams } from "@/components/hr/HrReportFilters";
import LeaveGroupTable from "@/components/hr/LeaveGroupTable";
import TopList from "@/components/lead/TopList";
import { HorizontalBarChart, SERIES_COLORS } from "@/components/marketing/Charts";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches, listEmployees } from "@/lib/db";
import {
  buildAdvanceOverview,
  buildLeaveOverview,
  byBranchKey,
  byCompanyKey,
  byEmployeeKey,
  byLeaveTypeKey,
  formatBaht,
  summarizeAdvanceByKey,
  summarizeLeaveByKey,
  topN,
} from "@/lib/leave";
import { listAdvanceRequests, listLeaveRequests } from "@/lib/leave-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOP_LIMIT = 10;

/** หน้าจอ 10 — Dashboard สรุปข้อมูลการลาและขอเบิกเงินเดือน แยกตามบริษัท/สาขา พร้อมอันดับพนักงาน */
export default async function HrDashboardPage({
  searchParams,
}: {
  searchParams: Promise<HrReportParams>;
}) {
  await requirePermission("HR_DASHBOARD", "read");
  const params = await searchParams;
  const today = workDateOf();

  const filter = {
    companyId: params.company || undefined,
    branchId: params.branch || undefined,
    employeeId: params.employee || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };

  const [leaveRows, advanceRows, companies, branches, employees] = await Promise.all([
    listLeaveRequests({ ...filter, limit: 2000 }),
    listAdvanceRequests({ ...filter, limit: 2000 }),
    listCompanies(true),
    listBranches(true, params.company || undefined),
    listEmployees({ companyId: params.company || undefined, branchId: params.branch || undefined }),
  ]);

  const leaveOverview = buildLeaveOverview(leaveRows);
  const advanceOverview = buildAdvanceOverview(advanceRows);

  const leaveByCompany = summarizeLeaveByKey(leaveRows, byCompanyKey);
  const leaveByBranch = summarizeLeaveByKey(leaveRows, byBranchKey);
  const leaveByType = summarizeLeaveByKey(leaveRows, byLeaveTypeKey);
  const leaveByEmployee = summarizeLeaveByKey(leaveRows, byEmployeeKey);

  const advanceByCompany = summarizeAdvanceByKey(advanceRows, byCompanyKey);
  const advanceByBranch = summarizeAdvanceByKey(advanceRows, byBranchKey);
  const advanceByEmployee = summarizeAdvanceByKey(advanceRows, byEmployeeKey);

  const topAbsent = topN(
    leaveByEmployee.filter((g) => g.absentCount > 0),
    (g) => g.absentCount,
    TOP_LIMIT,
  ).map((g) => ({ label: g.label, count: g.absentCount }));

  const topLeaveDays = topN(
    leaveByEmployee.filter((g) => g.totalDays > 0),
    (g) => g.totalDays,
    TOP_LIMIT,
  ).map((g) => ({ label: g.label, count: g.totalDays }));

  const topAdvance = topN(
    advanceByEmployee.filter((g) => g.totalApproved > 0),
    (g) => g.totalApproved,
    TOP_LIMIT,
  ).map((g) => ({ label: g.label, count: g.totalApproved }));

  const leaveByTypeChart = leaveByType.map((g) => ({ label: g.label, values: { count: g.total } }));
  const advanceByBranchChart = advanceByBranch.map((g) => ({
    label: g.label,
    values: { requested: g.totalRequested, approved: g.totalApproved },
  }));

  const rangeText =
    params.from || params.to
      ? `${params.from ? formatThaiDate(params.from) : "เริ่มต้น"} - ${params.to ? formatThaiDate(params.to) : "ปัจจุบัน"}`
      : "ทุกช่วงเวลา";

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">10. Dashboard สรุปข้อมูลการลา/ขอเบิกเงินเดือน</h1>
        <p className="text-sm text-slate-500">
          {formatThaiDate(today)} · ช่วงข้อมูล: {rangeText}
        </p>
      </div>

      <HrReportFilters
        basePath="/hr/dashboard"
        params={params}
        companies={companies}
        branches={branches}
        employees={employees}
      />

      {/* ---------- ภาพรวมการลา ---------- */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">ภาพรวมการลา / หยุดงาน / เข้างานสาย</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <div className="card">
            <p className="text-xs text-slate-500">ใบทั้งหมด</p>
            <p className="text-2xl font-semibold text-slate-800">{leaveOverview.total}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">รออนุมัติ</p>
            <p className="text-2xl font-semibold text-amber-600">{leaveOverview.byStatus.pending}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">อนุมัติแล้ว</p>
            <p className="text-2xl font-semibold text-emerald-600">{leaveOverview.byStatus.approved}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">ไม่อนุมัติ</p>
            <p className="text-2xl font-semibold text-rose-600">{leaveOverview.byStatus.rejected}</p>
          </div>
          <div className="card bg-rose-50">
            <p className="text-xs text-rose-700">ถือเป็นขาดงาน</p>
            <p className="text-2xl font-semibold text-rose-800">{leaveOverview.absentCount}</p>
          </div>
          <div className="card bg-amber-50">
            <p className="text-xs text-amber-700">แจ้งช้า (โดนหักเงิน)</p>
            <p className="text-2xl font-semibold text-amber-800">{leaveOverview.lateCount}</p>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">จำนวนใบแจ้งลาแยกตามประเภท</h2>
        <HorizontalBarChart
          rows={leaveByTypeChart}
          series={[{ key: "count", label: "จำนวนใบ", color: SERIES_COLORS.request }]}
          valueFormat={(v) => `${v} ใบ`}
          unit="ใบ"
        />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">สรุปการลาตามบริษัท</h2>
        <LeaveGroupTable rows={leaveByCompany} labelHeader="บริษัท" emptyText="ยังไม่มีข้อมูลการลา" />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">สรุปการลาตามสาขา</h2>
        <LeaveGroupTable rows={leaveByBranch} labelHeader="สาขา" emptyText="ยังไม่มีข้อมูลการลา" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <TopList
          title={`${TOP_LIMIT} อันดับพนักงานที่ขาดงาน (แจ้งล่วงหน้าไม่ครบ) มากที่สุด`}
          rows={topAbsent}
          unit="ใบ"
          color="#e11d48"
          emptyText="ไม่มีพนักงานที่ถือว่าขาดงาน"
        />
        <TopList
          title={`${TOP_LIMIT} อันดับพนักงานที่ใช้วันลามากที่สุด`}
          rows={topLeaveDays}
          unit="วัน"
          color="#2f7de1"
          emptyText="ยังไม่มีข้อมูลการลา"
        />
      </section>

      {/* ---------- ภาพรวมขอเบิกเงินเดือน ---------- */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">ภาพรวมขอเบิกเงินเดือนล่วงหน้า</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <div className="card">
            <p className="text-xs text-slate-500">ใบทั้งหมด</p>
            <p className="text-2xl font-semibold text-slate-800">{advanceOverview.total}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">รออนุมัติ</p>
            <p className="text-2xl font-semibold text-amber-600">{advanceOverview.byStatus.pending}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">อนุมัติแล้ว</p>
            <p className="text-2xl font-semibold text-emerald-600">{advanceOverview.byStatus.approved}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">ยอดที่ขอรวม</p>
            <p className="text-xl font-semibold text-slate-800">{formatBaht(advanceOverview.totalRequested)}</p>
          </div>
          <div className="card bg-emerald-50">
            <p className="text-xs text-emerald-700">ยอดที่อนุมัติรวม</p>
            <p className="text-xl font-semibold text-emerald-800">{formatBaht(advanceOverview.totalApproved)}</p>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ยอดขอเบิก/อนุมัติแยกตามสาขา</h2>
        <HorizontalBarChart
          rows={advanceByBranchChart}
          series={[
            { key: "requested", label: "ยอดที่ขอ", color: SERIES_COLORS.request },
            { key: "approved", label: "ยอดที่อนุมัติ", color: SERIES_COLORS.approved },
          ]}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">สรุปขอเบิกเงินตามบริษัท</h2>
        <AdvanceGroupTable rows={advanceByCompany} labelHeader="บริษัท" emptyText="ยังไม่มีข้อมูลขอเบิกเงิน" />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">สรุปขอเบิกเงินตามสาขา</h2>
        <AdvanceGroupTable rows={advanceByBranch} labelHeader="สาขา" emptyText="ยังไม่มีข้อมูลขอเบิกเงิน" />
      </section>

      <TopList
        title={`${TOP_LIMIT} อันดับพนักงานที่ได้รับอนุมัติเบิกเงินมากที่สุด`}
        rows={topAdvance}
        unit="บาท"
        color="#0d9488"
        emptyText="ยังไม่มีข้อมูลขอเบิกเงิน"
      />
    </main>
  );
}

import { leadOptions, leadScope, scopedQuery } from "@/app/leads/scope";
import GroupSummaryTable from "@/components/lead/GroupSummaryTable";
import LeadFilters from "@/components/lead/LeadFilters";
import LeadTable from "@/components/lead/LeadTable";
import { workDateOf } from "@/lib/datetime";
import {
  buildOverview,
  isOverdue,
  queryFromParams,
  summarizeBySalesperson,
} from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";

export const dynamic = "force-dynamic";

/** สร้าง query string ของลิงก์ดาวน์โหลด ให้ตรงกับเงื่อนไขที่กรองอยู่ */
function exportHref(params: Record<string, string | undefined>, format: "xlsx" | "csv"): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "msg" && key !== "err") sp.set(key, value);
  }
  sp.set("format", format);
  return `/api/lead/export?${sp.toString()}`;
}

/** หน้าจอ 3 — สอบถามข้อมูล Lead พร้อมดาวน์โหลด Excel */
export default async function LeadSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = await leadScope("LEAD_SEARCH");
  const today = workDateOf();

  const query = scopedQuery(queryFromParams(params), scope);
  const [rowsAll, options] = await Promise.all([listLeads(query), leadOptions()]);

  const rows = query.overdue_only ? rowsAll.filter((r) => isOverdue(r, today)) : rowsAll;
  const overview = buildOverview(rows, today);
  const byStaff = summarizeBySalesperson(rows, today);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3. สอบถามข้อมูล Lead</h1>
          <p className="text-sm text-slate-500">
            เงื่อนไขที่กรองไว้จะติดไปกับไฟล์ที่ดาวน์โหลดด้วย
            {scope.canSeeAll ? "" : " · แสดงเฉพาะ Lead ของคุณ"}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a href={exportHref(params, "xlsx")} className="btn-primary w-full text-center sm:w-auto">
            ดาวน์โหลด Excel
          </a>
          <a href={exportHref(params, "csv")} className="btn-secondary w-full text-center sm:w-auto">
            CSV
          </a>
        </div>
      </div>

      <LeadFilters
        basePath="/leads/search"
        params={params}
        owners={options.owners}
        branches={options.branches}
        brands={options.brands}
        models={options.models}
        channels={options.channels}
        showOwner={scope.canSeeAll}
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="card">
          <p className="text-xs text-slate-500">Lead ที่พบ</p>
          <p className="text-lg font-semibold text-slate-800">{overview.total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยังต้องติดตาม</p>
          <p className="text-lg font-semibold text-sky-700">{overview.byStatus.follow_up}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ปิดการขายแล้ว</p>
          <p className="text-lg font-semibold text-emerald-700">{overview.closed}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">อัตราปิดการขาย</p>
          <p className="text-lg font-semibold text-emerald-700">{overview.closeRate}%</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">เลยนัดติดตาม</p>
          <p className="text-lg font-semibold text-rose-600">{overview.overdue}</p>
        </div>
      </section>

      {scope.canSeeAll && byStaff.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">สรุปตามพนักงานขาย</h2>
          <GroupSummaryTable
            rows={byStaff}
            labelHeader="พนักงานขาย"
            emptyText="ไม่พบข้อมูลตามเงื่อนไข"
          />
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ราย)</h2>
        <LeadTable rows={rows} today={today} emptyText="ไม่พบ Lead ที่ตรงกับเงื่อนไข" />
      </section>
    </main>
  );
}

import Link from "next/link";
import { leadOptions, leadScope, scopedQuery } from "@/app/leads/scope";
import LeadFilters from "@/components/lead/LeadFilters";
import LeadTable from "@/components/lead/LeadTable";
import { workDateOf } from "@/lib/datetime";
import { buildOverview, isOverdue, queryFromParams } from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 — รายการข้อมูล Lead ทั้งหมดที่ผู้ใช้คนนี้มีสิทธิ์เห็น */
export default async function LeadListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = await leadScope("LEAD_ENTRY");
  const today = workDateOf();

  const query = scopedQuery(queryFromParams(params), scope);
  const [rowsAll, options, canWrite] = await Promise.all([
    listLeads(query),
    leadOptions(),
    checkPermission("LEAD_ENTRY", "write"),
  ]);

  const rows = query.overdue_only ? rowsAll.filter((r) => isOverdue(r, today)) : rowsAll;
  const overview = buildOverview(rows, today);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1. บันทึกข้อมูล Lead</h1>
          <p className="text-sm text-slate-500">
            เลขที่ Lead ระบบรันให้อัตโนมัติ · ชื่อพนักงานขายดึงจากผู้ที่ล็อกอินอยู่
            {scope.canSeeAll ? "" : " · แสดงเฉพาะ Lead ของคุณ"}
          </p>
        </div>
        {canWrite && (
          <Link href="/leads/leads/new" className="btn-primary w-full text-center sm:w-auto">
            + บันทึก Lead ใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <LeadFilters
        basePath="/leads/leads"
        params={params}
        owners={options.owners}
        branches={options.branches}
        brands={options.brands}
        models={options.models}
        channels={options.channels}
        showOwner={scope.canSeeAll}
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">Lead ที่แสดงอยู่</p>
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
          <p className="text-xs text-slate-500">เลยนัดติดตาม</p>
          <p className="text-lg font-semibold text-rose-600">{overview.overdue}</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ราย)</h2>
        <LeadTable
          rows={rows}
          today={today}
          emptyText="ไม่พบ Lead ที่ตรงกับเงื่อนไข — ลองล้างเงื่อนไข หรือกด “บันทึก Lead ใหม่”"
        />
      </section>
    </main>
  );
}

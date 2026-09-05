import { leadOptions, leadScope, scopedQuery } from "@/app/leads/scope";
import LeadBoard from "@/components/lead/LeadBoard";
import LeadFilters from "@/components/lead/LeadFilters";
import { workDateOf } from "@/lib/datetime";
import { buildOverview, groupForBoard, isOverdue, queryFromParams } from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 2 — กระดานติดตามการขาย
 * แยกตามสถานะงาน → ซอยตามสถานะโอกาส (เขียว/เหลือง/แดง) แล้วคลิกเลือกใบที่จะบันทึกผล
 */
export default async function FollowBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = await leadScope("LEAD_FOLLOW");
  const today = workDateOf();

  const query = scopedQuery(queryFromParams(params), scope);
  const [rowsAll, options] = await Promise.all([listLeads(query), leadOptions()]);

  const rows = query.overdue_only ? rowsAll.filter((r) => isOverdue(r, today)) : rowsAll;
  const overview = buildOverview(rows, today);
  const columns = groupForBoard(rows, today);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">2. ติดตามการขาย</h1>
        <p className="text-sm text-slate-500">
          {scope.canSeeAll
            ? "เห็น Lead ของพนักงานขายทุกคน — เลือกพนักงานจากช่องกรองเพื่อดูรายคน"
            : "แสดงเฉพาะ Lead ของคุณ"}{" "}
          · คลิกที่ใบไหนก็บันทึกผลการโทรได้ทันที
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <LeadFilters
        basePath="/leads/follow"
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
          <p className="text-xs text-slate-500">เลยนัดติดตาม</p>
          <p className="text-lg font-semibold text-rose-600">{overview.overdue}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยังไม่ได้นัดวัน</p>
          <p className="text-lg font-semibold text-amber-600">{overview.noPlan}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">โอกาสสูงแต่เงียบนาน</p>
          <p className="text-lg font-semibold text-emerald-700">{overview.silentHot}</p>
        </div>
      </section>

      <LeadBoard columns={columns} today={today} showOwner={scope.canSeeAll} />
    </main>
  );
}

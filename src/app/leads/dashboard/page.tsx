import { leadOptions, leadScope, scopedQuery } from "@/app/leads/scope";
import GroupSummaryTable from "@/components/lead/GroupSummaryTable";
import LeadFilters from "@/components/lead/LeadFilters";
import LeadTable from "@/components/lead/LeadTable";
import TopList from "@/components/lead/TopList";
import { workDateOf } from "@/lib/datetime";
import {
  buildOverview,
  buildRankings,
  byFollowPriority,
  isOverdue,
  isSilentHotLead,
  queryFromParams,
  rankByCloseRate,
  summarizeByBranch,
  summarizeByChannel,
  summarizeBySalesperson,
} from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";
import { HOT_LEAD_SILENT_DAYS, WORK_STATUS_LABEL, WORK_STATUS_ORDER } from "@/lib/lead-types";

export const dynamic = "force-dynamic";

/** จำนวนรายการสูงสุดในรายการเฝ้าระวัง — มากกว่านี้ให้ไปดูที่หน้าสอบถาม */
const WATCH_LIMIT = 10;

/** หน้าจอ 4 — Dashboard งานขาย (ข้อ 3.1-3.4) */
export default async function LeadDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = await leadScope("LEAD_DASH");
  const today = workDateOf();

  const query = scopedQuery(queryFromParams(params), scope);
  const [rowsAll, options] = await Promise.all([listLeads(query), leadOptions()]);

  const rows = query.overdue_only ? rowsAll.filter((r) => isOverdue(r, today)) : rowsAll;

  const overview = buildOverview(rows, today);
  const rankings = buildRankings(rows);
  const byBranch = summarizeByBranch(rows, today);
  const byStaff = summarizeBySalesperson(rows, today);
  const byChannel = summarizeByChannel(rows, today);

  const overdueRows = rows.filter((r) => isOverdue(r, today)).sort(byFollowPriority(today));
  const silentHotRows = rows.filter((r) => isSilentHotLead(r, today)).sort(byFollowPriority(today));

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">4. Dashboard งานขาย</h1>
        <p className="text-sm text-slate-500">
          ตัวเลขทั้งหมดคิดจากเงื่อนไขที่กรองไว้ด้านล่าง
          {scope.canSeeAll ? "" : " · แสดงเฉพาะ Lead ของคุณ"}
        </p>
      </div>

      <LeadFilters
        basePath="/leads/dashboard"
        params={params}
        owners={options.owners}
        branches={options.branches}
        brands={options.brands}
        models={options.models}
        channels={options.channels}
        showOwner={scope.canSeeAll}
      />

      {/* ---------- ภาพรวม ---------- */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <div className="card">
          <p className="text-xs text-slate-500">Lead ทั้งหมด</p>
          <p className="text-2xl font-semibold text-slate-800">{overview.total}</p>
        </div>
        {WORK_STATUS_ORDER.map((s) => (
          <div key={s} className="card">
            <p className="text-xs text-slate-500">{WORK_STATUS_LABEL[s]}</p>
            <p className="text-2xl font-semibold text-slate-800">{overview.byStatus[s]}</p>
          </div>
        ))}
        <div className="card bg-emerald-50">
          <p className="text-xs text-emerald-700">อัตราการปิดการขาย</p>
          <p className="text-2xl font-semibold text-emerald-800">{overview.closeRate}%</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">เลยนัดติดตาม</p>
          <p className="text-lg font-semibold text-rose-600">{overview.overdue}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยังไม่ได้นัดวันติดตาม</p>
          <p className="text-lg font-semibold text-amber-600">{overview.noPlan}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ติดตามเฉลี่ยต่อราย</p>
          <p className="text-lg font-semibold text-slate-800">{overview.avgFollowPerLead} ครั้ง</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">วันเฉลี่ยจนปิดการขาย</p>
          <p className="text-lg font-semibold text-slate-800">
            {overview.avgDaysToClose > 0 ? `${overview.avgDaysToClose} วัน` : "—"}
          </p>
        </div>
      </section>

      {/* ---------- 3.1 ตามสาขา ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">3.1 สรุปตามสาขา</h2>
          <p className="text-[11px] text-slate-400">
            จำนวน Lead แยกตามสถานะงาน พร้อมอัตราการปิดการขายของแต่ละสาขา
          </p>
        </div>
        <GroupSummaryTable rows={byBranch} labelHeader="สาขา" emptyText="ยังไม่มีข้อมูล Lead" />
      </section>

      {/* ---------- 3.2 ตามพนักงานขาย ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">3.2 สรุปตามพนักงานขาย</h2>
          <p className="text-[11px] text-slate-400">
            เรียงจากผู้ที่มี Lead มากที่สุด — ดูควบคู่กับอัตราการปิดการขายด้านล่าง
          </p>
        </div>
        <GroupSummaryTable rows={byStaff} labelHeader="พนักงานขาย" emptyText="ยังไม่มีข้อมูล Lead" />
      </section>

      {/* ---------- 3.3 อัตราการปิดการขายรายคน ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">3.3 อัตราการปิดการขายของพนักงานขาย</h2>
          <p className="text-[11px] text-slate-400">
            เรียงจากอัตราการปิดสูงสุด — คนที่ Lead น้อยแต่ปิดได้สูง คือคนที่คัดลูกค้าเก่ง
          </p>
        </div>
        <GroupSummaryTable
          rows={rankByCloseRate(byStaff)}
          labelHeader="พนักงานขาย"
          emptyText="ยังไม่มีข้อมูล Lead"
        />
      </section>

      {/* ---------- อันดับ 10 อันดับแรก ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TopList
          title="10 อันดับรุ่นรถที่ลูกค้าสนใจ"
          hint="นับจาก Lead ทุกใบตามเงื่อนไขที่กรองไว้"
          rows={rankings.topModels}
          color="#2f7de1"
          emptyText="ยังไม่มีข้อมูล Lead"
        />
        <TopList
          title="10 อันดับพนักงานขายที่มี Lead มากสุด"
          rows={rankings.topStaff}
          color="#0d9488"
          emptyText="ยังไม่มีข้อมูล Lead"
        />
        <TopList
          title="ช่องทางที่ได้ Lead มากสุด"
          hint="ดูคู่กับตารางช่องทางด้านล่าง ว่าช่องทางไหนปิดการขายได้จริง"
          rows={rankings.topChannels}
          color="#7c3aed"
          emptyText="ยังไม่มีข้อมูล Lead"
        />
      </section>

      {/* ---------- 3.4 มุมผู้จัดการขาย ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">
            3.4 ประสิทธิผลของช่องทางการติดต่อ
          </h2>
          <p className="text-[11px] text-slate-400">
            ช่องทางที่ได้ Lead เยอะแต่ปิดการขายไม่ได้ = เสียเวลาทีมขาย ควรทบทวนงบและวิธีคัดกรอง
          </p>
        </div>
        <GroupSummaryTable
          rows={byChannel}
          labelHeader="ช่องทางการติดต่อ"
          emptyText="ยังไม่มีข้อมูล Lead"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-rose-700">
              ต้องเร่งตาม: เลยนัดติดตามแล้ว ({overdueRows.length} ราย)
            </h2>
            <p className="text-[11px] text-slate-400">
              เรียงจากที่เลยนัดนานที่สุด · แสดงไม่เกิน {WATCH_LIMIT} รายแรก
            </p>
          </div>
          <LeadTable
            rows={overdueRows.slice(0, WATCH_LIMIT)}
            today={today}
            emptyText="ไม่มีใบที่เลยนัดติดตาม — ทีมตามงานครบทุกใบ"
          />
        </div>

        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-amber-700">
              เฝ้าระวัง: โอกาสสูงแต่เงียบเกิน {HOT_LEAD_SILENT_DAYS} วัน ({silentHotRows.length} ราย)
            </h2>
            <p className="text-[11px] text-slate-400">
              ลูกค้าที่พร้อมซื้อที่สุดแต่ไม่มีใครติดต่อ — เสี่ยงเสียให้คู่แข่งมากที่สุด
            </p>
          </div>
          <LeadTable
            rows={silentHotRows.slice(0, WATCH_LIMIT)}
            today={today}
            emptyText="ลูกค้าโอกาสสูงถูกติดตามครบทุกราย"
          />
        </div>
      </section>
    </main>
  );
}

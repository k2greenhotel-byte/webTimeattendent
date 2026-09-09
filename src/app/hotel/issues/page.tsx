import HotelFilters, {
  issueQueryFromParams,
  type HotelParams,
} from "@/components/hotel/HotelFilters";
import IssueList from "@/components/hotel/IssueList";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { sortIssuesByUrgency, summarizeIssues } from "@/lib/hotel";
import { listGroups, listIssues } from "@/lib/hotel-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { saveIssueForm } from "../actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 2 — รายการที่ต้องแก้ไข
 * รวมข้อที่ตรวจแล้วไม่ปกติจากทุกใบ เรียงตามลำดับที่ควรลงมือ
 * แก้ความเร่งด่วน ผูกเลขที่ใบแจ้งซ่อม และปิดงานได้ในหน้าเดียว
 */
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<HotelParams>;
}) {
  await requirePermission("HTL_ISSUE", "read");
  const params = await searchParams;

  // ยังไม่ได้เลือกอะไรเลย = ดูของที่ยังค้างก่อน (คนเปิดหน้านี้มาเพื่อตามงาน)
  const query = issueQueryFromParams(params);
  if (params.fixed === undefined) query.fixed = false;

  const [issues, companies, branches, groups, canEdit] = await Promise.all([
    listIssues(query),
    listCompanies(true),
    listBranches(true),
    listGroups(true),
    checkPermission("HTL_ISSUE", "edit"),
  ]);

  const today = workDateOf();
  const summary = summarizeIssues(issues, today);
  const sorted = sortIssuesByUrgency(issues, today);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">2. รายการที่ต้องแก้ไข</h1>
        <p className="text-sm text-slate-500">
          ข้อมูล ณ {formatThaiDate(today)} — เรียงลำดับที่ควรลงมือก่อน: เลยกำหนด → เร่งด่วนกว่า →
          พบมานานกว่า
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="ในเงื่อนไขนี้" value={summary.total} sub="ข้อที่ผลไม่ปกติ" />
        <Stat label="ยังไม่ได้แก้" value={summary.open} sub="ต้องตามต่อ" tone="text-amber-600" />
        <Stat
          label="เลยกำหนดแก้ไข"
          value={summary.overdue}
          sub="เกินกำหนดตามความเร่งด่วน"
          tone="text-rose-600"
        />
        <Stat
          label="เร่งด่วนทันที"
          value={summary.urgent}
          sub="ต้องแก้วันนี้"
          tone="text-rose-600"
        />
        <Stat
          label="ยังไม่เปิดใบซ่อม"
          value={summary.noRepairDoc}
          sub="ข้อค้างที่ยังไม่มีเลขที่ใบซ่อม"
          tone="text-sky-600"
        />
      </div>

      <HotelFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/hotel/issues?fixed=0"
        mode="issue"
        groupNames={groups.map((g) => g.name)}
      />

      <IssueList
        issues={sorted}
        today={today}
        canEdit={canEdit}
        action={saveIssueForm}
        empty="ไม่มีข้อที่ต้องแก้ไขตามเงื่อนไขนี้ — ทุกอย่างปกติดี"
      />
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-slate-800",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

import ClaimFilters, { queryFromParams, type ClaimParams } from "@/components/claim/ClaimFilters";
import ClaimTable from "@/components/claim/ClaimTable";
import { formatBaht, summarizeClaims } from "@/lib/claim";
import { listClaims } from "@/lib/claim-db";
import { CLAIM_JOB_STATUS_LABEL, CLAIM_JOB_STATUS_ORDER } from "@/lib/claim-types";
import { listCompanies } from "@/lib/core-db";
import { workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 2 — สอบถามงานขอเคลม
 * ค้นได้ตามความเร่งด่วน บริษัท สาขา สถานะงาน สถานะเอกสาร ช่วงวันที่ และคำค้นอิสระ
 */
export default async function ClaimSearchPage({
  searchParams,
}: {
  searchParams: Promise<ClaimParams>;
}) {
  await requirePermission("CLM_SEARCH", "read");
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches] = await Promise.all([
    listClaims(query),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const summary = summarizeClaims(rows, today);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">2. สอบถามงานขอเคลม</h1>
        <p className="text-sm text-slate-500">
          กรองตามความเร่งด่วน บริษัท สาขา และสถานะต่าง ๆ · กดที่เลขที่ใบเพื่อเปิดรายละเอียด
        </p>
      </div>

      <ClaimFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/claim/search"
      />

      {/* ---------- สรุปผลการค้นหา ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="card">
          <p className="text-xs text-slate-500">ใบขอเคลมที่พบ</p>
          <p className="text-xl font-bold text-slate-800">{summary.total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">งานที่ยังไม่จบ</p>
          <p className="text-xl font-bold text-slate-800">{summary.open}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">เลยกำหนด</p>
          <p className="text-xl font-bold text-rose-600">{summary.overdue}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">รอผลจากผู้ผลิต</p>
          <p className="text-xl font-bold text-slate-800">{summary.waitingMaker}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ซ่อมเสร็จรอส่งมอบ</p>
          <p className="text-xl font-bold text-amber-600">{summary.waitingDelivery}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">job ที่ยังไม่ปิด</p>
          <p className="text-xl font-bold text-sky-600">{summary.openJobs}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยอดที่ขออนุมัติรวม</p>
          <p className="text-lg font-bold text-slate-800">{formatBaht(summary.requested)}</p>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">แยกตามสถานะงาน</h2>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3">
          {CLAIM_JOB_STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{CLAIM_JOB_STATUS_LABEL[status]}</span>
              <span className="font-semibold text-slate-800">{summary.byJobStatus[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <ClaimTable
          rows={rows}
          today={today}
          emptyText="ไม่พบใบขอเคลมที่ตรงกับเงื่อนไข"
          actionLabel="เปิดใบ"
        />
      </section>
    </main>
  );
}

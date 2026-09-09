import InspectionFilters, {
  queryFromParams,
  type InspectionParams,
} from "@/components/inspection/InspectionFilters";
import InspectionTable from "@/components/inspection/InspectionTable";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { avgPctByKey, formatBaht, summarizeInspections } from "@/lib/inspection";
import { listInspections, listTemplates } from "@/lib/inspection-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 2 — สอบถามผลการตรวจย้อนหลัง */
export default async function InspectionSearchPage({
  searchParams,
}: {
  searchParams: Promise<InspectionParams>;
}) {
  await requirePermission("INSP_SEARCH", "read");
  const params = await searchParams;

  const [rows, companies, branches, templates] = await Promise.all([
    listInspections(queryFromParams(params)),
    listCompanies(true),
    listBranches(true),
    listTemplates(),
  ]);

  const summary = summarizeInspections(rows);
  const byBranch = avgPctByKey(rows, (r) => r.branch_name, "— ไม่ระบุสาขา —");

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">2. สอบถามผลการตรวจ</h1>
        <p className="text-sm text-slate-500">
          ค้นย้อนหลังตามบริษัท สาขา ช่วงวันที่ และแบบฟอร์ม — กดเลขที่ใบเพื่อดูผลรายข้อพร้อมรูป
        </p>
      </div>

      <InspectionFilters
        params={params}
        companies={companies}
        branches={branches}
        templates={templates}
        resetHref="/inspection/search"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ใบตรวจที่พบ" value={String(summary.count)} sub={`ส่งผลแล้ว ${summary.submitted}`} />
        <Stat label="คะแนนเฉลี่ย" value={`${summary.avgPct.toFixed(1)}%`} sub="เฉพาะใบที่ส่งผลแล้ว" />
        <Stat
          label="ค่าปรับรวม"
          value={formatBaht(summary.totalFine)}
          sub="บาท"
          tone="text-rose-600"
        />
        <Stat
          label="เงินรางวัลรวม"
          value={formatBaht(summary.totalBonus)}
          sub="บาท"
          tone="text-emerald-600"
        />
      </div>

      {byBranch.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">คะแนนเฉลี่ยรายสาขา (ต่ำสุดขึ้นก่อน)</h2>
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th className="w-28 text-right">ตรวจ (ครั้ง)</th>
                  <th className="w-32 text-right">คะแนนเฉลี่ย</th>
                  <th className="w-32 text-right">ค่าปรับรวม</th>
                </tr>
              </thead>
              <tbody>
                {byBranch.map((b) => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td className="text-right tabular-nums">{b.count}</td>
                    <td className="text-right tabular-nums">{b.avgPct.toFixed(1)}%</td>
                    <td className="text-right tabular-nums text-rose-600">
                      {b.fine > 0 ? formatBaht(b.fine) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="card">
        <InspectionTable rows={rows} />
      </div>
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
  value: string;
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

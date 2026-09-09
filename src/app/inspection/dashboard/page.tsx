import InspectionFilters, {
  queryFromParams,
  type InspectionParams,
} from "@/components/inspection/InspectionFilters";
import InspectionTable from "@/components/inspection/InspectionTable";
import { HorizontalBarChart } from "@/components/marketing/Charts";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import {
  avgPctByKey,
  countByKey,
  daysSince,
  formatBaht,
  latestByBranch,
  summarizeInspections,
} from "@/lib/inspection";
import { listFailedItems, listInspections, listTemplates } from "@/lib/inspection-db";
import { INSP_STATUS_LABEL, INSP_STATUS_ORDER } from "@/lib/inspection-types";
import { INSP_STALE_DAYS } from "@/lib/wall-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const PCT_SERIES = [{ key: "pct", label: "คะแนนเฉลี่ย (%)", color: "#2f7de1" }];
const COUNT_SERIES = [{ key: "count", label: "จำนวนครั้ง", color: "#e26a4b" }];

/**
 * หน้าจอ 3 — Dashboard ติดตามผลการตรวจสาขา
 * ตอบ 3 คำถาม: สาขาไหนต้องแก้ก่อน · สาขาไหนหลุดคิวตรวจ · ข้อไหนที่ทุกสาขาตกซ้ำ
 */
export default async function InspectionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<InspectionParams>;
}) {
  await requirePermission("INSP_DASH", "read");
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches, templates, failedItems] = await Promise.all([
    listInspections(query),
    listCompanies(true),
    listBranches(true),
    listTemplates(),
    listFailedItems({ from: query.from, to: query.to, branchId: query.branch_id }),
  ]);

  const today = workDateOf();
  const summary = summarizeInspections(rows);
  const latest = latestByBranch(rows);

  const inspectedIds = new Set(latest.map((r) => r.branch_id).filter(Boolean) as string[]);
  const neverInspected = branches.filter((b) => !inspectedIds.has(b.id));
  const stale = latest.filter((r) => daysSince(r.inspect_date, today) >= INSP_STALE_DAYS);

  const byBranch = avgPctByKey(rows, (r) => r.branch_name, "— ไม่ระบุสาขา —");
  const byTemplate = avgPctByKey(rows, (r) => r.template_name, "— ไม่ระบุแบบฟอร์ม —");
  const byInspector = countByKey(rows, (r) => r.inspector_name, "— ไม่ระบุผู้ตรวจ —").slice(0, 10);
  const byStatus = INSP_STATUS_ORDER.map((s) => ({
    label: INSP_STATUS_LABEL[s],
    count: rows.filter((r) => r.status === s).length,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">3. Dashboard ตรวจสาขา</h1>
        <p className="text-sm text-slate-500">
          ข้อมูล ณ {formatThaiDate(today)} — กรองช่วงวันที่และสาขาได้ที่แถบด้านล่าง
        </p>
      </div>

      <InspectionFilters
        params={params}
        companies={companies}
        branches={branches}
        templates={templates}
        resetHref="/inspection/dashboard"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="ใบตรวจทั้งหมด" value={String(summary.count)} sub={`ส่งผลแล้ว ${summary.submitted}`} />
        <Stat label="คะแนนเฉลี่ย" value={`${summary.avgPct.toFixed(1)}%`} sub="เฉพาะใบที่ส่งผลแล้ว" />
        <Stat
          label="สาขาต้องปรับปรุง"
          value={String(summary.failed)}
          sub="คะแนนต่ำกว่า 75%"
          tone="text-rose-600"
        />
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

      {/* ---------- สาขาที่ต้องเข้าไปแก้ก่อน ---------- */}
      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">
          ผลตรวจล่าสุดของแต่ละสาขา{" "}
          <span className="text-sm font-normal text-slate-400">(คะแนนต่ำสุดขึ้นก่อน)</span>
        </h2>
        <InspectionTable rows={latest} empty="ยังไม่มีสาขาไหนที่ส่งผลการตรวจ" />
      </section>

      {/* ---------- สาขาที่หลุดคิวตรวจ ---------- */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">
            สาขาที่ยังไม่เคยตรวจ{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {neverInspected.length}
            </span>
          </h2>
          {neverInspected.length === 0 ? (
            <p className="py-3 text-sm text-emerald-600">ตรวจครบทุกสาขาแล้ว</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {neverInspected.map((b) => (
                <li key={b.id} className="py-2 text-slate-700">
                  {b.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">
            ไม่ได้ตรวจเกิน {INSP_STALE_DAYS} วัน{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {stale.length}
            </span>
          </h2>
          {stale.length === 0 ? (
            <p className="py-3 text-sm text-emerald-600">ทุกสาขาตรวจตามรอบ</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {stale.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-700">{r.branch_name}</span>
                  <span className="shrink-0 text-xs text-amber-700">
                    ตรวจล่าสุด {formatThaiDate(r.inspect_date)} ({daysSince(r.inspect_date, today)}{" "}
                    วัน)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- กราฟ ---------- */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">คะแนนเฉลี่ยรายสาขา (%)</h2>
          <HorizontalBarChart
            rows={byBranch.slice(0, 15).map((b) => ({ label: b.label, values: { pct: b.avgPct } }))}
            series={PCT_SERIES}
            valueFormat={(v) => `${v.toFixed(0)}%`}
            unit="%"
          />
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">
            ข้อที่ตกบ่อยที่สุด{" "}
            <span className="text-sm font-normal text-slate-400">(ควรอบรม/แก้กระบวนการก่อน)</span>
          </h2>
          <HorizontalBarChart
            rows={failedItems.slice(0, 12).map((i) => ({ label: i.label, values: { count: i.count } }))}
            series={COUNT_SERIES}
            valueFormat={(v) => v.toLocaleString("th-TH")}
            unit="ครั้ง"
          />
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">คะแนนเฉลี่ยแยกตามแบบฟอร์ม (%)</h2>
          <HorizontalBarChart
            rows={byTemplate.map((t) => ({ label: t.label, values: { pct: t.avgPct } }))}
            series={PCT_SERIES}
            valueFormat={(v) => `${v.toFixed(0)}%`}
            unit="%"
          />
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-slate-800">จำนวนครั้งที่ตรวจ แยกตามผู้ตรวจ</h2>
          <HorizontalBarChart
            rows={byInspector.map((i) => ({ label: i.label, values: { count: i.count } }))}
            series={COUNT_SERIES}
            valueFormat={(v) => v.toLocaleString("th-TH")}
            unit="ครั้ง"
          />
        </section>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">สถานะเอกสาร</h2>
        <div className="grid grid-cols-3 gap-3">
          {byStatus.map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold tabular-nums text-slate-800">{s.count}</p>
            </div>
          ))}
        </div>
      </section>
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

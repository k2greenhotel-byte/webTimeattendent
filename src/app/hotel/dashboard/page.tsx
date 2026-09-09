import Link from "next/link";
import HotelFilters, {
  roundQueryFromParams,
  type HotelParams,
} from "@/components/hotel/HotelFilters";
import RoundTable from "@/components/hotel/RoundTable";
import { HorizontalBarChart } from "@/components/marketing/Charts";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import {
  countByKey,
  isOverdue,
  latestByBranch,
  summarizeByPeriod,
  summarizeIssues,
  summarizeRounds,
} from "@/lib/hotel";
import { listIssues, listRounds } from "@/lib/hotel-db";
import {
  HTL_PERIOD_MODE_LABEL,
  HTL_PERIOD_MODE_ORDER,
  HTL_PRIORITY_LABEL,
  HTL_PRIORITY_ORDER,
  type HtlPeriodMode,
} from "@/lib/hotel-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const PCT_SERIES = [{ key: "pct", label: "ผลปกติ (%)", color: "#2f9e6e" }];
const COUNT_SERIES = [{ key: "count", label: "จำนวนข้อ", color: "#e2564b" }];

const intFormat = (value: number) => value.toLocaleString("th-TH");

/**
 * หน้าจอ 4 — Dashboard ตรวจเช็คโรงแรม
 * ตอบ 3 คำถาม: แนวโน้มดีขึ้นหรือแย่ลง · ปัญหากระจุกที่ประเภทงาน/สาขาไหน · อะไรค้างอยู่ตอนนี้
 * สลับสรุปรายวัน/รายสัปดาห์/รายเดือนได้ที่ปุ่มด้านบนของกราฟแนวโน้ม
 */
export default async function HotelDashboardPage({
  searchParams,
}: {
  searchParams: Promise<HotelParams>;
}) {
  await requirePermission("HTL_DASH", "read");
  const params = await searchParams;
  const query = roundQueryFromParams(params);

  const rawMode = params.mode ?? "";
  const mode: HtlPeriodMode = (HTL_PERIOD_MODE_ORDER as string[]).includes(rawMode)
    ? (rawMode as HtlPeriodMode)
    : "day";

  const [rounds, issues, companies, branches] = await Promise.all([
    listRounds(query),
    listIssues({
      company_id: query.company_id,
      branch_id: query.branch_id,
      from: query.from,
      to: query.to,
    }),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const summary = summarizeRounds(rounds);
  const issueSummary = summarizeIssues(issues, today);
  const periodRows = summarizeByPeriod(rounds, mode);
  const latest = latestByBranch(rounds);

  const openIssues = issues.filter((i) => !i.is_fixed);

  const trendChart = periodRows.map((r) => ({ label: r.label, values: { pct: r.passPct } }));
  const failByGroup = countByKey(issues, (i) => i.group_name, "— ไม่ระบุประเภทงาน —")
    .slice(0, 10)
    .map((g) => ({ label: g.label, values: { count: g.count } }));
  const failByItem = countByKey(issues, (i) => i.item_name, "— ไม่ระบุรายการ —")
    .slice(0, 10)
    .map((i) => ({ label: i.label, values: { count: i.count } }));
  const failByBranch = countByKey(openIssues, (i) => i.branch_name, "— ไม่ระบุสาขา —")
    .slice(0, 10)
    .map((b) => ({ label: b.label, values: { count: b.count } }));

  /** ลิงก์สลับโหมดสรุป โดยคงเงื่อนไขค้นหาเดิมไว้ */
  function modeHref(next: HtlPeriodMode): string {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "mode") q.set(key, value);
    }
    q.set("mode", next);
    return `/hotel/dashboard?${q}`;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">4. Dashboard ตรวจเช็คโรงแรม</h1>
        <p className="text-sm text-slate-500">
          ข้อมูล ณ {formatThaiDate(today)} — กรองช่วงวันที่และสาขาได้ที่แถบด้านล่าง
        </p>
      </div>

      <HotelFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/hotel/dashboard"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="ใบตรวจเช็ค"
          value={String(summary.rounds)}
          sub={`ส่งผลแล้ว ${summary.submitted} · ฉบับร่าง ${summary.draft}`}
        />
        <Stat
          label="ผลปกติเฉลี่ย"
          value={`${summary.avgPassPct.toFixed(1)}%`}
          sub="เฉพาะใบที่ส่งผลแล้ว"
          tone="text-emerald-600"
        />
        <Stat
          label="ข้อไม่ปกติ"
          value={String(summary.failCount)}
          sub={`เร่งด่วนทันที ${summary.urgentCount} ข้อ`}
          tone="text-rose-600"
        />
        <Stat
          label="ค้างแก้ไข"
          value={String(issueSummary.open)}
          sub={`เลยกำหนด ${issueSummary.overdue} ข้อ`}
          tone="text-amber-600"
        />
        <Stat
          label="แก้ไขแล้ว"
          value={String(issueSummary.fixed)}
          sub="ในช่วงที่เลือก"
          tone="text-sky-600"
        />
      </div>

      {/* ---------- แนวโน้ม รายวัน / รายสัปดาห์ / รายเดือน ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">แนวโน้มผลปกติ</h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {HTL_PERIOD_MODE_ORDER.map((m) => (
              <Link
                key={m}
                href={modeHref(m)}
                className={`rounded-md px-3 py-1 text-sm ${
                  m === mode ? "bg-white font-medium text-brand-700 shadow-sm" : "text-slate-600"
                }`}
              >
                {HTL_PERIOD_MODE_LABEL[m]}
              </Link>
            ))}
          </div>
        </div>

        <HorizontalBarChart
          rows={trendChart}
          series={PCT_SERIES}
          valueFormat={(v) => `${Math.round(v)}%`}
          unit="%"
        />

        <div className="overflow-x-auto">
          <table className="table-report">
            <thead>
              <tr>
                <th>ช่วง{HTL_PERIOD_MODE_LABEL[mode].replace("ราย", "")}</th>
                <th className="w-28 text-right">ใบตรวจ</th>
                <th className="w-28 text-right">ปกติ</th>
                <th className="w-28 text-right">ไม่ปกติ</th>
                <th className="w-32 text-right">เร่งด่วนทันที</th>
                <th className="w-28 text-right">ค้างแก้ไข</th>
                <th className="w-24 text-right">% ปกติ</th>
              </tr>
            </thead>
            <tbody>
              {periodRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    ยังไม่มีใบที่ส่งผลแล้วในช่วงนี้
                  </td>
                </tr>
              ) : (
                periodRows
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td className="text-right tabular-nums">{r.rounds}</td>
                      <td className="text-right tabular-nums text-emerald-600">{r.passCount}</td>
                      <td className="text-right tabular-nums text-rose-600">{r.failCount}</td>
                      <td className="text-right tabular-nums text-rose-600">{r.urgentCount}</td>
                      <td className="text-right tabular-nums text-amber-600">{r.openFixCount}</td>
                      <td className="text-right tabular-nums font-medium">
                        {r.passPct.toFixed(0)}%
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- สถานะตามประเภทงาน ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ข้อไม่ปกติแยกตามประเภทงาน</h2>
          <p className="text-xs text-slate-500">บอกว่าปัญหากระจุกที่ระบบไหน ควรแก้ที่ต้นเหตุก่อน</p>
          <HorizontalBarChart
            rows={failByGroup}
            series={COUNT_SERIES}
            valueFormat={intFormat}
            unit="ข้อ"
          />
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">รายการที่พบปัญหาบ่อยที่สุด</h2>
          <p className="text-xs text-slate-500">รายการที่ตกซ้ำ ควรวางแผนซ่อมใหญ่หรือเปลี่ยนอุปกรณ์</p>
          <HorizontalBarChart
            rows={failByItem}
            series={COUNT_SERIES}
            valueFormat={intFormat}
            unit="ข้อ"
          />
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ข้อค้างแก้ไขแยกตามสาขา</h2>
          <p className="text-xs text-slate-500">สาขาที่ต้องเข้าไปดูแลก่อน</p>
          <HorizontalBarChart
            rows={failByBranch}
            series={COUNT_SERIES}
            valueFormat={intFormat}
            unit="ข้อ"
          />
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ข้อค้างแยกตามความเร่งด่วน</h2>
          <div className="space-y-2 pt-1">
            {HTL_PRIORITY_ORDER.map((p) => {
              const rows = openIssues.filter((i) => (i.priority ?? "soon") === p);
              const overdue = rows.filter((i) => isOverdue(i, today)).length;
              return (
                <div
                  key={p}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{HTL_PRIORITY_LABEL[p]}</p>
                    {overdue > 0 && (
                      <p className="text-xs text-rose-600">เลยกำหนดแล้ว {overdue} ข้อ</p>
                    )}
                  </div>
                  <p className="text-lg font-bold tabular-nums text-slate-800">{rows.length}</p>
                </div>
              );
            })}
          </div>
          <Link href="/hotel/issues?fixed=0" className="btn-secondary mt-2 inline-block">
            เปิดรายการที่ต้องแก้ไข →
          </Link>
        </section>
      </div>

      {/* ---------- ผลตรวจล่าสุดของแต่ละสาขา ---------- */}
      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">ผลตรวจล่าสุดของแต่ละสาขา</h2>
        <p className="text-xs text-slate-500">สาขาที่ผลปกติน้อยที่สุดขึ้นก่อน</p>
        <RoundTable rows={latest} empty="ยังไม่มีใบที่ส่งผลแล้วในเงื่อนไขนี้" />
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

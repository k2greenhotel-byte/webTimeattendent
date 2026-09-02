import Link from "next/link";
import {
  GroupedBarChart,
  HorizontalBarChart,
  Legend,
  SERIES_COLORS,
  type Series,
} from "@/components/marketing/Charts";
import { thaiMonthShort } from "@/lib/datetime";
import { countByFlowStatus, formatBaht, groupTotals, monthKeyOf, summarize } from "@/lib/marketing";
import { listActivities, listMaster } from "@/lib/marketing-db";
import { FLOW_STATUS_LABEL, type MktFlowStatus } from "@/lib/marketing-types";

export const dynamic = "force-dynamic";

const MONEY_SERIES: Series[] = [
  { key: "request", label: "ขอเบิก", color: SERIES_COLORS.request },
  { key: "approved", label: "อนุมัติเบิก", color: SERIES_COLORS.approved },
  { key: "received", label: "ได้รับโอน", color: SERIES_COLORS.received },
];

/** "2569-08" → "ส.ค. 69" */
function monthLabel(key: string): string {
  const [be, mm] = key.split("-");
  return `${thaiMonthShort(Number(mm))} ${be.slice(2)}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; company_id?: string }>;
}) {
  const params = await searchParams;

  const [rows, companies] = await Promise.all([
    listActivities({
      from: params.from || undefined,
      to: params.to || undefined,
      company_id: params.company_id || undefined,
    }),
    listMaster("company", { includeInactive: true }),
  ]);

  const totals = summarize(rows);
  const byStatus = countByFlowStatus(rows);

  const byMonth = groupTotals(rows, (r) => {
    const key = monthKeyOf(r.activity_date);
    return { key, label: monthLabel(key) };
  })
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-12);

  const byCompany = groupTotals(rows, (r) => ({
    key: r.company_id ?? "-",
    label: r.company_name ?? "ไม่ระบุบริษัท",
  })).slice(0, 10);

  const byType = groupTotals(rows, (r) => ({
    key: r.activity_type_id ?? "-",
    label: r.activity_type_name ?? "ไม่ระบุประเภท",
  })).slice(0, 10);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">6. Dashboard สรุปภาพรวม</h1>
        <p className="text-sm text-slate-500">
          สรุปจากใบกิจกรรมที่ใช้งานอยู่ {totals.count} รายการ (ใบที่ยกเลิกไม่ถูกนำมารวมยอด)
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">ตั้งแต่วันที่</label>
          <input type="date" name="from" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input type="date" name="to" defaultValue={params.to ?? ""} className="input" />
        </div>
        <div className="min-w-56">
          <label className="label">บริษัทที่ขอเบิก</label>
          <select name="company_id" defaultValue={params.company_id ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
        <Link href="/marketing/dashboard" className="btn-secondary">
          ล้าง
        </Link>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ยอดขอเบิก" value={formatBaht(totals.request)} color={SERIES_COLORS.request} />
        <Stat label="ยอดอนุมัติเบิก" value={formatBaht(totals.approved)} color={SERIES_COLORS.approved} />
        <Stat label="ได้รับโอนแล้ว" value={formatBaht(totals.received)} color={SERIES_COLORS.received} />
        <Stat label="ยอดคงค้าง" value={formatBaht(totals.outstanding)} color="#64748b" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(FLOW_STATUS_LABEL) as MktFlowStatus[]).map((s) => (
          <Link key={s} href={`/marketing/search?flow_status=${s}`} className="card hover:border-brand-300">
            <p className="text-sm text-slate-500">{FLOW_STATUS_LABEL[s]}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{byStatus[s]} ใบ</p>
          </Link>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold text-slate-800">ยอดเงินรายเดือน (12 เดือนล่าสุด)</h2>
        <Legend series={MONEY_SERIES} />
        <GroupedBarChart
          groups={byMonth.map((g) => ({
            label: g.label,
            values: { request: g.request, approved: g.approved, received: g.received },
          }))}
          series={MONEY_SERIES}
        />
        {byMonth.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เดือน</th>
                  <th>จำนวนใบ</th>
                  <th>ขอเบิก</th>
                  <th>อนุมัติ</th>
                  <th>ได้รับ</th>
                  <th>คงค้าง</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((g) => (
                  <tr key={g.key}>
                    <td>{g.label}</td>
                    <td>{g.count}</td>
                    <td className="!text-right">{formatBaht(g.request)}</td>
                    <td className="!text-right">{formatBaht(g.approved)}</td>
                    <td className="!text-right">{formatBaht(g.received)}</td>
                    <td className="!text-right">{formatBaht(g.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-1 font-semibold text-slate-800">ยอดตามบริษัทที่ขอเบิก</h2>
          <p className="mb-2 text-xs text-slate-500">เรียงตามยอดขอเบิกมากที่สุด 10 อันดับแรก</p>
          <Legend series={MONEY_SERIES} />
          <HorizontalBarChart
            rows={byCompany.map((g) => ({
              label: g.label,
              values: { request: g.request, approved: g.approved, received: g.received },
            }))}
            series={MONEY_SERIES}
          />
        </section>

        <section className="card">
          <h2 className="mb-1 font-semibold text-slate-800">ยอดตามประเภทกิจกรรม</h2>
          <p className="mb-2 text-xs text-slate-500">เรียงตามยอดขอเบิกมากที่สุด 10 อันดับแรก</p>
          <Legend series={MONEY_SERIES} />
          <HorizontalBarChart
            rows={byType.map((g) => ({
              label: g.label,
              values: { request: g.request, approved: g.approved, received: g.received },
            }))}
            series={MONEY_SERIES}
          />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">บาท</p>
    </div>
  );
}

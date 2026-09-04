import Link from "next/link";
import BookingCalendar from "@/components/booking/BookingCalendar";
import BookingFilters from "@/components/booking/BookingFilters";
import OverviewPanel from "@/components/booking/OverviewPanel";
import RankingPanel from "@/components/booking/RankingPanel";
import StaffSummaryTable from "@/components/booking/StaffSummaryTable";
import { GroupedBarChart, HorizontalBarChart } from "@/components/marketing/Charts";
import {
  buildOverview,
  buildRankings,
  countByBrandModel,
  countByKey,
  formatBaht,
  monthlyTrend,
  queryFromParams,
  shiftMonth,
  staffNameOf,
  summarize,
  summarizeByStaff,
} from "@/lib/booking";
import { listBookings, listBookingStaffNames } from "@/lib/booking-db";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
  DOC_STATUS_LABEL,
  DOC_STATUS_ORDER,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
} from "@/lib/booking-types";
import { formatThaiMonth, monthBounds, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { listMaster } from "@/lib/moto-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const COUNT_SERIES = [{ key: "count", label: "จำนวนใบจอง", color: "#2f7de1" }];
const TREND_SERIES = [
  { key: "total", label: "ใบจอง", color: "#2f7de1" },
  { key: "sold", label: "ปิดการขายได้", color: "#0d9488" },
];
const countFormat = (v: number) => v.toLocaleString("th-TH");

/** ลิงก์เดือนก่อนหน้า/ถัดไป โดยคงเงื่อนไขค้นหาเดิมไว้ */
function monthHref(params: Record<string, string | undefined>, year: number, month: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "year" && key !== "month") next.set(key, value);
  }
  next.set("year", String(year));
  next.set("month", String(month));
  return `/booking/dashboard?${next.toString()}`;
}

/**
 * หน้าจอ 1.4 — Dashboard ใบจอง
 *
 * แบ่งเป็น 2 ชั้นให้เห็นครบในหน้าเดียว:
 *   ชั้นบน  = ภาพรวมทุกช่วงเวลา (ยอดรวม · งานที่ต้องตาม · แนวโน้มรายเดือน)
 *   ชั้นล่าง = เจาะเดือนที่เลือก (ปฏิทิน · สถานะ · พนักงานขาย · ยี่ห้อ/รุ่น)
 * ตัวกรองด้านบนมีผลกับทั้งสองชั้น ต่างกันแค่ช่วงเวลา
 */
export default async function BookingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("BOOK_DASH", "read");
  const params = await searchParams;

  const today = workDateOf();
  const year = Number(params.year) || Number(today.slice(0, 4));
  const month = Number(params.month) || Number(today.slice(5, 7));
  const field = params.by === "booking_date" ? "booking_date" : "pickup_date";
  const { from, to } = monthBounds(year, month);

  const base = queryFromParams(params);

  // ชั้นบน: ทุกช่วงเวลา (ตัดช่วงวันที่ออก เหลือเฉพาะเงื่อนไขอื่นที่ผู้ใช้เลือก)
  const allTimeQuery = { ...base, from: null, to: null, pickup_from: null, pickup_to: null, limit: 2000 };
  // ชั้นล่าง: เฉพาะเดือนที่กำลังดู ตามช่องวันที่ที่เลือกไว้
  const monthQuery =
    field === "pickup_date"
      ? { ...base, pickup_from: from, pickup_to: to, from: null, to: null }
      : { ...base, from, to, pickup_from: null, pickup_to: null };

  const [allRows, rows, branches, brands, models, variants, colors, staffNames] = await Promise.all([
    listBookings(allTimeQuery),
    listBookings(monthQuery),
    listBranches(),
    listMaster("brand", { includeInactive: true }),
    listMaster("model", { includeInactive: true }),
    listMaster("variant", { includeInactive: true }),
    listMaster("color", { includeInactive: true }),
    listBookingStaffNames(),
  ]);

  const overview = buildOverview(allRows, today);
  const trend = monthlyTrend(allRows, year, month, 12);
  const rankings = buildRankings(allRows, today);

  const summary = summarize(rows);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const byBrand = countByKey(rows, (r) => r.brand_name, "— ไม่ระบุยี่ห้อ —");
  const byModel = countByKey(rows, (r) => r.model_name, "— ไม่ระบุรุ่น —").slice(0, 12);
  const brandModel = countByBrandModel(rows);
  const byStaff = summarizeByStaff(rows);
  const staffChart = countByKey(rows, staffNameOf);

  /** แปลงสถานะแต่ละชุดเป็นรายการ ชื่อ-จำนวน ชุดเดียวกัน เพื่อให้วาดด้วยโค้ดก้อนเดียว */
  function toItems<T extends string>(
    order: readonly T[],
    labels: Record<T, string>,
    counts: Record<T, number>,
  ) {
    return order.map((key) => ({ label: labels[key], count: counts[key] ?? 0 }));
  }

  const statusGroups = [
    {
      title: "สถานะการจอง",
      items: toItems(BOOKING_STATUS_ORDER, BOOKING_STATUS_LABEL, summary.byBookingStatus),
    },
    {
      title: "สถานะรถ",
      items: toItems(VEHICLE_STATUS_ORDER, VEHICLE_STATUS_LABEL, summary.byVehicleStatus),
    },
    {
      title: "สถานะสัญญา",
      items: toItems(CONTRACT_STATUS_ORDER, CONTRACT_STATUS_LABEL, summary.byContractStatus),
    },
    {
      title: "สถานะเอกสาร",
      items: toItems(DOC_STATUS_ORDER, DOC_STATUS_LABEL, summary.byDocStatus),
    },
  ];

  const hasFilter = Object.entries(params).some(
    ([key, value]) => value && !["year", "month", "by"].includes(key),
  );

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">1.4 Dashboard ใบจอง</h1>
        <p className="text-sm text-slate-500">
          ภาพรวมทั้งหมดอยู่ด้านบน · ด้านล่างเจาะรายเดือน
          {hasFilter ? " · ตัวเลขทั้งหน้านับเฉพาะใบที่ตรงกับเงื่อนไขที่กรองไว้" : ""}
        </p>
      </div>

      <div className="no-print">
        <BookingFilters
          params={params}
          branches={branches}
          brands={brands}
          models={models}
          variants={variants}
          colors={colors}
          staffNames={staffNames}
          resetHref={`/booking/dashboard?year=${year}&month=${month}&by=${field}`}
          extraHiddenFields={{ year: String(year), month: String(month), by: field }}
        />
      </div>

      {/* ---------- ชั้นบน: ภาพรวมทุกช่วงเวลา ---------- */}
      <section className="space-y-1">
        <h2 className="font-semibold text-slate-800">ภาพรวมทุกช่วงเวลา</h2>
        <p className="text-xs text-slate-500">
          นับใบจองทั้งหมดในระบบ ไม่จำกัดเดือน · ข้อมูล ณ {formatThaiMonth(year, month)} (วันนี้)
        </p>
      </section>

      <OverviewPanel overview={overview} />

      <RankingPanel rankings={rankings} />

      <section className="card min-w-0 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-800">แนวโน้มยอดจอง 12 เดือนล่าสุด</h2>
          <p className="text-sm text-slate-500">นับตามวันที่จอง</p>
        </div>
        <GroupedBarChart
          groups={trend.map((p) => ({ label: p.label, values: { total: p.total, sold: p.sold } }))}
          series={TREND_SERIES}
        />
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {TREND_SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- ชั้นล่าง: เจาะเดือนที่เลือก ---------- */}
      <div className="no-print flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-4">
        <div>
          <h2 className="font-semibold text-slate-800">เจาะรายเดือน · {formatThaiMonth(year, month)}</h2>
          <p className="text-sm text-slate-500">
            หัวข้อถัดจากนี้นับเฉพาะ{field === "pickup_date" ? "ใบที่นัดรับรถ" : "ใบที่จอง"}ในเดือนนี้
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Link
            href={monthHref(params, prev.year, prev.month)}
            className="btn-secondary flex-1 sm:flex-none"
          >
            ← {formatThaiMonth(prev.year, prev.month)}
          </Link>
          <Link
            href={monthHref(params, next.year, next.month)}
            className="btn-secondary flex-1 sm:flex-none"
          >
            {formatThaiMonth(next.year, next.month)} →
          </Link>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {[
          { value: "pickup_date", label: "ดูตามวันที่นัดรับรถ" },
          { value: "booking_date", label: "ดูตามวันที่การจอง" },
        ].map((option) => (
          <Link
            key={option.value}
            href={monthHref({ ...params, by: option.value }, year, month)}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-sm sm:flex-none ${
              field === option.value
                ? "bg-brand-500 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* ---------- 1.4.1 ปฏิทิน ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-800">
            ปฏิทิน{field === "pickup_date" ? "วันนัดรับรถ" : "วันที่จอง"} ·{" "}
            {formatThaiMonth(year, month)}
          </h2>
          <p className="text-sm text-slate-500">
            {summary.total} ใบ · เงินมัดจำรวม {formatBaht(summary.deposit)}
          </p>
        </div>
        <BookingCalendar year={year} month={month} rows={rows} field={field} />
      </section>

      {/* ---------- 1.4.3-1.4.4 สถานะต่าง ๆ ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusGroups.map((group) => (
          <div key={group.title} className="card space-y-2">
            <h2 className="font-semibold text-slate-800">{group.title}</h2>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-800">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ---------- ยอดจองแยกตามพนักงานขาย ---------- */}
      <section className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <div className="card min-w-0 space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามพนักงานขาย</h2>
          <HorizontalBarChart
            rows={staffChart.map((s) => ({ label: s.label, values: { count: s.count } }))}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card min-w-0 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-semibold text-slate-800">ยอดจองรายพนักงาน</h2>
            <p className="text-sm text-slate-500">{byStaff.length} คน</p>
          </div>
          <StaffSummaryTable rows={byStaff} emptyText="ยังไม่มีใบจองในเดือนนี้" />
        </div>
      </section>

      {/* ---------- 1.4.2 แยกตามยี่ห้อ / รุ่นรถ ---------- */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card min-w-0 space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามยี่ห้อรถ</h2>
          <HorizontalBarChart
            rows={byBrand.map((b) => ({ label: b.label, values: { count: b.count } }))}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card min-w-0 space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามรุ่นรถ (12 อันดับแรก)</h2>
          <HorizontalBarChart
            rows={byModel.map((m) => ({ label: m.label, values: { count: m.count } }))}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ยี่ห้อ → รุ่นรถ</h2>
        {brandModel.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีใบจองในเดือนนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="text-left">ยี่ห้อ</th>
                  <th>รวม</th>
                  <th className="text-left">แยกตามรุ่น</th>
                </tr>
              </thead>
              <tbody>
                {brandModel.map((b) => (
                  <tr key={b.brand}>
                    <td className="text-left font-medium">{b.brand}</td>
                    <td>{b.count}</td>
                    <td className="whitespace-normal text-left text-xs text-slate-600">
                      {b.models.map((m) => `${m.label} (${m.count})`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

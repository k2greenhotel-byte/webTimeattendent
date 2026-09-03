import BookingFilters from "@/components/booking/BookingFilters";
import BookingTable from "@/components/booking/BookingTable";
import { formatBaht, queryFromParams, summarize } from "@/lib/booking";
import { listBookings } from "@/lib/booking-db";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
} from "@/lib/booking-types";
import { listBranches } from "@/lib/db";
import { listMaster } from "@/lib/moto-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.3 — สอบถามใบจองตามยี่ห้อ/รุ่น/แบบ สถานะต่าง ๆ และวันที่รับรถ */
export default async function BookingSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("BOOK_SEARCH", "read");
  const params = await searchParams;

  const [rows, branches, brands, models, variants, colors] = await Promise.all([
    listBookings(queryFromParams(params)),
    listBranches(),
    listMaster("brand", { includeInactive: true }),
    listMaster("model", { includeInactive: true }),
    listMaster("variant", { includeInactive: true }),
    listMaster("color", { includeInactive: true }),
  ]);

  const summary = summarize(rows);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">1.3 สอบถามใบจอง</h1>
        <p className="text-sm text-slate-500">
          เลือกเงื่อนไขได้หลายอย่างพร้อมกัน · ลิงก์ผลลัพธ์แชร์ต่อได้ และกด Ctrl+P เพื่อพิมพ์เป็น PDF
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
          resetHref="/booking/search"
        />
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
          <p className="text-sm text-slate-500">เงินมัดจำรวม {formatBaht(summary.deposit)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {BOOKING_STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{BOOKING_STATUS_LABEL[s]}</p>
              <p className="text-base font-semibold text-slate-800">{summary.byBookingStatus[s]}</p>
            </div>
          ))}
          {VEHICLE_STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">รถ: {VEHICLE_STATUS_LABEL[s]}</p>
              <p className="text-base font-semibold text-slate-800">{summary.byVehicleStatus[s]}</p>
            </div>
          ))}
        </div>

        <BookingTable rows={rows} emptyText="ไม่พบใบจองที่ตรงกับเงื่อนไขที่เลือก" />
      </section>
    </main>
  );
}

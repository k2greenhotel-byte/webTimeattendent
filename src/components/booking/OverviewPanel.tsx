import Link from "next/link";
import { describeVehicle, formatBaht, type BookingOverview } from "@/lib/booking";
import { BOOKING_STATUS_LABEL, type BookingRow } from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";

/**
 * ภาพรวมใบจองทั้งหมดในหน้าเดียว (ข้อ 1.4)
 * แถวบน = ตัวเลขสรุป · แถวล่าง = รายการที่ต้องลงมือทำ (เลยนัด / นัดวันนี้ / ใกล้ถึง / ค้างคืนเงิน)
 */

function KpiCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "brand" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-white",
    brand: "bg-brand-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
    rose: "bg-rose-50",
  } as const;

  const values = {
    slate: "text-slate-800",
    brand: "text-brand-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  } as const;

  return (
    <div className={`rounded-2xl border border-slate-200 p-3 ${tones[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${values[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** รายการใบจองที่ต้องตามงาน — แสดง 5 ใบแรก พร้อมลิงก์ไปดูทั้งหมด */
function AttentionList({
  title,
  rows,
  tone,
  emptyText,
  href,
}: {
  title: string;
  rows: BookingRow[];
  tone: "rose" | "amber" | "sky" | "slate";
  emptyText: string;
  href?: string;
}) {
  const heads = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    sky: "text-sky-700",
    slate: "text-slate-700",
  } as const;

  return (
    <div className="card min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`font-semibold ${heads[tone]}`}>{title}</h3>
        <span className="text-sm font-semibold text-slate-700">{rows.length} ใบ</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 5).map((row) => (
            <li key={row.id} className="text-xs">
              <Link
                href={`/booking/bookings/${row.id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {row.doc_no}
              </Link>{" "}
              <span className="text-slate-700">{row.customer_name ?? "ไม่ระบุลูกค้า"}</span>
              <div className="text-slate-400">
                {row.pickup_date ? `นัด ${formatThaiDate(row.pickup_date)} · ` : ""}
                {describeVehicle(row)} · {BOOKING_STATUS_LABEL[row.booking_status]}
              </div>
            </li>
          ))}
          {rows.length > 5 && (
            <li className="text-xs text-slate-400">
              + อีก {rows.length - 5} ใบ
              {href && (
                <>
                  {" · "}
                  <Link href={href} className="text-brand-600 hover:underline">
                    ดูทั้งหมด
                  </Link>
                </>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function OverviewPanel({ overview }: { overview: BookingOverview }) {
  return (
    <div className="space-y-3">
      {/* ---------- ตัวเลขสรุป ---------- */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="ใบจองทั้งหมด"
          value={`${overview.total} ใบ`}
          hint={`ปิดงานแล้ว ${overview.closed} · ยกเลิก ${overview.cancelledDoc}`}
        />
        <KpiCard
          label="กำลังดำเนินการ"
          value={`${overview.open} ใบ`}
          hint={`รอสัญญา ${overview.byBookingStatus.wait_contract} · รอรับรถ ${overview.byBookingStatus.wait_delivery}`}
          tone="brand"
        />
        <KpiCard
          label="ปิดการขายได้"
          value={`${overview.sold} ใบ`}
          hint={`คิดเป็น ${overview.closeRate}% ของใบจองทั้งหมด`}
          tone="emerald"
        />
        <KpiCard
          label="รับรถแล้ว"
          value={`${overview.byBookingStatus.delivered} ใบ`}
          hint={`ยกเลิกไม่รับรถ ${overview.byBookingStatus.cancelled} ใบ`}
        />
        <KpiCard
          label="เงินมัดจำที่ถืออยู่"
          value={formatBaht(overview.depositOpen)}
          hint={`มัดจำรวมทุกใบ ${formatBaht(overview.deposit)}`}
          tone="amber"
        />
        <KpiCard
          label="รถที่ต้องสั่งเพิ่ม"
          value={`${overview.needOrder} ใบ`}
          hint="นับเฉพาะใบที่ยังดำเนินการอยู่"
          tone={overview.needOrder > 0 ? "rose" : "slate"}
        />
      </section>

      {/* ---------- ต้องลงมือทำ ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionList
          title="เลยวันนัดรับรถ"
          rows={overview.overdue}
          tone="rose"
          emptyText="ไม่มีใบที่เลยกำหนดนัด"
          href="/booking/search?doc=active"
        />
        <AttentionList
          title="นัดรับรถวันนี้"
          rows={overview.dueToday}
          tone="amber"
          emptyText="วันนี้ไม่มีนัดรับรถ"
        />
        <AttentionList
          title="นัดรับรถใน 7 วัน"
          rows={overview.dueSoon}
          tone="sky"
          emptyText="7 วันข้างหน้ายังไม่มีนัด"
        />
        <AttentionList
          title="ยกเลิกแล้วยังไม่คืนเงิน"
          rows={overview.refundPending}
          tone="slate"
          emptyText="ไม่มีรายการค้างคืนเงิน"
          href="/booking/search?status=cancelled"
        />
      </section>
    </div>
  );
}

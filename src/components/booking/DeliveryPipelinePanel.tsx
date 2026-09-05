import Link from "next/link";
import { VehicleStatusBadge } from "@/components/booking/StatusBadges";
import { daysWaiting, describeVehicle, formatBaht, type DeliveryPipeline } from "@/lib/booking";
import { VEHICLE_STATUS_LABEL, type VehicleStatus } from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";

/**
 * ใบจองที่ขายจบแล้ว (สัญญาผ่านแล้ว + รอรับรถ) แยกตามว่ารถอยู่ไหน
 * เรียงจาก "พร้อมส่งมอบทันที" ไปหา "ยังไม่ได้สั่งรถ" เพื่อให้เห็นคอขวดจากซ้ายไปขวา
 */
const STEPS: {
  status: VehicleStatus;
  title: string;
  hint: string;
  tone: "emerald" | "sky" | "rose";
}[] = [
  {
    status: "in_stock",
    title: "รถมีในสต็อก",
    hint: "นัดลูกค้ามารับได้เลย",
    tone: "emerald",
  },
  {
    status: "ordered",
    title: "รถที่สั่งมาแล้ว",
    hint: "สั่งแล้ว รอรถเข้า",
    tone: "sky",
  },
  {
    status: "need_order",
    title: "รถต้องสั่ง",
    hint: "ยังไม่ได้สั่ง — ต้องรีบสั่งก่อนถึงวันนัด",
    tone: "rose",
  },
];

const TONES = {
  emerald: { box: "bg-emerald-50 border-emerald-200", value: "text-emerald-700" },
  sky: { box: "bg-sky-50 border-sky-200", value: "text-sky-700" },
  rose: { box: "bg-rose-50 border-rose-200", value: "text-rose-700" },
} as const;

/** ป้ายจำนวนวันที่รอ — ยิ่งนานยิ่งแดง */
function DelayBadge({ days }: { days: number }) {
  const tone =
    days >= 30
      ? "bg-rose-100 text-rose-700"
      : days >= 14
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`badge whitespace-nowrap ${tone}`}>{days} วัน</span>;
}

export default function DeliveryPipelinePanel({
  pipeline,
  today,
}: {
  pipeline: DeliveryPipeline;
  /** วันที่ใช้คำนวณจำนวนวันที่รอ (ส่งมาจากหน้าเว็บ เพื่อให้ทั้งหน้าอ้างวันเดียวกัน) */
  today: string;
}) {
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">รอส่งมอบ · สัญญาผ่านแล้ว + รอรับรถ</h2>
          <p className="text-xs text-slate-500">
            ใบที่งานขายจบแล้ว เหลือแค่รอรถ — แยกตามสถานะรถเพื่อดูว่าติดอยู่ขั้นไหน
          </p>
        </div>
        <p className="text-sm text-slate-500">
          รวม {pipeline.total} ใบ
          {pipeline.total > 0 && (
            <span className="text-slate-400"> · รอนานสุด {pipeline.maxDaysWaiting} วัน</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const count = pipeline.byVehicleStatus[step.status];
          const deposit = pipeline.depositByVehicleStatus[step.status];
          const tone = TONES[step.tone];

          return (
            <Link
              key={step.status}
              href={`/booking/search?contract=approved&status=wait_delivery&vehicle=${step.status}`}
              className={`rounded-2xl border p-3 transition hover:shadow ${tone.box}`}
            >
              <p className="text-xs text-slate-600">
                {step.title}
                <span className="text-slate-400"> · {VEHICLE_STATUS_LABEL[step.status]}</span>
              </p>
              <p className={`text-2xl font-bold ${tone.value}`}>
                {count} <span className="text-sm font-normal">ใบ</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{step.hint}</p>
              <p className="text-[11px] text-slate-400">มัดจำ {formatBaht(deposit)}</p>
            </Link>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">กดที่การ์ดเพื่อดูรายการใบจองของกลุ่มนั้นในหน้าสอบถาม</p>

      {/* ---------- รายการใบที่รอส่งมอบ เรียงจากรอนานสุดลงมา ---------- */}
      {pipeline.rows.length === 0 ? (
        <p className="text-sm text-slate-400">ยังไม่มีใบจองที่สัญญาผ่านแล้วและรอรับรถ</p>
      ) : (
        <>
          <h3 className="pt-1 font-medium text-slate-700">
            รายการที่รอส่งมอบ <span className="text-xs font-normal text-slate-400">(รอนานสุดขึ้นก่อน)</span>
          </h3>

          {/* มือถือ: การ์ด */}
          <ul className="space-y-2 md:hidden">
            {pipeline.rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/booking/bookings/${row.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {row.doc_no}
                    </Link>
                    <p className="truncate text-sm text-slate-700">
                      {row.customer_name ?? "— ไม่ระบุลูกค้า —"}
                    </p>
                  </div>
                  <DelayBadge days={daysWaiting(row, today)} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{describeVehicle(row)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  จอง {formatThaiDate(row.booking_date)}
                  {row.pickup_date ? ` · นัดรับ ${formatThaiDate(row.pickup_date)}` : ""}
                  {row.taken_by_name ? ` · ${row.taken_by_name}` : ""}
                </p>
                <div className="mt-2">
                  <VehicleStatusBadge status={row.vehicle_status} />
                </div>
              </li>
            ))}
          </ul>

          {/* แท็บเล็ต/PC: ตาราง */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table-report">
              <thead>
                <tr>
                  <th>รอมาแล้ว</th>
                  <th>เลขที่ใบจอง</th>
                  <th>วันที่จอง</th>
                  <th className="text-left">ลูกค้า</th>
                  <th className="text-left">รถที่จอง</th>
                  <th>สถานะรถ</th>
                  <th>นัดรับรถ</th>
                  <th>มัดจำ</th>
                  <th>ผู้รับจอง</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <DelayBadge days={daysWaiting(row, today)} />
                    </td>
                    <td className="font-medium">
                      <Link
                        href={`/booking/bookings/${row.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {row.doc_no}
                      </Link>
                    </td>
                    <td className="text-xs">{formatThaiDate(row.booking_date)}</td>
                    <td className="text-left">{row.customer_name ?? "-"}</td>
                    <td className="whitespace-normal text-left text-xs">{describeVehicle(row)}</td>
                    <td>
                      <VehicleStatusBadge status={row.vehicle_status} />
                    </td>
                    <td className="text-xs">
                      {row.pickup_date ? (
                        formatThaiDate(row.pickup_date)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-xs">{formatBaht(row.deposit_amount)}</td>
                    <td className="text-xs">{row.taken_by_name ?? row.taken_by_full_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

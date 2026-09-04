import Link from "next/link";
import { describeVehicle } from "@/lib/booking";
import {
  BOOKING_STATUS_LABEL,
  CANCEL_REASON_LABEL,
  VEHICLE_STATUS_LABEL,
  type BookingRow,
} from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";

const HEAD_TONE = {
  rose: "text-rose-700",
  amber: "text-amber-700",
  sky: "text-sky-700",
  slate: "text-slate-700",
} as const;

/**
 * รายการใบจองที่ต้องตามงาน — แสดง 5 ใบแรก กดเข้าใบจองได้ทันที
 * ใช้ซ้ำได้ทุกกล่องบน dashboard ต่างกันแค่ชุดข้อมูลกับข้อความ
 */
export default function AttentionList({
  title,
  rows,
  tone,
  emptyText,
  hint,
  href,
  limit = 5,
  showVehicleStatus = false,
}: {
  title: string;
  rows: BookingRow[];
  tone: keyof typeof HEAD_TONE;
  emptyText: string;
  /** คำอธิบายเงื่อนไขของกล่องนี้ */
  hint?: string;
  href?: string;
  limit?: number;
  /** แสดงสถานะรถต่อท้าย (ใช้กับกล่องที่เกี่ยวกับสต็อก) */
  showVehicleStatus?: boolean;
}) {
  return (
    <div className="card min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`font-semibold ${HEAD_TONE[tone]}`}>{title}</h3>
        <span className="text-sm font-semibold text-slate-700">{rows.length} ใบ</span>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, limit).map((row) => (
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
                {describeVehicle(row)}
                {showVehicleStatus ? ` · รถ: ${VEHICLE_STATUS_LABEL[row.vehicle_status]}` : ""}
                {row.cancel_reason
                  ? ` · ${CANCEL_REASON_LABEL[row.cancel_reason]}`
                  : ` · ${BOOKING_STATUS_LABEL[row.booking_status]}`}
              </div>
            </li>
          ))}
          {rows.length > limit && (
            <li className="text-xs text-slate-400">
              + อีก {rows.length - limit} ใบ
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

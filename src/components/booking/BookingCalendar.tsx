import Link from "next/link";
import { buildCalendar, groupByDate } from "@/lib/booking";
import { BOOKING_STATUS_CLASS, BOOKING_STATUS_LABEL, type BookingRow } from "@/lib/booking-types";
import { formatThaiDate, formatThaiMonth, workDateOf } from "@/lib/datetime";

const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/**
 * ปฏิทินใบจองรายเดือน (ข้อ 1.4.1)
 * เลือกได้ว่าจะดูตามวันที่นัดรับรถ หรือวันที่การจอง
 *
 * จอเล็กแสดงเป็นรายการรายวัน (เฉพาะวันที่มีนัด) เพราะตาราง 7 คอลัมน์บนมือถือเล็กจนอ่านไม่ออก
 * จอ sm ขึ้นไปแสดงเป็นตารางปฏิทินเต็มเดือน
 */
export default function BookingCalendar({
  year,
  month,
  rows,
  field,
}: {
  year: number;
  month: number;
  rows: BookingRow[];
  field: "pickup_date" | "booking_date";
}) {
  const weeks = buildCalendar(year, month);
  const byDate = groupByDate(rows, field);
  const today = workDateOf();
  const total = [...byDate.values()].reduce((sum, l) => sum + l.length, 0);

  const agenda = [...byDate.entries()]
    .filter(([date]) => date.startsWith(`${year}-${String(month).padStart(2, "0")}`))
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      {/* ---------- มือถือ: รายการรายวัน ---------- */}
      <ul className="space-y-2 sm:hidden">
        {agenda.length === 0 && (
          <li className="text-sm text-slate-500">เดือนนี้ยังไม่มีใบจองตามเงื่อนไขที่เลือก</li>
        )}
        {agenda.map(([date, list]) => (
          <li key={date} className="rounded-xl border border-slate-200 p-3">
            <p
              className={`text-sm font-medium ${
                date === today ? "text-brand-600" : "text-slate-700"
              }`}
            >
              {formatThaiDate(date)}
              <span className="ml-2 font-normal text-slate-400">{list.length} ใบ</span>
            </p>
            <ul className="mt-1 space-y-1">
              {list.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/booking/bookings/${row.id}`}
                    className="flex items-center gap-2 text-sm text-slate-700 hover:underline"
                  >
                    <span className={`badge shrink-0 ${BOOKING_STATUS_CLASS[row.booking_status]}`}>
                      {BOOKING_STATUS_LABEL[row.booking_status]}
                    </span>
                    <span className="truncate">{row.customer_name ?? row.doc_no}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตารางปฏิทิน ---------- */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {DOW.map((d) => (
                <th
                  key={d}
                  className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => {
                  const list = cell.date ? byDate.get(cell.date) ?? [] : [];
                  const isToday = cell.date === today;
                  return (
                    <td
                      key={ci}
                      className={`h-20 border border-slate-200 align-top lg:h-24 ${
                        cell.date ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      {cell.date && (
                        <div className="flex h-full flex-col gap-1 p-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs ${
                                isToday
                                  ? "rounded-full bg-brand-500 px-1.5 py-0.5 font-semibold text-white"
                                  : "text-slate-400"
                              }`}
                            >
                              {cell.day}
                            </span>
                            {list.length > 0 && (
                              <span className="text-[11px] font-medium text-slate-500">
                                {list.length} ใบ
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5 overflow-hidden">
                            {list.slice(0, 3).map((row) => (
                              <Link
                                key={row.id}
                                href={`/booking/bookings/${row.id}`}
                                className={`block truncate rounded px-1 py-0.5 text-[11px] hover:underline ${
                                  BOOKING_STATUS_CLASS[row.booking_status]
                                }`}
                                title={`${row.doc_no} · ${row.customer_name ?? "ไม่ระบุลูกค้า"} · ${
                                  BOOKING_STATUS_LABEL[row.booking_status]
                                }`}
                              >
                                {row.customer_name ?? row.doc_no}
                              </Link>
                            ))}
                            {list.length > 3 && (
                              <span className="block px-1 text-[11px] text-slate-400">
                                + อีก {list.length - 3} ใบ
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {formatThaiMonth(year, month)} ·{" "}
        {field === "pickup_date" ? "จัดตามวันที่นัดรับรถ" : "จัดตามวันที่การจอง"} · รวม {total} ใบ
      </p>
    </div>
  );
}

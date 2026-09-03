import { formatBaht, type StaffSummary } from "@/lib/booking";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_ORDER } from "@/lib/booking-types";

/**
 * ยอดจองแยกตามพนักงานขาย — ใช้ทั้งหน้าสอบถาม (1.3) และ dashboard (1.4)
 * จอเล็กเป็นการ์ดรายคน · จอ md ขึ้นไปเป็นตารางเทียบกันทั้งทีม
 */
export default function StaffSummaryTable({
  rows,
  emptyText = "ยังไม่มีใบจองในช่วงที่เลือก",
}: {
  rows: StaffSummary[];
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  const grand = rows.reduce(
    (sum, r) => ({ total: sum.total + r.total, deposit: sum.deposit + r.deposit, sold: sum.sold + r.sold }),
    { total: 0, deposit: 0, sold: 0 },
  );

  return (
    <>
      {/* ---------- มือถือ: การ์ดรายคน ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.staff} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-slate-800">{r.staff}</span>
              <span className="text-sm text-slate-600">{r.total} ใบ</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              มัดจำรวม {formatBaht(r.deposit)} · ปิดการขายได้ {r.sold} ใบ
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              {BOOKING_STATUS_ORDER.map((s) => (
                <div key={s} className="flex justify-between gap-2">
                  <dt className="text-slate-400">{BOOKING_STATUS_LABEL[s]}</dt>
                  <dd className="font-medium">{r.byBookingStatus[s]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        <li className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          รวมทั้งหมด {grand.total} ใบ · มัดจำ {formatBaht(grand.deposit)} · ปิดการขาย {grand.sold} ใบ
        </li>
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th className="text-left">พนักงานที่รับจอง</th>
              <th>จำนวนใบจอง</th>
              <th>เงินมัดจำรวม</th>
              {BOOKING_STATUS_ORDER.map((s) => (
                <th key={s}>{BOOKING_STATUS_LABEL[s]}</th>
              ))}
              <th>ปิดการขายได้</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff}>
                <td className="text-left font-medium">{r.staff}</td>
                <td>{r.total}</td>
                <td className="text-xs">{formatBaht(r.deposit)}</td>
                {BOOKING_STATUS_ORDER.map((s) => (
                  <td key={s} className={r.byBookingStatus[s] === 0 ? "text-slate-300" : ""}>
                    {r.byBookingStatus[s]}
                  </td>
                ))}
                <td className="font-medium text-emerald-700">{r.sold}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="text-left">รวมทั้งหมด</td>
              <td>{grand.total}</td>
              <td className="text-xs">{formatBaht(grand.deposit)}</td>
              {BOOKING_STATUS_ORDER.map((s) => (
                <td key={s}>{rows.reduce((sum, r) => sum + r.byBookingStatus[s], 0)}</td>
              ))}
              <td className="text-emerald-700">{grand.sold}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

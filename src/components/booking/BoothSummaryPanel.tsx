import { NO_BOOTH, formatBaht, summarizeByBooth } from "@/lib/booking";
import type { BookingRow } from "@/lib/booking-types";

/**
 * ยอดจองแยกตามบูธที่ออก — ใช้ทั้งหน้าสอบถาม (1.3) และ dashboard (1.4)
 *
 * แถว "รับที่สาขา" อยู่ท้ายเสมอและทำเป็นสีจาง เพราะไม่ใช่ผลงานของการออกบูธ
 * แต่ยังต้องเห็นไว้เทียบสัดส่วนว่าบูธช่วยได้แค่ไหน
 */
export default function BoothSummaryPanel({
  rows,
  emptyText = "ยังไม่มีใบจองในช่วงที่เลือก",
}: {
  rows: BookingRow[];
  emptyText?: string;
}) {
  const summary = summarizeByBooth(rows);
  if (summary.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  const fromBooth = summary.filter((s) => s.label !== NO_BOOTH);
  const boothTotal = fromBooth.reduce((sum, s) => sum + s.count, 0);
  const grand = summary.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        รับจากบูธ <span className="font-semibold text-violet-700">{boothTotal}</span> ใบ จากทั้งหมด{" "}
        {grand} ใบ
        {grand > 0 && ` (${Math.round((boothTotal / grand) * 100)}%)`} · ออกบูธ {fromBooth.length} แห่ง
      </p>

      <ul className="space-y-1.5">
        {summary.map((s) => {
          const isBooth = s.label !== NO_BOOTH;
          const width = grand > 0 ? Math.round((s.count / grand) * 100) : 0;
          return (
            <li key={s.label} className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={isBooth ? "font-medium text-slate-800" : "text-slate-500"}>
                  {isBooth ? `#${s.label}` : s.label}
                </span>
                <span className="text-xs text-slate-500">
                  {s.count} ใบ · มัดจำ {formatBaht(s.deposit)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${isBooth ? "bg-violet-500" : "bg-slate-300"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

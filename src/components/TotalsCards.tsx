import type { PeriodTotals } from "@/lib/attendance";
import { formatDuration } from "@/lib/datetime";

export default function TotalsCards({ totals }: { totals: PeriodTotals }) {
  const items: { label: string; value: string; tone?: string }[] = [
    { label: "ชั่วโมงทำงานรวม", value: formatDuration(totals.workMinutes) },
    { label: "วันที่มาทำงาน", value: `${totals.workedDays} วัน` },
    { label: "ลงเวลาไม่ครบ", value: `${totals.incompleteDays} วัน`, tone: "text-amber-600" },
    { label: "ขาดงาน", value: `${totals.absentDays} วัน`, tone: "text-rose-600" },
    {
      label: "มาสาย",
      value: `${totals.lateDays} วัน (${totals.lateMinutes} นาที)`,
      tone: totals.lateDays > 0 ? "text-rose-600" : undefined,
    },
    { label: "พักเกินเวลา", value: `${totals.overBreakMinutes} นาที`, tone: "text-amber-600" },
    { label: "OT รวม", value: formatDuration(totals.otMinutes) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className={`mt-1 text-lg font-semibold ${item.tone ?? "text-slate-800"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

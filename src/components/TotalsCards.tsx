import Link from "next/link";
import type { PeriodTotals } from "@/lib/attendance";
import { formatDuration } from "@/lib/datetime";

/** ธงที่คลิกกรองได้จากกล่องสรุป (ใช้ในรายงานรายวัน) */
export type SummaryFlag = "incomplete" | "absent" | "late" | "overbreak" | "leave";

export const SUMMARY_FLAG_LABEL: Record<SummaryFlag, string> = {
  incomplete: "ลงเวลาไม่ครบ",
  absent: "ขาดงาน",
  late: "มาสาย",
  overbreak: "พักเกินเวลา",
  leave: "ลา",
};

export default function TotalsCards({
  totals,
  /** ใส่ลิงก์ฐาน (query เดิมโดยไม่มี flag) เพื่อให้กล่องคลิกกรองข้อมูลได้ */
  filterBase,
  activeFlag,
}: {
  totals: PeriodTotals;
  filterBase?: string;
  activeFlag?: SummaryFlag | null;
}) {
  const items: { label: string; value: string; tone?: string; flag?: SummaryFlag }[] = [
    { label: "ชั่วโมงทำงานรวม", value: formatDuration(totals.workMinutes) },
    { label: "วันที่มาทำงาน", value: `${totals.workedDays} วัน` },
    {
      label: "ลงเวลาไม่ครบ",
      value: `${totals.incompleteDays} วัน`,
      tone: "text-amber-600",
      flag: "incomplete",
    },
    { label: "ขาดงาน", value: `${totals.absentDays} วัน`, tone: "text-rose-600", flag: "absent" },
    ...(totals.leaveDays > 0
      ? [
          {
            label: "ลา",
            value: `${totals.leaveDays} วัน`,
            tone: "text-violet-700",
            flag: "leave" as const,
          },
        ]
      : []),
    ...(totals.offDays > 0
      ? [{ label: "หยุดเวร", value: `${totals.offDays} วัน`, tone: "text-sky-600" }]
      : []),
    {
      label: "มาสาย",
      value: `${totals.lateDays} วัน (${totals.lateMinutes} นาที)`,
      tone: totals.lateDays > 0 ? "text-rose-600" : undefined,
      flag: "late",
    },
    {
      label: "พักเกินเวลา",
      value: `${totals.overBreakMinutes} นาที`,
      tone: "text-amber-600",
      flag: "overbreak",
    },
    ...(totals.errandMinutes > 0
      ? [{ label: "ออกทำธุระ", value: formatDuration(totals.errandMinutes), tone: "text-slate-700" }]
      : []),
    { label: "OT รวม", value: formatDuration(totals.otMinutes) },
    ...(totals.fieldMinutes > 0
      ? [{ label: "งานพิเศษนอกสถานที่", value: formatDuration(totals.fieldMinutes), tone: "text-violet-700" }]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => {
        const body = (
          <>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={`mt-1 text-lg font-semibold ${item.tone ?? "text-slate-800"}`}>
              {item.value}
            </p>
          </>
        );

        // กล่องที่กรองได้ทำเป็นลิงก์ · คลิกซ้ำที่กล่องเดิม = ล้างตัวกรอง
        if (filterBase && item.flag) {
          const active = activeFlag === item.flag;
          const sep = filterBase.includes("?") ? "&" : "?";
          const href = active ? filterBase : `${filterBase}${sep}flag=${item.flag}`;
          return (
            <Link
              key={item.label}
              href={href}
              title={active ? "คลิกเพื่อล้างตัวกรอง" : `คลิกเพื่อดูเฉพาะ${item.label}`}
              className={`rounded-xl border bg-white p-3 transition hover:border-brand-400 hover:shadow-sm ${
                active ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"
              }`}
            >
              {body}
              <p className="mt-0.5 text-[11px] text-brand-600">
                {active ? "✕ ล้างตัวกรอง" : "คลิกเพื่อกรอง"}
              </p>
            </Link>
          );
        }

        return (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
            {body}
          </div>
        );
      })}
    </div>
  );
}

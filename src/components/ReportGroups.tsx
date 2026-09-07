import ReportTable from "@/components/ReportTable";
import { summarizePeriod } from "@/lib/attendance";
import { formatDuration } from "@/lib/datetime";
import type { ReportRow } from "@/lib/reports";

export type GroupBy = "none" | "branch" | "company";

export const GROUP_LABEL: Record<GroupBy, string> = {
  none: "ไม่จัดกลุ่ม",
  branch: "แยกตามสาขา",
  company: "แยกตามบริษัท",
};

/** อ่านค่า group จาก query string ให้เป็นค่าที่รองรับเท่านั้น */
export function parseGroupBy(value: string | undefined): GroupBy {
  return value === "branch" || value === "company" ? value : "none";
}

/**
 * ตารางรายงานที่จัดกลุ่มตามสาขาหรือบริษัท พร้อมยอดรวมของแต่ละกลุ่ม
 * ไม่จัดกลุ่ม = ตารางเดียวเหมือนเดิม
 */
export default function ReportGroups({
  rows,
  groupBy,
  editBase,
}: {
  rows: ReportRow[];
  groupBy: GroupBy;
  editBase?: string;
}) {
  if (groupBy === "none") {
    return (
      <section className="card">
        <ReportTable rows={rows} showEmployee editBase={editBase} />
      </section>
    );
  }

  const keyOf = (r: ReportRow) =>
    groupBy === "company" ? (r.companyName ?? "ไม่ระบุบริษัท") : (r.branchName ?? "ไม่ระบุสาขา");

  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]);

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "th"));

  return (
    <div className="space-y-4">
      {sorted.map(([name, list]) => {
        const totals = summarizePeriod(list.map((r) => r.summary));
        return (
          <section key={name} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-800">
                {name} <span className="text-xs font-normal text-slate-500">({list.length} คน)</span>
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge bg-emerald-50 text-emerald-700">มาทำงาน {totals.workedDays}</span>
                {totals.lateDays > 0 && (
                  <span className="badge bg-rose-50 text-rose-700">
                    สาย {totals.lateDays} ({totals.lateMinutes} นาที)
                  </span>
                )}
                {totals.absentDays > 0 && (
                  <span className="badge bg-rose-50 text-rose-700">ขาด {totals.absentDays}</span>
                )}
                {totals.incompleteDays > 0 && (
                  <span className="badge bg-amber-50 text-amber-700">ลงไม่ครบ {totals.incompleteDays}</span>
                )}
                {totals.overBreakMinutes > 0 && (
                  <span className="badge bg-amber-50 text-amber-700">พักเกิน {totals.overBreakMinutes} นาที</span>
                )}
                <span className="badge bg-slate-100 text-slate-600">
                  ชม.รวม {formatDuration(totals.workMinutes)}
                </span>
              </div>
            </div>
            <ReportTable rows={list} showEmployee editBase={editBase} />
          </section>
        );
      })}
    </div>
  );
}

import type { GroupSummary } from "@/lib/lead";
import {
  CHANCE_DOT_CLASS,
  WORK_STATUS_LABEL,
  WORK_STATUS_ORDER,
  type Chance,
} from "@/lib/lead-types";

const CHANCE_COLS: Chance[] = ["high", "medium", "low"];

/** แถบอัตราการปิดการขาย — เห็นความต่างระหว่างคนได้เร็วกว่าอ่านตัวเลขอย่างเดียว */
function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-emerald-500"
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
      <span className="font-semibold text-slate-800">{rate}%</span>
    </div>
  );
}

/**
 * ตารางสรุปตามสาขา / พนักงานขาย / ช่องทาง (dashboard ข้อ 3.1-3.3)
 * มือถือแสดงเป็นการ์ด · จอ md ขึ้นไปแสดงเป็นตารางเทียบกันทั้งทีม
 */
export default function GroupSummaryTable({
  rows,
  labelHeader,
  emptyText,
}: {
  rows: GroupSummary[];
  labelHeader: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.label} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-medium text-slate-800">{row.label}</p>
              <span className="shrink-0 text-sm text-slate-500">{row.total} ราย</span>
            </div>

            <div className="mt-2">
              <p className="text-xs text-slate-400">อัตราการปิดการขาย</p>
              <RateBar rate={row.closeRate} />
              <p className="text-[11px] text-slate-400">
                ปิดได้ {row.closed} ราย · ค้างติดตาม {row.overdue} ราย · ติดตามเฉลี่ย{" "}
                {row.avgFollow} ครั้ง/ราย
              </p>
            </div>

            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              {WORK_STATUS_ORDER.map((s) => (
                <div key={s} className="flex justify-between gap-2">
                  <dt className="truncate text-slate-400">{WORK_STATUS_LABEL[s]}</dt>
                  <dd>{row.byStatus[s]}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-2 flex items-center gap-3 text-xs text-slate-600">
              {CHANCE_COLS.map((c) => (
                <span key={c} className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${CHANCE_DOT_CLASS[c]}`} />
                  {row.byChance[c]}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th className="text-left">{labelHeader}</th>
              <th>Lead ทั้งหมด</th>
              {WORK_STATUS_ORDER.map((s) => (
                <th key={s}>{WORK_STATUS_LABEL[s]}</th>
              ))}
              <th>โอกาส สูง/กลาง/น้อย</th>
              <th>เลยนัดติดตาม</th>
              <th>ติดตามเฉลี่ย</th>
              <th>วันเฉลี่ยถึงปิดการขาย</th>
              <th>อัตราปิดการขาย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="text-left font-medium">{row.label}</td>
                <td>{row.total}</td>
                {WORK_STATUS_ORDER.map((s) => (
                  <td key={s}>{row.byStatus[s]}</td>
                ))}
                <td className="text-xs">
                  <span className="text-emerald-600">{row.byChance.high}</span> /{" "}
                  <span className="text-amber-600">{row.byChance.medium}</span> /{" "}
                  <span className="text-rose-600">{row.byChance.low}</span>
                </td>
                <td className={row.overdue > 0 ? "font-medium text-rose-600" : undefined}>
                  {row.overdue}
                </td>
                <td className="text-xs">{row.avgFollow} ครั้ง</td>
                <td className="text-xs">
                  {row.avgDaysToClose > 0 ? `${row.avgDaysToClose} วัน` : "—"}
                </td>
                <td>
                  <RateBar rate={row.closeRate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import type { GroupSummary } from "@/lib/lead";
import { DOT_CLASS, colorOf, type ChanceOption, type WorkStatusOption } from "@/lib/lead-types";

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
 * คอลัมน์สถานะงานและสีของโอกาส มาจากที่ตั้งค่าไว้ที่ /leads/setup
 * มือถือแสดงเป็นการ์ด · จอ md ขึ้นไปแสดงเป็นตารางเทียบกันทั้งทีม
 */
export default function GroupSummaryTable({
  rows,
  labelHeader,
  statuses,
  chances,
  emptyText,
}: {
  rows: GroupSummary[];
  labelHeader: string;
  statuses: WorkStatusOption[];
  chances: ChanceOption[];
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
              {statuses.map((s) => (
                <div key={s.code} className="flex justify-between gap-2">
                  <dt className="truncate text-slate-400">{s.name}</dt>
                  <dd>{row.byStatus[s.code] ?? 0}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              {chances.map((c) => (
                <span key={c.code} className="flex items-center gap-1">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${DOT_CLASS[colorOf(c.color)]}`}
                  />
                  {row.byChance[c.code] ?? 0}
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
              {statuses.map((s) => (
                <th key={s.code}>{s.name}</th>
              ))}
              <th>โอกาส {chances.map((c) => c.name).join("/")}</th>
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
                {statuses.map((s) => (
                  <td key={s.code}>{row.byStatus[s.code] ?? 0}</td>
                ))}
                <td className="whitespace-nowrap text-xs">
                  {chances.map((c, index) => (
                    <span key={c.code}>
                      {index > 0 && " / "}
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${DOT_CLASS[colorOf(c.color)]}`}
                        />
                        {row.byChance[c.code] ?? 0}
                      </span>
                    </span>
                  ))}
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

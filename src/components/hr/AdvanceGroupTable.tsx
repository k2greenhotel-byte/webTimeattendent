import { formatBaht } from "@/lib/leave";
import type { AdvanceGroupSummary } from "@/lib/leave";

/**
 * ตารางสรุปใบขอเบิกเงินตามกลุ่ม (บริษัท/สาขา/พนักงาน) สำหรับ Dashboard
 * มือถือแสดงเป็นการ์ด · จอ md ขึ้นไปแสดงเป็นตารางเทียบกันทั้งกลุ่ม
 */
export default function AdvanceGroupTable({
  rows,
  labelHeader,
  emptyText,
}: {
  rows: AdvanceGroupSummary[];
  labelHeader: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>;

  return (
    <>
      {/* มือถือ: การ์ด */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-medium text-slate-800">{row.label}</p>
              <span className="shrink-0 text-sm text-slate-500">{row.total} ใบ</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              รออนุมัติ {row.byStatus.pending} · อนุมัติ {row.byStatus.approved} · บางส่วน{" "}
              {row.byStatus.partial} · ไม่อนุมัติ {row.byStatus.rejected}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-semibold text-slate-800">{formatBaht(row.totalRequested)}</span>
              <span className="ml-2 text-emerald-700">อนุมัติ {formatBaht(row.totalApproved)}</span>
            </p>
          </li>
        ))}
      </ul>

      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th className="text-left">{labelHeader}</th>
              <th>ทั้งหมด</th>
              <th>รออนุมัติ</th>
              <th>อนุมัติ</th>
              <th>บางส่วน</th>
              <th>ไม่อนุมัติ</th>
              <th>ยอดที่ขอ</th>
              <th>ยอดที่อนุมัติ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="text-left font-medium">{row.label}</td>
                <td>{row.total}</td>
                <td>{row.byStatus.pending}</td>
                <td>{row.byStatus.approved}</td>
                <td>{row.byStatus.partial}</td>
                <td>{row.byStatus.rejected}</td>
                <td className="font-semibold">{formatBaht(row.totalRequested)}</td>
                <td className="text-emerald-700">{formatBaht(row.totalApproved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

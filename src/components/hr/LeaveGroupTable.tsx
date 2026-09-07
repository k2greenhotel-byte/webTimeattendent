import type { LeaveGroupSummary } from "@/lib/leave";

/**
 * ตารางสรุปใบแจ้งลาตามกลุ่ม (บริษัท/สาขา/พนักงาน/ประเภท) สำหรับ Dashboard
 * มือถือแสดงเป็นการ์ด · จอ md ขึ้นไปแสดงเป็นตารางเทียบกันทั้งกลุ่ม
 */
export default function LeaveGroupTable({
  rows,
  labelHeader,
  emptyText,
}: {
  rows: LeaveGroupSummary[];
  labelHeader: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>;

  const approved = (row: LeaveGroupSummary) => row.byStatus.approved_hr + row.byStatus.approved_exec;
  const rejected = (row: LeaveGroupSummary) => row.byStatus.rejected_hr + row.byStatus.rejected_exec;
  const needsFix = (row: LeaveGroupSummary) => row.byStatus.need_docs + row.byStatus.need_type_change;

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
              รออนุมัติ {row.byStatus.pending} · ส่งผู้บริหาร {row.byStatus.escalated} · ต้องแก้ไข{" "}
              {needsFix(row)} · อนุมัติ {approved(row)} · ไม่อนุมัติ {rejected(row)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              รวมวันลา {row.totalDays} วัน
              {row.absentCount > 0 && <span className="text-rose-600"> · ขาดงาน {row.absentCount} ใบ</span>}
              {row.lateCount > 0 && <span className="text-amber-600"> · แจ้งช้า {row.lateCount} ใบ</span>}
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
              <th>ส่งผู้บริหาร</th>
              <th>ต้องแก้ไข</th>
              <th>อนุมัติ</th>
              <th>ไม่อนุมัติ</th>
              <th>ยกเลิก</th>
              <th>รวมวันลา</th>
              <th>ขาดงาน</th>
              <th>แจ้งช้า</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="text-left font-medium">{row.label}</td>
                <td>{row.total}</td>
                <td>{row.byStatus.pending}</td>
                <td>{row.byStatus.escalated}</td>
                <td>{needsFix(row)}</td>
                <td>{approved(row)}</td>
                <td>{rejected(row)}</td>
                <td>{row.byStatus.cancelled}</td>
                <td>{row.totalDays}</td>
                <td className={row.absentCount > 0 ? "font-medium text-rose-600" : undefined}>
                  {row.absentCount}
                </td>
                <td className={row.lateCount > 0 ? "font-medium text-amber-600" : undefined}>
                  {row.lateCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

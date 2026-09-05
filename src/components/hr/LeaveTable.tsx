import Link from "next/link";
import { formatThaiDate, formatTime } from "@/lib/datetime";
import { leaveFlags, leaveRangeText } from "@/lib/leave";
import type { LeaveRequestRow } from "@/lib/leave-types";
import { LeaveFlagList, LeaveStatusBadge, LeaveTypeBadge } from "./StatusBadges";

/** ตารางใบแจ้งลา — จอเล็กแสดงเป็นการ์ด จอใหญ่เป็นตาราง (แพตเทิร์นเดียวกับโมดูลอื่น) */
export default function LeaveTable({
  rows,
  today,
  emptyText = "ยังไม่มีใบแจ้งลา",
  showEmployee = true,
  actionLabel = "ดูรายละเอียด",
}: {
  rows: LeaveRequestRow[];
  today: string;
  emptyText?: string;
  showEmployee?: boolean;
  actionLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <>
      {/* จอเล็ก: การ์ด */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/hr/leave/${row.id}`}
            className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-800">{leaveRangeText(row)}</p>
              <LeaveStatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {row.doc_no} · {row.type_icon ?? ""} {row.type_name}
              {showEmployee ? ` · ${row.employee_name}` : ""}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{row.detail}</p>
            <LeaveFlagList flags={leaveFlags(row, today)} />
          </Link>
        ))}
      </div>

      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่แจ้ง</th>
              <th>เวลาที่แจ้ง</th>
              {showEmployee && <th>ผู้แจ้ง</th>}
              <th>ประเภท</th>
              <th className="text-left">ช่วงที่ลา / รายละเอียด</th>
              <th>วัน</th>
              <th>สาขา</th>
              <th>สถานะ</th>
              <th>ผู้อนุมัติ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap font-medium">{row.doc_no}</td>
                <td className="whitespace-nowrap text-xs">{formatThaiDate(row.request_date)}</td>
                <td className="whitespace-nowrap text-xs">{formatTime(row.reported_at)} น.</td>
                {showEmployee && <td className="text-xs">{row.employee_name}</td>}
                <td>
                  <LeaveTypeBadge icon={row.type_icon} name={row.type_name} />
                </td>
                <td className="whitespace-normal text-left">
                  <p className="font-medium text-slate-700">{leaveRangeText(row)}</p>
                  <p className="text-xs text-slate-500">{row.detail}</p>
                  <LeaveFlagList flags={leaveFlags(row, today)} />
                </td>
                <td>{row.arrival_time ? "-" : row.total_days}</td>
                <td className="text-xs text-slate-500">{row.branch_name ?? "-"}</td>
                <td>
                  <LeaveStatusBadge status={row.status} />
                </td>
                <td className="text-xs text-slate-500">{row.decided_by_name ?? "-"}</td>
                <td>
                  <Link
                    href={`/hr/leave/${row.id}`}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

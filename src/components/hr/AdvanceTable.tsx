import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/leave";
import type { AdvanceRequestRow } from "@/lib/leave-types";
import { AdvanceStatusBadge } from "./StatusBadges";

/** ตารางใบขอเบิกเงินเดือน — จอเล็กแสดงเป็นการ์ด จอใหญ่เป็นตาราง */
export default function AdvanceTable({
  rows,
  emptyText = "ยังไม่มีใบขอเบิกเงิน",
  showEmployee = true,
  actionLabel = "ดูรายละเอียด",
}: {
  rows: AdvanceRequestRow[];
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
            href={`/hr/advance/${row.id}`}
            className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-800">{row.purpose}</p>
              <AdvanceStatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {row.doc_no} · {formatThaiDate(row.request_date)}
              {showEmployee ? ` · ${row.employee_name}` : ""}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-semibold text-slate-800">{formatBaht(row.amount)}</span>
              {row.status !== "pending" && (
                <span className="ml-2 text-slate-500">
                  อนุมัติ {formatBaht(row.approved_amount)}
                </span>
              )}
            </p>
          </Link>
        ))}
      </div>

      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่ขอเบิก</th>
              {showEmployee && <th>ผู้ขอเบิก</th>}
              <th className="text-left">ขอเบิกเพื่อ</th>
              <th>สาขา</th>
              <th>ยอดที่ขอ</th>
              <th>ยอดที่อนุมัติ</th>
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
                {showEmployee && <td className="text-xs">{row.employee_name}</td>}
                <td className="whitespace-normal text-left">
                  {row.purpose}
                  {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                </td>
                <td className="text-xs text-slate-500">{row.branch_name ?? "-"}</td>
                <td className="font-semibold">{formatBaht(row.amount)}</td>
                <td className={row.status === "partial" ? "font-semibold text-teal-700" : ""}>
                  {row.status === "pending" ? "-" : formatBaht(row.approved_amount)}
                </td>
                <td>
                  <AdvanceStatusBadge status={row.status} />
                </td>
                <td className="text-xs text-slate-500">{row.decided_by_name ?? "-"}</td>
                <td>
                  <Link
                    href={`/hr/advance/${row.id}`}
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

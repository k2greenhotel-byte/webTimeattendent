import Link from "next/link";
import { amountText, isOverdue } from "@/lib/approval";
import type { ApvRequestRow } from "@/lib/approval-types";
import { formatThaiDate } from "@/lib/datetime";
import { ApvStatusBadge, TypeBadge } from "./StatusBadges";

/**
 * ตารางใบขออนุมัติ — จอเล็กแสดงเป็นการ์ด จอใหญ่เป็นตาราง
 * (แพตเทิร์นเดียวกับ DocTable ของโมดูลจัดซื้อ เพื่อให้หน้าตาทั้งระบบเหมือนกัน)
 */
export default function RequestTable({
  rows,
  today,
  emptyText = "ไม่มีเรื่องในกล่องนี้",
  actionLabel = "พิจารณา",
  showRequester = true,
  hrefOf = (row: ApvRequestRow) => `/approvals/${row.id}`,
  note,
}: {
  rows: ApvRequestRow[];
  today: string;
  emptyText?: string;
  actionLabel?: string;
  showRequester?: boolean;
  hrefOf?: (row: ApvRequestRow) => string;
  note?: (row: ApvRequestRow) => string | null;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  const overdueDays = (row: ApvRequestRow) => {
    if (!isOverdue(row, today)) return 0;
    const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${row.needed_by}T00:00:00Z`);
    return Math.max(1, Math.round(diff / 86_400_000));
  };

  return (
    <>
      {/* จอเล็ก: การ์ด */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={hrefOf(row)}
            className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-800">{row.subject}</p>
              <ApvStatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {row.doc_no} · {row.type_name}
              {showRequester ? ` · ${row.requester_name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-slate-800">{amountText(row)}</span>
              {row.has_amount && <span className="text-xs text-slate-400">บาท</span>}
              <span className="ml-auto text-xs text-slate-500">
                {row.needed_by ? `ต้องการ ${formatThaiDate(row.needed_by)}` : formatThaiDate(row.request_date)}
              </span>
            </div>
            {overdueDays(row) > 0 && (
              <p className="mt-1 text-xs text-rose-600">เลยกำหนด {overdueDays(row)} วัน</p>
            )}
            {note?.(row) && <p className="mt-1 text-xs text-amber-700">{note(row)}</p>}
          </Link>
        ))}
      </div>

      {/* จอใหญ่: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>ประเภทเรื่อง</th>
              <th className="text-left">เรื่อง</th>
              {showRequester && <th>ผู้ขอ</th>}
              <th>สาขา</th>
              <th>จำนวน</th>
              <th>ต้องการภายใน</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap font-medium">{row.doc_no}</td>
                <td>
                  <TypeBadge icon={row.type_icon} name={row.type_name} />
                </td>
                <td className="whitespace-normal text-left">
                  {row.subject}
                  {note?.(row) && <p className="text-xs text-amber-700">{note(row)}</p>}
                </td>
                {showRequester && <td className="text-xs">{row.requester_name}</td>}
                <td className="text-xs text-slate-500">{row.branch_name ?? "-"}</td>
                <td className="font-semibold">{amountText(row)}</td>
                <td className="text-xs">
                  {row.needed_by ? formatThaiDate(row.needed_by) : "-"}
                  {overdueDays(row) > 0 && (
                    <span className="ml-1 text-rose-600">(เลย {overdueDays(row)} วัน)</span>
                  )}
                </td>
                <td>
                  <ApvStatusBadge status={row.status} />
                </td>
                <td>
                  <Link href={hrefOf(row)} className="text-sm text-brand-600 hover:underline">
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

import Link from "next/link";
import {
  ApproveStatusBadge,
  DocKindBadge,
  JobStatusBadge,
  OverdueBadge,
  PayStatusBadge,
  PrDocStatusBadge,
  UrgencyBadge,
} from "@/components/procurement/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { deadlineOf, formatBaht, overdueText } from "@/lib/procurement";
import { REJECT_REASON_LABEL, type PrDocRow } from "@/lib/procurement-types";

/** เส้นทางหน้ารายละเอียดของเอกสารหนึ่งใบ (ซ่อมกับซื้ออยู่คนละหน้า) */
export function docHref(row: Pick<PrDocRow, "kind" | "id">): string {
  return row.kind === "repair"
    ? `/procurement/repairs/${row.id}`
    : `/procurement/purchases/${row.id}`;
}

/**
 * รายการเอกสาร ใช้ร่วมกันทั้งหน้าแจ้งซ่อม (1.1) ขอจัดซื้อ (2.1) อนุมัติ (3) และสอบถาม (5)
 *
 * จอเล็ก (มือถือ) แสดงเป็นการ์ดใบละกล่อง อ่านได้โดยไม่ต้องเลื่อนซ้าย-ขวา
 * จอ md ขึ้นไป (แท็บเล็ต/PC) แสดงเป็นตารางเต็มเพื่อเทียบหลายใบพร้อมกันและสั่งพิมพ์
 */
export default function DocTable({
  rows,
  today,
  emptyText = "ยังไม่มีเอกสารในระบบ",
  showKind = false,
  showJobStatus = true,
  hrefOf = docHref,
  actionLabel,
}: {
  rows: PrDocRow[];
  today: string;
  emptyText?: string;
  /** แสดงคอลัมน์ชนิดเอกสาร — ใช้ในหน้าที่ปนทั้งใบซ่อมและใบซื้อ */
  showKind?: boolean;
  showJobStatus?: boolean;
  hrefOf?: (row: PrDocRow) => string;
  actionLabel?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.id}`} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={hrefOf(row)} className="font-medium text-brand-600 hover:underline">
                  {row.doc_no}
                </Link>
                <p className="truncate text-sm text-slate-700">{row.item_name}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {showKind && <DocKindBadge kind={row.kind} />}
                <PrDocStatusBadge status={row.doc_status} />
              </div>
            </div>

            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              <div>
                <dt className="text-slate-400">วันที่</dt>
                <dd>{formatThaiDate(row.doc_date)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">ครบกำหนด</dt>
                <dd>{formatThaiDate(deadlineOf(row))}</dd>
              </div>
              <div>
                <dt className="text-slate-400">สาขา</dt>
                <dd className="truncate">{row.branch_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">ประเภท</dt>
                <dd className="truncate">{row.type_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">ขอเบิก</dt>
                <dd>{formatBaht(row.requested_amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">อนุมัติ / เบิกจริง</dt>
                <dd>
                  {formatBaht(row.approved_amount)} / {formatBaht(row.actual_amount)}
                </dd>
              </div>
            </dl>

            <div className="mt-2 flex flex-wrap gap-1">
              <UrgencyBadge urgency={row.urgency} />
              {showJobStatus && row.job_status && <JobStatusBadge status={row.job_status} />}
              <ApproveStatusBadge status={row.approve_status} />
              <PayStatusBadge status={row.pay_status} kind={row.kind} />
              <OverdueBadge text={overdueText(row, today)} />
            </div>

            {row.reject_reason && (
              <p className="mt-2 text-[11px] text-rose-600">
                ไม่อนุมัติ: {REJECT_REASON_LABEL[row.reject_reason]}
                {row.reject_note ? ` · ${row.reject_note}` : ""}
              </p>
            )}

            {actionLabel && (
              <Link
                href={hrefOf(row)}
                className="btn-secondary mt-3 w-full text-brand-600"
              >
                {actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              {showKind && <th>ชนิด</th>}
              <th>เลขที่</th>
              <th>วันที่</th>
              <th className="text-left">รายการ</th>
              <th className="text-left">ประเภท</th>
              <th>สาขา</th>
              <th>เร่งด่วน</th>
              <th>ครบกำหนด</th>
              <th>ขอเบิก</th>
              <th>อนุมัติ</th>
              <th>เบิกจริง</th>
              {showJobStatus && <th>สถานะงาน</th>}
              <th>อนุมัติ</th>
              <th>เบิกเงิน</th>
              <th>เอกสาร</th>
              {actionLabel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                {showKind && (
                  <td>
                    <DocKindBadge kind={row.kind} />
                  </td>
                )}
                <td className="font-medium">
                  <Link href={hrefOf(row)} className="text-brand-600 hover:underline">
                    {row.doc_no}
                  </Link>
                </td>
                <td className="text-xs">{formatThaiDate(row.doc_date)}</td>
                <td className="whitespace-normal text-left">{row.item_name}</td>
                <td className="text-left text-xs">{row.type_name ?? "—"}</td>
                <td className="text-xs">{row.branch_name ?? "—"}</td>
                <td>
                  <UrgencyBadge urgency={row.urgency} />
                </td>
                <td className="text-xs">
                  {formatThaiDate(deadlineOf(row))}
                  <div className="text-[11px] text-rose-600">{overdueText(row, today)}</div>
                </td>
                <td className="text-xs">{formatBaht(row.requested_amount)}</td>
                <td className="text-xs">{formatBaht(row.approved_amount)}</td>
                <td className="text-xs">{formatBaht(row.actual_amount)}</td>
                {showJobStatus && (
                  <td>
                    <JobStatusBadge status={row.job_status} />
                  </td>
                )}
                <td>
                  <ApproveStatusBadge status={row.approve_status} />
                  {row.reject_reason && (
                    <div className="text-[11px] text-slate-400">
                      {REJECT_REASON_LABEL[row.reject_reason]}
                    </div>
                  )}
                </td>
                <td>
                  <PayStatusBadge status={row.pay_status} kind={row.kind} />
                </td>
                <td>
                  <PrDocStatusBadge status={row.doc_status} />
                </td>
                {actionLabel && (
                  <td>
                    <Link href={hrefOf(row)} className="font-medium text-brand-600 hover:underline">
                      {actionLabel}
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

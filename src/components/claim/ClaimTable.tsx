import Link from "next/link";
import {
  ClaimDocStatusBadge,
  ClaimJobStatusBadge,
  ExternalBadge,
  OverdueBadge,
  UrgencyBadge,
} from "@/components/claim/StatusBadges";
import { deadlineOf, jobText, overdueText, vehicleText } from "@/lib/claim";
import type { ClaimRow } from "@/lib/claim-types";
import { formatThaiDate } from "@/lib/datetime";

/**
 * รายการใบขอเคลม ใช้ร่วมกันทั้งหน้าบันทึก (1.4) หน้าสอบถาม (2) และ dashboard (3)
 *
 * จอเล็ก (มือถือ) แสดงเป็นการ์ดใบละกล่อง อ่านได้โดยไม่ต้องเลื่อนซ้าย-ขวา
 * จอ md ขึ้นไป แสดงเป็นตารางเต็มเพื่อเทียบหลายใบพร้อมกันและสั่งพิมพ์
 */
export default function ClaimTable({
  rows,
  today,
  emptyText = "ยังไม่มีใบขอเคลมในระบบ",
  actionLabel,
}: {
  rows: ClaimRow[];
  today: string;
  emptyText?: string;
  actionLabel?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  const href = (row: ClaimRow) => `/claim/claims/${row.id}`;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={href(row)} className="font-medium text-brand-600 hover:underline">
                  {row.doc_no}
                </Link>
                <p className="truncate text-sm text-slate-700">{row.customer_name}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <ClaimDocStatusBadge status={row.doc_status} />
                <ExternalBadge isExternal={row.is_external} />
              </div>
            </div>

            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              <div>
                <dt className="text-slate-400">วันที่แจ้ง</dt>
                <dd>{formatThaiDate(row.claim_date)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">ครบกำหนด</dt>
                <dd>{formatThaiDate(deadlineOf(row))}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">เลขตัวถัง / รถ</dt>
                <dd className="truncate">
                  {row.chassis_no}
                  {vehicleText(row) ? ` · ${vehicleText(row)}` : ""}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">รายการที่ขอเคลม</dt>
                <dd className="truncate">{row.item_summary ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">สาขา</dt>
                <dd className="truncate">{row.branch_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">ส่งมอบรถคืน</dt>
                <dd>{row.delivered_date ? formatThaiDate(row.delivered_date) : "—"}</dd>
              </div>
              {jobText(row) && (
                <div className="col-span-2">
                  <dt className="text-slate-400">งานซ่อม (Job)</dt>
                  <dd className="truncate">{jobText(row)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-2 flex flex-wrap gap-1">
              <UrgencyBadge urgency={row.urgency} />
              <ClaimJobStatusBadge status={row.job_status} />
              <OverdueBadge text={overdueText(row, today)} />
            </div>

            {row.job_status === "rejected" && row.reject_reason && (
              <p className="mt-2 text-[11px] text-rose-600">ไม่อนุมัติ: {row.reject_reason}</p>
            )}

            {actionLabel && (
              <Link href={href(row)} className="btn-secondary mt-3 w-full text-brand-600">
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
              <th>เลขที่</th>
              <th>วันที่</th>
              <th className="text-left">เลขตัวถัง</th>
              <th className="text-left">รถ</th>
              <th className="text-left">ลูกค้า</th>
              <th className="text-left">รายการที่ขอเคลม</th>
              <th>สาขา</th>
              <th>เร่งด่วน</th>
              <th>ครบกำหนด</th>
              <th>สถานะงาน</th>
              <th>Job no</th>
              <th>เปิด/ปิด job</th>
              <th>แจ้งผล</th>
              <th>ซ่อมเสร็จ</th>
              <th>ส่งมอบ</th>
              <th>เอกสาร</th>
              {actionLabel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">
                  <Link href={href(row)} className="text-brand-600 hover:underline">
                    {row.doc_no}
                  </Link>
                </td>
                <td className="text-xs">{formatThaiDate(row.claim_date)}</td>
                <td className="text-left text-xs">{row.chassis_no}</td>
                <td className="whitespace-normal text-left text-xs">{vehicleText(row) || "—"}</td>
                <td className="whitespace-normal text-left">
                  {row.customer_name}
                  {row.is_external && (
                    <div className="text-[11px] text-amber-600">ลูกค้าภายนอก</div>
                  )}
                </td>
                <td className="whitespace-normal text-left text-xs">{row.item_summary ?? "—"}</td>
                <td className="text-xs">{row.branch_name ?? "—"}</td>
                <td>
                  <UrgencyBadge urgency={row.urgency} />
                </td>
                <td className="text-xs">
                  {formatThaiDate(deadlineOf(row))}
                  <div className="text-[11px] text-rose-600">{overdueText(row, today)}</div>
                </td>
                <td>
                  <ClaimJobStatusBadge status={row.job_status} />
                  {row.job_status === "rejected" && row.reject_reason && (
                    <div className="text-[11px] text-slate-400">{row.reject_reason}</div>
                  )}
                </td>
                <td className="text-xs">{row.job_no ?? "—"}</td>
                <td className="text-xs">
                  {row.job_open_date ? formatThaiDate(row.job_open_date) : "—"}
                  <div className={row.job_close_date ? "text-[11px] text-slate-400" : "text-[11px] text-amber-600"}>
                    {row.job_close_date ? formatThaiDate(row.job_close_date) : row.job_open_date ? "ยังไม่ปิด job" : ""}
                  </div>
                </td>
                <td className="text-xs">
                  {row.result_date ? formatThaiDate(row.result_date) : "—"}
                </td>
                <td className="text-xs">{row.fixed_date ? formatThaiDate(row.fixed_date) : "—"}</td>
                <td className="text-xs">
                  {row.delivered_date ? formatThaiDate(row.delivered_date) : "—"}
                </td>
                <td>
                  <ClaimDocStatusBadge status={row.doc_status} />
                </td>
                {actionLabel && (
                  <td>
                    <Link href={href(row)} className="font-medium text-brand-600 hover:underline">
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

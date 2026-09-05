import Link from "next/link";
import { ChanceBadge, OverdueBadge, WorkStatusBadge } from "@/components/lead/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { channelNameOf, daysBetween, describeVehicle, isOverdue, staffNameOf } from "@/lib/lead";
import type { LeadRow } from "@/lib/lead-types";
import { formatPhone } from "@/lib/phone";

/**
 * รายการ Lead ใช้ร่วมกันทั้งหน้ารายการ (1) และหน้าสอบถาม (3)
 *
 * จอเล็ก (มือถือ) แสดงเป็นการ์ดใบละกล่อง อ่านได้โดยไม่ต้องเลื่อนซ้าย-ขวา
 * จอ md ขึ้นไป แสดงเป็นตารางเต็มเพื่อเทียบหลายใบพร้อมกัน
 */
export default function LeadTable({
  rows,
  today,
  emptyText = "ยังไม่มีข้อมูล Lead",
}: {
  rows: LeadRow[];
  today: string;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const overdue = isOverdue(row, today);
          return (
            <li
              key={row.id}
              className={`rounded-xl border p-3 ${overdue ? "border-rose-300 bg-rose-50/40" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/leads/leads/${row.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {row.doc_no}
                  </Link>
                  <p className="truncate text-sm text-slate-700">{row.customer_name}</p>
                </div>
                <WorkStatusBadge status={row.work_status} />
              </div>

              <p className="mt-1 text-xs text-slate-600">{describeVehicle(row)}</p>

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                <div>
                  <dt className="text-slate-400">วันที่รับ Lead</dt>
                  <dd>{formatThaiDate(row.lead_date)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">เบอร์โทร</dt>
                  <dd>
                    {row.phone ? (
                      <a href={`tel:${row.phone}`} className="text-brand-600 hover:underline">
                        {formatPhone(row.phone)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">ช่องทาง</dt>
                  <dd className="truncate">{channelNameOf(row)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">พนักงานขาย</dt>
                  <dd className="truncate">{staffNameOf(row)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">นัดติดตามต่อ</dt>
                  <dd>{row.next_follow_date ? formatThaiDate(row.next_follow_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">ติดตามแล้ว</dt>
                  <dd>{row.follow_count} ครั้ง</dd>
                </div>
              </dl>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <ChanceBadge chance={row.chance} />
                {overdue && <OverdueBadge days={daysBetween(row.next_follow_date ?? today, today)} />}
                <Link
                  href={`/leads/follow/${row.id}`}
                  className="ml-auto text-xs text-brand-600 hover:underline"
                >
                  บันทึกผลติดตาม →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่ Lead</th>
              <th>วันที่</th>
              <th className="text-left">ลูกค้า</th>
              <th>เบอร์โทร</th>
              <th className="text-left">รถที่สนใจ</th>
              <th>ช่องทาง</th>
              <th>พนักงานขาย</th>
              <th>นัดติดตาม</th>
              <th>ติดตาม</th>
              <th>โอกาส</th>
              <th>สถานะงาน</th>
              <th className="no-print">บันทึกผล</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue = isOverdue(row, today);
              return (
                <tr key={row.id} className={overdue ? "bg-rose-50" : undefined}>
                  <td className="font-medium">
                    <Link href={`/leads/leads/${row.id}`} className="text-brand-600 hover:underline">
                      {row.doc_no}
                    </Link>
                  </td>
                  <td className="text-xs">{formatThaiDate(row.lead_date)}</td>
                  <td className="text-left">
                    {row.customer_name}
                    {row.branch_name && (
                      <div className="text-[11px] text-slate-400">สาขา {row.branch_name}</div>
                    )}
                  </td>
                  <td className="text-xs">{formatPhone(row.phone)}</td>
                  <td className="whitespace-normal text-left text-xs">{describeVehicle(row)}</td>
                  <td className="text-xs">{channelNameOf(row)}</td>
                  <td className="text-xs">{staffNameOf(row)}</td>
                  <td className="text-xs">
                    {row.next_follow_date ? (
                      <>
                        {formatThaiDate(row.next_follow_date)}
                        {overdue && (
                          <div className="text-[11px] font-medium text-rose-600">
                            เลยนัด {daysBetween(row.next_follow_date, today)} วัน
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="text-xs">{row.follow_count}</td>
                  <td>
                    <ChanceBadge chance={row.chance} />
                  </td>
                  <td>
                    <WorkStatusBadge status={row.work_status} />
                    {row.sale_contract_no && (
                      <div className="text-[11px] text-slate-400">
                        สัญญาขาย {row.sale_contract_no}
                      </div>
                    )}
                  </td>
                  <td className="no-print text-xs">
                    <Link href={`/leads/follow/${row.id}`} className="text-brand-600 hover:underline">
                      ติดตาม
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

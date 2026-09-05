import Link from "next/link";
import { OverdueBadge } from "@/components/lead/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { daysBetween, describeVehicle, isOverdue, staffNameOf } from "@/lib/lead";
import {
  CHANCE_BORDER_CLASS,
  CHANCE_DOT_CLASS,
  CHANCE_LABEL,
  WORK_STATUS_CLASS,
  WORK_STATUS_LABEL,
  type BoardColumnView,
} from "@/lib/lead-types";
import { formatPhone } from "@/lib/phone";

/**
 * กระดานติดตามการขาย (หน้าจอ 2)
 * แยกเป็นกลุ่มตามสถานะงาน แล้วซอยย่อยตามสถานะโอกาส (เขียว/เหลือง/แดง)
 * คลิกที่ใบไหนก็ไปหน้าบันทึกผลการติดตามของใบนั้นทันที
 *
 * มือถือเรียงกลุ่มลงมาทีละกลุ่ม · จอใหญ่วางเรียงกัน 2-4 คอลัมน์
 */
export default function LeadBoard({
  columns,
  today,
  showOwner,
}: {
  columns: BoardColumnView[];
  today: string;
  showOwner: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => (
        <section key={column.status} className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-800">{WORK_STATUS_LABEL[column.status]}</h2>
            <span className={`badge ${WORK_STATUS_CLASS[column.status]}`}>{column.total} ราย</span>
          </div>

          {column.total === 0 && <p className="text-sm text-slate-400">— ไม่มีรายการ —</p>}

          {column.groups
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.chance} className="space-y-2">
                <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${CHANCE_DOT_CLASS[group.chance]}`} />
                  โอกาส{CHANCE_LABEL[group.chance]} ({group.rows.length})
                </p>

                <ul className="space-y-2">
                  {group.rows.map((row) => {
                    const overdue = isOverdue(row, today);
                    return (
                      <li key={row.id}>
                        <Link
                          href={`/leads/follow/${row.id}`}
                          className={`block rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50/40 ${CHANCE_BORDER_CLASS[group.chance]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-slate-800">
                              {row.customer_name}
                            </p>
                            <span className="shrink-0 text-[11px] text-slate-400">{row.doc_no}</span>
                          </div>

                          <p className="mt-0.5 truncate text-xs text-slate-600">
                            {describeVehicle(row)}
                          </p>
                          <p className="text-xs text-slate-500">{formatPhone(row.phone)}</p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                            {row.next_follow_date ? (
                              overdue ? (
                                <OverdueBadge days={daysBetween(row.next_follow_date, today)} />
                              ) : (
                                <span>นัดติดตาม {formatThaiDate(row.next_follow_date)}</span>
                              )
                            ) : (
                              column.status === "follow_up" && (
                                <span className="text-amber-600">ยังไม่ได้นัดวันติดตาม</span>
                              )
                            )}
                            <span className="ml-auto">ติดตามแล้ว {row.follow_count} ครั้ง</span>
                          </div>

                          {showOwner && (
                            <p className="mt-1 truncate text-[11px] text-slate-400">
                              พนักงานขาย: {staffNameOf(row)}
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

import { ChanceBadge, WorkStatusBadge } from "@/components/lead/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import type { FollowUpRow } from "@/lib/lead-types";

/**
 * ไทม์ไลน์ประวัติการติดตามของ Lead หนึ่งใบ (ใบล่าสุดอยู่บนสุด)
 * แสดงว่าใครโทรเมื่อไหร่ ได้ผลอย่างไร และเปลี่ยนสถานะอะไรไปบ้าง
 */
export default function FollowUpList({
  rows,
  emptyText = "ยังไม่มีประวัติการติดตาม — กด “บันทึกผลติดตาม” เพื่อบันทึกครั้งแรก",
}: {
  rows: FollowUpRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              {formatThaiDate(row.follow_date)}
              <span className="ml-2 text-xs font-normal text-slate-400">{row.doc_no}</span>
            </p>
            <p className="text-xs text-slate-500">
              โดย {row.recorded_by_name ?? row.recorded_by_full_name ?? "—"}
            </p>
          </div>

          {row.detail && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.detail}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1">
            {row.work_status && <WorkStatusBadge status={row.work_status} />}
            {row.chance && <ChanceBadge chance={row.chance} />}
            {row.next_follow_date && (
              <span className="text-xs text-slate-500">
                นัดติดตามต่อ {formatThaiDate(row.next_follow_date)}
              </span>
            )}
            {row.sale_contract_no && (
              <span className="text-xs text-emerald-700">
                สัญญาขาย {row.sale_contract_no}
                {row.sale_date ? ` · ขายวันที่ ${formatThaiDate(row.sale_date)}` : ""}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

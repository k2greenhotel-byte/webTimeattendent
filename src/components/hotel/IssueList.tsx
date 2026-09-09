import Link from "next/link";
import { FixBadge, PriorityBadge } from "@/components/hotel/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { dueLabel, isOverdue, openDays, placeLabel } from "@/lib/hotel";
import {
  HTL_PRIORITY_LABEL,
  HTL_PRIORITY_ORDER,
  type HtlIssueRow,
} from "@/lib/hotel-types";

/** ลิงก์เปิดใบแจ้งซ่อมพร้อมเติมข้อมูลที่ตรวจพบให้เลย */
function repairHref(issue: HtlIssueRow): string {
  const query = new URLSearchParams({ item: issue.item_name });
  if (issue.company_id) query.set("company", issue.company_id);
  if (issue.branch_id) query.set("branch", issue.branch_id);
  query.set(
    "detail",
    [
      `พบจากการตรวจเช็คประจำวัน ${formatThaiDate(issue.check_date)}`,
      `สาขา ${issue.branch_name ?? "-"}`,
      issue.room_code ? `ห้อง ${issue.room_code}` : "",
      `หมวด ${issue.group_name}`,
      issue.note ?? "",
    ]
      .filter(Boolean)
      .join(" · "),
  );
  return `/procurement/repairs/new?${query}`;
}

/**
 * รายการข้อที่ตรวจแล้วไม่ปกติ — แก้ไขความเร่งด่วน ผูกใบแจ้งซ่อม และปิดงานได้ในที่เดียว
 * เป็นการ์ดแทนตาราง เพราะช่างเปิดจากมือถือหน้างานเป็นหลัก
 */
export default function IssueList({
  issues,
  today,
  canEdit,
  action,
  empty = "ไม่มีรายการที่ต้องแก้ไขตามเงื่อนไขนี้",
}: {
  issues: HtlIssueRow[];
  today: string;
  canEdit: boolean;
  action: (data: FormData) => void | Promise<void>;
  empty?: string;
}) {
  if (issues.length === 0) return <p className="card py-6 text-sm text-emerald-700">{empty}</p>;

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const overdue = isOverdue(issue, today);

        return (
          <section
            key={issue.result_id}
            className={`card space-y-3 ${overdue ? "border-rose-300" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{issue.item_name}</p>
                <p className="text-sm text-slate-500">
                  {issue.group_name} · {placeLabel(issue)}
                  {issue.company_name ? ` · ${issue.company_name}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  พบเมื่อ {formatThaiDate(issue.check_date)} ·{" "}
                  <Link
                    href={`/hotel/rounds/${issue.round_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {issue.doc_no}
                  </Link>
                  {issue.inspector_name ? ` · ผู้ตรวจ ${issue.inspector_name}` : ""}
                  {issue.photo_count > 0 ? ` · แนบรูป ${issue.photo_count} รูป` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <PriorityBadge priority={issue.priority} />
                <FixBadge isFixed={issue.is_fixed} />
                <span
                  className={`badge ${
                    overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {dueLabel(issue, today)}
                </span>
              </div>
            </div>

            {issue.note && (
              <p className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {issue.note}
              </p>
            )}

            {!issue.is_fixed && (
              <p className="text-xs text-slate-500">ค้างมาแล้ว {openDays(issue, today)} วัน</p>
            )}

            {canEdit ? (
              <form action={action} className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
                <input type="hidden" name="result_id" value={issue.result_id} />

                <div>
                  <label className="label" htmlFor={`prio-${issue.result_id}`}>
                    สถานะที่ต้องการแก้ไข
                  </label>
                  <select
                    id={`prio-${issue.result_id}`}
                    name="priority"
                    defaultValue={issue.priority ?? "soon"}
                    className="input"
                  >
                    {HTL_PRIORITY_ORDER.map((p) => (
                      <option key={p} value={p}>
                        {HTL_PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor={`repair-${issue.result_id}`}>
                    เลขที่ใบแจ้งขอซ่อม
                  </label>
                  <input
                    id={`repair-${issue.result_id}`}
                    name="repair_doc_no"
                    defaultValue={issue.repair_doc_no ?? ""}
                    className="input"
                    placeholder="เช่น RP-2569-0007"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`fixnote-${issue.result_id}`}>
                    บันทึกการแก้ไข
                  </label>
                  <input
                    id={`fixnote-${issue.result_id}`}
                    name="fixed_note"
                    defaultValue={issue.fixed_note ?? ""}
                    className="input"
                    placeholder="แก้ไขอย่างไร ใครเป็นคนแก้"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="is_fixed"
                      defaultChecked={issue.is_fixed}
                      className="h-4 w-4"
                    />
                    แก้ไขเรียบร้อยแล้ว
                  </label>

                  <a
                    href={repairHref(issue)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    เปิดใบแจ้งซ่อม ↗
                  </a>

                  {issue.repair_id && (
                    <Link href={`/procurement/repairs/${issue.repair_id}`} className="btn-secondary">
                      เปิดใบซ่อม {issue.repair_ref_no ?? ""}
                    </Link>
                  )}

                  <button type="submit" className="btn-primary ml-auto">
                    บันทึก
                  </button>
                </div>
              </form>
            ) : (
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                บัญชีนี้ดูได้อย่างเดียว — ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์แก้ไข
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

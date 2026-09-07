import PhotoGrid from "@/components/claim/PhotoGrid";
import { describeClaimUpdate } from "@/lib/claim";
import type { ClaimUpdateRow } from "@/lib/claim-types";
import { formatThaiDate } from "@/lib/datetime";

function DeleteButton({
  action,
  updateId,
  claimId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  updateId: string;
  claimId: string;
}) {
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={updateId} />
      <input type="hidden" name="claim_id" value={claimId} />
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        <input type="checkbox" name="confirm" />
        ยืนยัน
      </label>
      <button type="submit" className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
        ลบ
      </button>
    </form>
  );
}

/**
 * ประวัติการบันทึก Update งานเคลม (หน้าจอ 1.5 และประวัติในใบขอเคลม)
 * เรียงใหม่สุดอยู่บน — คนเปิดดูอยากรู้ว่า "ล่าสุดถึงไหนแล้ว" ก่อนเสมอ
 */
export default function ClaimUpdateList({
  rows,
  photos,
  showClaim = false,
  deleteAction,
  emptyText = "ยังไม่มีการบันทึก update",
}: {
  rows: ClaimUpdateRow[];
  /** รูปแนบของแต่ละแถว (ลำดับตรงกับ rows) — ไม่ส่งมาก็ได้ จะแสดงเป็นจำนวนรูปแทน */
  photos?: string[][];
  showClaim?: boolean;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <ul className="space-y-3">
      {rows.map((u, i) => (
        <li key={u.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-slate-800">{u.doc_no}</span>
            <span className="text-xs text-slate-500">{formatThaiDate(u.update_date)}</span>
          </div>

          {showClaim && (
            <p className="mt-1 text-sm text-slate-600">
              {u.claim_no} · {u.claim_chassis_no} · {u.claim_customer_name}
              {u.branch_name ? ` · ${u.branch_name}` : ""}
            </p>
          )}

          <p className="mt-1 text-sm text-slate-700">{describeClaimUpdate(u)}</p>
          {u.reject_reason && (
            <p className="mt-1 text-xs text-rose-600">เหตุผลไม่อนุมัติ: {u.reject_reason}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            ผู้บันทึก {u.recorded_by_name ?? u.recorded_by_full_name ?? "-"}
          </p>

          {photos && photos[i] && photos[i].length > 0 && (
            <div className="mt-2">
              <PhotoGrid paths={photos[i]} caption={`รูป update ${u.doc_no}`} />
            </div>
          )}
          {!photos && u.photo_count > 0 && (
            <p className="mt-2 text-xs text-slate-500">แนบรูป {u.photo_count} รูป</p>
          )}

          {deleteAction && (
            <div className="mt-2">
              <DeleteButton action={deleteAction} updateId={u.id} claimId={u.claim_id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

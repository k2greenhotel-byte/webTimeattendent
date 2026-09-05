import PhotoGrid from "@/components/procurement/PhotoGrid";
import { formatThaiDate } from "@/lib/datetime";
import { describeRepairUpdate } from "@/lib/procurement";
import type { RepairUpdateRow } from "@/lib/procurement-types";

function DeleteButton({
  action,
  updateId,
  repairId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  updateId: string;
  repairId: string;
}) {
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={updateId} />
      <input type="hidden" name="repair_id" value={repairId} />
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
 * ประวัติการบันทึก Update งานซ่อม (หน้าจอ 1.2 และประวัติในใบขอซ่อม)
 * จอเล็กเป็นการ์ด · จอ md ขึ้นไปเป็นตาราง
 */
export default function RepairUpdateList({
  rows,
  photos,
  showRepair = false,
  deleteAction,
  emptyText = "ยังไม่มีการบันทึก update",
}: {
  rows: RepairUpdateRow[];
  /** รูปแนบของแต่ละแถว (ลำดับตรงกับ rows) — ไม่ส่งมาก็ได้ จะแสดงเป็นจำนวนรูปแทน */
  photos?: string[][];
  showRepair?: boolean;
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

          {showRepair && (
            <p className="mt-1 text-sm text-slate-600">
              {u.repair_no} · {u.repair_item_name}
              {u.branch_name ? ` · ${u.branch_name}` : ""}
            </p>
          )}

          <p className="mt-1 text-sm text-slate-700">{describeRepairUpdate(u)}</p>
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
              <DeleteButton action={deleteAction} updateId={u.id} repairId={u.repair_id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

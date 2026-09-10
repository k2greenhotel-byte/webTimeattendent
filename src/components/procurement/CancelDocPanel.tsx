import { formatThaiDate } from "@/lib/datetime";
import type { PrDocStatus } from "@/lib/procurement-types";

/**
 * กล่องยกเลิก / ดึงกลับ ท้ายหน้าใบขอซ่อมและใบขอจัดซื้อ
 *
 * หน้าเว็บซ่อนปุ่มตามสิทธิ์เพื่อไม่ให้กดแล้วเจอ error เปล่า ๆ
 * แต่ตัวกฎจริงอยู่ที่ server action (validateCancel / validateRestore) เสมอ
 * ต่อให้ยิงฟอร์มตรงเข้ามาก็ยังผ่านด่านเดิม
 */
export default function CancelDocPanel({
  docId,
  docNo,
  docStatus,
  cancelledByName,
  cancelledAt,
  cancelReason,
  allowed,
  blockedReason,
  cancelAction,
  restoreAction,
  label,
}: {
  docId: string;
  docNo: string;
  docStatus: PrDocStatus;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** ผู้ใช้คนนี้กดยกเลิก (หรือดึงกลับ) ใบนี้ได้ไหม */
  allowed: boolean;
  /** ถ้ากดไม่ได้ ให้บอกเหตุผลไว้ จะได้รู้ว่าต้องไปหาใคร */
  blockedReason: string | null;
  cancelAction: (form: FormData) => Promise<void>;
  restoreAction: (form: FormData) => Promise<void>;
  /** "ใบขอซ่อม" หรือ "ใบขอจัดซื้อ" */
  label: string;
}) {
  const cancelled = docStatus === "cancelled";

  if (cancelled) {
    return (
      <section className="card space-y-2 border-rose-200">
        <h2 className="font-semibold text-rose-700">{label}นี้ถูกยกเลิกแล้ว</h2>
        <p className="text-sm text-slate-600">
          {cancelledByName ? `ยกเลิกโดย ${cancelledByName}` : "ยกเลิกแล้ว"}
          {cancelledAt ? ` เมื่อ ${formatThaiDate(cancelledAt.slice(0, 10))}` : ""}
          {cancelReason ? ` · เหตุผล: ${cancelReason}` : ""}
        </p>

        {allowed ? (
          <form action={restoreAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={docId} />
            <button type="submit" className="btn-secondary w-full sm:w-auto">
              ดึงกลับมาใช้งานใหม่
            </button>
            <span className="text-xs text-slate-500">
              เผื่อกดยกเลิกผิด จะได้ไม่ต้องเปิดใบใหม่ให้เลขที่เอกสารเดินเปล่า
            </span>
          </form>
        ) : (
          <p className="text-xs text-slate-500">{blockedReason}</p>
        )}
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="card space-y-1">
        <h2 className="font-semibold text-slate-700">ยกเลิก{label}นี้</h2>
        <p className="text-sm text-slate-500">{blockedReason}</p>
      </section>
    );
  }

  return (
    <section className="card space-y-3 border-amber-200">
      <div>
        <h2 className="font-semibold text-amber-700">ยกเลิก{label}นี้</h2>
        <p className="text-sm text-slate-600">
          ยกเลิกแล้วเอกสารยังอยู่ในระบบและยังค้นเจอ แต่จะไม่ถูกนับในยอดรวมและอนุมัติต่อไม่ได้
        </p>
      </div>

      <form action={cancelAction} className="space-y-3">
        <input type="hidden" name="id" value={docId} />
        <div>
          <label className="label" htmlFor="cancel_reason">
            เหตุผลที่ยกเลิก *
          </label>
          <input
            id="cancel_reason"
            name="cancel_reason"
            className="input"
            placeholder="เช่น แจ้งซ้ำกับใบก่อนหน้า / ซ่อมเองได้แล้ว / พิมพ์ผิดทั้งใบ"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="confirm" />
            ยืนยันยกเลิก{label} {docNo}
          </label>
          <button type="submit" className="btn-danger w-full sm:w-auto">
            ยกเลิก{label}
          </button>
        </div>
      </form>
    </section>
  );
}

import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import type { ShiftSwapRequest } from "@/lib/types";
import { cancelSwapRequestForm, confirmSwapRequestForm, rejectSwapRequestForm } from "@/app/punch/swap/actions";

/**
 * การ์ด "สลับกะ" บนหน้าลงเวลา
 * แสดงคำขอที่รอเราตัดสินใจ (partner) และคำขอที่เราส่งไปรออีกฝ่ายยืนยัน (requester)
 * ยืนยันแล้วมีผลกับตารางเวรทันที ระบบสลับให้อัตโนมัติ
 */
export default function ShiftSwapCard({
  pendingForMe,
  pendingSentByMe,
}: {
  pendingForMe: ShiftSwapRequest[];
  pendingSentByMe: ShiftSwapRequest[];
}) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">สลับกะ / สลับวันหยุด</p>
          <p className="text-xs text-slate-500">ตกลงกับเพื่อนร่วมงานแล้วบันทึกที่นี่ — มีผลก็ต่อเมื่อทั้งสองฝ่ายยืนยัน</p>
        </div>
        <Link href="/punch/swap/new" className="btn-secondary whitespace-nowrap text-sm">
          + ขอสลับกะ
        </Link>
      </div>

      {pendingForMe.length === 0 && pendingSentByMe.length === 0 && (
        <p className="text-sm text-slate-500">ไม่มีคำขอสลับกะที่ค้างอยู่</p>
      )}

      {pendingForMe.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-700">รอคุณยืนยัน</p>
          {pendingForMe.map((r) => (
            <div key={r.id} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
              <p className="text-sm text-slate-800">
                <span className="font-medium">
                  {r.requester_name} ({r.requester_emp_code})
                </span>{" "}
                ขอสลับกะกับคุณ
              </p>
              <p className="mt-1 text-xs text-slate-600">
                วันที่ {formatThaiDate(r.requester_date)} ของเขา ↔ วันที่ {formatThaiDate(r.partner_date)} ของคุณ
              </p>
              {r.note && <p className="mt-1 text-xs text-slate-500">หมายเหตุ: {r.note}</p>}
              <div className="mt-2 flex gap-2">
                <form action={confirmSwapRequestForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn-primary px-4 py-2 text-sm">
                    ยืนยันสลับกะ
                  </button>
                </form>
                <form action={rejectSwapRequestForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn-secondary px-4 py-2 text-sm">
                    ปฏิเสธ
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingSentByMe.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">คำขอที่คุณส่งไป (รอเขายืนยัน)</p>
          {pendingSentByMe.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-3">
              <p className="text-sm text-slate-800">
                ขอสลับกับ{" "}
                <span className="font-medium">
                  {r.partner_name} ({r.partner_emp_code})
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                วันที่ {formatThaiDate(r.requester_date)} ของคุณ ↔ วันที่ {formatThaiDate(r.partner_date)} ของเขา
              </p>
              <div className="mt-2">
                <form action={cancelSwapRequestForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn-secondary px-4 py-2 text-sm">
                    ยกเลิกคำขอ
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

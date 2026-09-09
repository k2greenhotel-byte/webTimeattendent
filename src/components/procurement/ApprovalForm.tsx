import { formatBaht } from "@/lib/procurement";
import {
  APPROVE_DECISION_ORDER,
  APPROVE_STATUS_LABEL,
  REJECT_REASON_LABEL,
  REJECT_REASON_ORDER,
  type PrDocRow,
} from "@/lib/procurement-types";

/**
 * ฟอร์มบันทึกผลการอนุมัติหนึ่งใบ (หน้าจอ 3.1)
 * ผู้อนุมัติผ่านประตูรหัสผ่านมาแล้วก่อนถึงหน้านี้ จึงไม่ต้องถามรหัสซ้ำอีกรอบ
 *
 * ใช้ได้ทั้งการพิจารณาครั้งแรกและการแก้ไขผลเดิม (เปลี่ยนใจ)
 * การแก้ไขไม่ได้ทับใบอนุมัติเดิม แต่บันทึกใบอนุมัติใบใหม่แล้วผลักผลขึ้นเอกสาร
 * ประวัติการพิจารณาทุกครั้งจึงยังอยู่ครบ ตรวจย้อนหลังได้ว่าใครเปลี่ยนอะไรเมื่อไหร่
 */
export default function ApprovalForm({
  doc,
  approverName,
  action,
  /** true = เอกสารนี้เคยมีผลอนุมัติแล้ว กำลังแก้ไขเพื่อเปลี่ยนใจ */
  editing = false,
}: {
  doc: PrDocRow;
  approverName: string;
  action: (formData: FormData) => void | Promise<void>;
  editing?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // ตอนแก้ไข ตั้งค่าเริ่มต้นเป็นผลเดิม ผู้อนุมัติจะได้เห็นว่ากำลังเปลี่ยนจากอะไร
  const defaultDecision =
    editing && doc.approve_status !== "pending" ? doc.approve_status : "approved";
  const defaultAmount =
    editing && doc.approved_amount > 0 ? doc.approved_amount : doc.requested_amount;

  // จ่ายเงินไปแล้วจะถอนอนุมัติไม่ได้ — บอกไว้บนฟอร์มเลย ไม่ต้องรอกดแล้วเด้ง error
  const paidLocked = doc.actual_amount > 0;

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="kind" value={doc.kind} />
      <input type="hidden" name="doc_id" value={doc.id} />

      {editing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            กำลังแก้ไขผลการพิจารณาเดิม — ปัจจุบันคือ “{APPROVE_STATUS_LABEL[doc.approve_status]}”
            {doc.approval_no ? ` ตามใบอนุมัติ ${doc.approval_no}` : ""}
          </p>
          <p className="mt-1 text-xs">
            บันทึกแล้วระบบจะออกใบอนุมัติใบใหม่ทับผลเดิม (ใบเก่ายังอยู่ในประวัติการพิจารณา)
            {paidLocked
              ? " · เอกสารนี้จ่ายเงินไปแล้ว เปลี่ยนเป็นไม่อนุมัติไม่ได้ ต้องไปลบใบเบิกจ่ายก่อน"
              : ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบอนุมัติ</label>
          <input
            value={editing ? (doc.approval_no ?? "") : ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder={editing ? "ระบบออกเลขใหม่ตอนบันทึก" : "ระบบออกให้ตอนบันทึก"}
          />
        </div>
        <div>
          <label className="label" htmlFor="approve_date">
            วันที่ *
          </label>
          <input
            id="approve_date"
            name="approve_date"
            type="date"
            defaultValue={today}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">ผู้อนุมัติ</label>
          <input value={approverName} readOnly disabled className="input bg-slate-50 text-slate-600" />
        </div>
        <div>
          <label className="label">อ้างอิงเอกสาร</label>
          <input value={doc.doc_no} readOnly disabled className="input bg-slate-50 text-slate-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="decision">
            ผลการพิจารณา *
          </label>
          <select
            id="decision"
            name="decision"
            defaultValue={defaultDecision}
            className="input"
            required
          >
            {APPROVE_DECISION_ORDER.map((d) => (
              <option key={d} value={d} disabled={paidLocked && d !== "approved"}>
                {APPROVE_STATUS_LABEL[d]}
                {paidLocked && d !== "approved" ? " (จ่ายเงินแล้ว เลือกไม่ได้)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="approved_amount">
            จำนวนเงินที่อนุมัติเบิก
          </label>
          <input
            id="approved_amount"
            name="approved_amount"
            defaultValue={String(defaultAmount)}
            className="input"
            inputMode="decimal"
          />
          <p className="mt-1 text-xs text-slate-400">
            ขอเบิกมา {formatBaht(doc.requested_amount)} · อนุมัติเกินยอดที่ขอไม่ได้
            {paidLocked ? ` · จ่ายไปแล้ว ${formatBaht(doc.actual_amount)} ลดต่ำกว่านี้ไม่ได้` : ""}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="reject_reason">
            สาเหตุของการไม่อนุมัติ
          </label>
          <select
            id="reject_reason"
            name="reject_reason"
            defaultValue={doc.reject_reason ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุ —</option>
            {REJECT_REASON_ORDER.map((r) => (
              <option key={r} value={r}>
                {REJECT_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          บันทึกเพิ่มเติม / เหตุผลไม่อนุมัติ
        </label>
        <textarea
          id="note"
          name="note"
          className="input min-h-20"
          rows={2}
          placeholder="เช่น ราคาสูงกว่าที่เคยซ่อม ให้ไปขอใบเสนอราคาอีก 2 ร้านมาเทียบ"
        />
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        เลือก “ไม่อนุมัติ” ต้องเลือกสาเหตุด้วย · เลือก “ให้ตรวจสอบราคา/หารายใหม่มาเทียบ”
        เอกสารจะกลับไปสถานะรออนุมัติเพื่อให้ผู้ขอแก้ไขราคาแล้วยื่นเข้ามาใหม่
      </p>

      <button type="submit" className="btn-primary w-full sm:w-auto">
        {editing ? "บันทึกผลการพิจารณาใหม่" : "บันทึกผลการอนุมัติ"}
      </button>
    </form>
  );
}

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
 */
export default function ApprovalForm({
  doc,
  approverName,
  action,
}: {
  doc: PrDocRow;
  approverName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="kind" value={doc.kind} />
      <input type="hidden" name="doc_id" value={doc.id} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบอนุมัติ</label>
          <input
            value=""
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
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
          <select id="decision" name="decision" defaultValue="approved" className="input" required>
            {APPROVE_DECISION_ORDER.map((d) => (
              <option key={d} value={d}>
                {APPROVE_STATUS_LABEL[d]}
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
            defaultValue={String(doc.requested_amount)}
            className="input"
            inputMode="decimal"
          />
          <p className="mt-1 text-xs text-slate-400">
            ขอเบิกมา {formatBaht(doc.requested_amount)} · อนุมัติเกินยอดที่ขอไม่ได้
          </p>
        </div>
        <div>
          <label className="label" htmlFor="reject_reason">
            สาเหตุของการไม่อนุมัติ
          </label>
          <select id="reject_reason" name="reject_reason" defaultValue="" className="input">
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
        บันทึกผลการอนุมัติ
      </button>
    </form>
  );
}

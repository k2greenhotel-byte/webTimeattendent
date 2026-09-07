import Link from "next/link";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatBaht } from "@/lib/claim";
import {
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_JOB_STATUS_ORDER,
  CLAIM_MAX_PHOTOS,
  type ClaimRow,
} from "@/lib/claim-types";
import { formatThaiDate } from "@/lib/datetime";

/**
 * ฟอร์มบันทึก Update งานเคลม (หน้าจอ 1.5)
 * ช่องที่เว้นว่างไว้ = ไม่เปลี่ยนของเดิม จึงไม่ต้องกรอกซ้ำทุกครั้งที่ update
 */
export default function ClaimUpdateForm({
  claims,
  defaultClaimId,
  defaultRecorderName,
  action,
}: {
  claims: ClaimRow[];
  defaultClaimId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const selected = claims.find((c) => c.id === defaultClaimId) ?? null;

  if (claims.length === 0) {
    return (
      <p className="card text-sm text-slate-600">
        ยังไม่มีใบขอเคลมที่เปิดอยู่ในระบบ —{" "}
        <Link href="/claim/claims/new" className="text-brand-600 hover:underline">
          บันทึกแจ้งเคลมใบแรกก่อน
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="card space-y-5">
      {/* ---------- 1.5.1-1.5.3 ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบ Update</label>
          <input
            value=""
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="update_date">
            วันที่ *
          </label>
          <input
            id="update_date"
            name="update_date"
            type="date"
            defaultValue={today}
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="claim_id">
            อ้างอิงเลขที่ใบขอเคลม *
          </label>
          <select
            id="claim_id"
            name="claim_id"
            defaultValue={defaultClaimId ?? ""}
            className="input"
            required
          >
            <option value="">— เลือกใบขอเคลม —</option>
            {claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.doc_no} · {c.chassis_no} · {c.customer_name}
                {c.branch_name ? ` · ${c.branch_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-medium">{selected.doc_no}</span> · แจ้งเมื่อ{" "}
          {formatThaiDate(selected.claim_date)} · สถานะปัจจุบัน{" "}
          {CLAIM_JOB_STATUS_LABEL[selected.job_status]} · ขออนุมัติ{" "}
          {formatBaht(selected.requested_amount)}
          {selected.item_summary ? ` · ${selected.item_summary}` : ""}
        </div>
      )}

      {/* ---------- 1.5.4-1.5.8 ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="job_status">
            บันทึกสถานะงาน
          </label>
          <select id="job_status" name="job_status" defaultValue="" className="input">
            <option value="">— ไม่เปลี่ยนสถานะ —</option>
            {CLAIM_JOB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CLAIM_JOB_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expected_done_date">
            วันที่คาดว่าจะดำเนินการซ่อมเสร็จ
          </label>
          <input id="expected_done_date" name="expected_done_date" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="requested_amount">
            จำนวนเงินที่ขออนุมัติ
          </label>
          <input
            id="requested_amount"
            name="requested_amount"
            className="input"
            inputMode="decimal"
            placeholder="เว้นว่างไว้ = ไม่เปลี่ยน"
          />
        </div>
        <div>
          <label className="label" htmlFor="recorded_by_name">
            ผู้บันทึก
          </label>
          <input
            id="recorded_by_name"
            name="recorded_by_name"
            defaultValue={defaultRecorderName ?? ""}
            className="input"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="detail">
            บันทึกรายละเอียดเพิ่มเติม
          </label>
          <textarea
            id="detail"
            name="detail"
            className="input min-h-20"
            rows={3}
            placeholder="เช่น ส่งเรื่องให้ตัวแทนแล้ว รอผลอนุมัติภายใน 3 วัน"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="reject_reason">
            เหตุผลไม่อนุมัติ
          </label>
          <input
            id="reject_reason"
            name="reject_reason"
            className="input"
            placeholder="กรอกเมื่อเลือกสถานะ “ไม่อนุมัติ”"
          />
        </div>
      </div>

      {/* ---------- 1.5.10-1.5.13 งานซ่อมในศูนย์บริการ ---------- */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <h3 className="font-semibold text-slate-800">
            งานซ่อม (Job) <span className="font-normal text-slate-400">— กรอกเมื่อเปิด job แล้ว</span>
          </h3>
        </div>
        <div>
          <label className="label" htmlFor="job_no">
            เลขที่ Job no
          </label>
          <input
            id="job_no"
            name="job_no"
            className="input"
            placeholder="เลขที่ job ของศูนย์บริการ"
            maxLength={40}
          />
        </div>
        <div>
          <label className="label" htmlFor="job_open_date">
            วันที่เปิด job
          </label>
          <input id="job_open_date" name="job_open_date" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="job_close_date">
            วันที่ปิด job
          </label>
          <input id="job_close_date" name="job_close_date" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="job_deliver_date">
            วันที่ส่งมอบงาน / ปิด job
          </label>
          <input id="job_deliver_date" name="job_deliver_date" type="date" className="input" />
        </div>
      </div>

      {/* ---------- 1.5.9 ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปงานที่กำลังซ่อมหรือซ่อมเสร็จแล้ว"
          hint={`แนบได้สูงสุด ${CLAIM_MAX_PHOTOS} รูป`}
          max={CLAIM_MAX_PHOTOS}
          prefix="update"
          endpoint="/api/claim/photo"
        />
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        เลขที่ Job และวันที่ของ job ที่กรอกไว้จะถูกยกไปแสดงบนใบขอเคลมเป็นค่าล่าสุด (กรอกใหม่ = ทับของเดิม) ·
        บันทึกสถานะ “อนุมัติ” หรือ “ไม่อนุมัติ” ระบบจะลงวันที่แจ้งผลการอนุมัติ (1.4.21) ให้อัตโนมัติ ·
        บันทึก “แก้ไขเรียบร้อย” จะลงวันที่ซ่อมเสร็จ (1.4.22) ให้ — ทั้งสองกรณีเติมเฉพาะตอนที่ใบขอเคลม
        ยังไม่มีวันที่นั้น ค่าที่กรอกไว้เองจะไม่ถูกทับ · ช่องที่เว้นว่างจะไม่ไปทับค่าเดิมบนใบขอเคลม
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          บันทึก Update
        </button>
        <Link href="/claim/updates" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

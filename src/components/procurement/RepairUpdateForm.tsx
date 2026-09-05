import Link from "next/link";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_ORDER,
  MAX_PHOTOS,
  type PrDocRow,
} from "@/lib/procurement-types";

/**
 * ฟอร์มบันทึก Update งานซ่อม (หน้าจอ 1.2)
 * ช่องสถานะที่เว้นว่างไว้ = ไม่เปลี่ยนของเดิม จึงไม่ต้องกรอกซ้ำทุกครั้งที่ update
 */
export default function RepairUpdateForm({
  repairs,
  defaultRepairId,
  defaultRecorderName,
  action,
}: {
  repairs: PrDocRow[];
  defaultRepairId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const selected = repairs.find((r) => r.id === defaultRepairId) ?? null;

  if (repairs.length === 0) {
    return (
      <p className="card text-sm text-slate-600">
        ยังไม่มีใบขอซ่อมที่เปิดอยู่ในระบบ —{" "}
        <Link href="/procurement/repairs/new" className="text-brand-600 hover:underline">
          บันทึกแจ้งซ่อมใบแรกก่อน
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="card space-y-5">
      {/* ---------- 1.2.1-1.2.3 ---------- */}
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
          <label className="label" htmlFor="repair_id">
            อ้างอิงเลขที่ใบขอซ่อม *
          </label>
          <select
            id="repair_id"
            name="repair_id"
            defaultValue={defaultRepairId ?? ""}
            className="input"
            required
          >
            <option value="">— เลือกใบขอซ่อม —</option>
            {repairs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.doc_no} · {r.item_name}
                {r.branch_name ? ` · ${r.branch_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-medium">{selected.doc_no}</span> · แจ้งเมื่อ{" "}
          {formatThaiDate(selected.doc_date)} · สถานะปัจจุบัน{" "}
          {selected.job_status ? JOB_STATUS_LABEL[selected.job_status] : "—"} · ขอเบิก{" "}
          {formatBaht(selected.requested_amount)}
        </div>
      )}

      {/* ---------- 1.2.4-1.2.8 ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="job_status">
            บันทึกสถานะงาน
          </label>
          <select id="job_status" name="job_status" defaultValue="" className="input">
            <option value="">— ไม่เปลี่ยนสถานะ —</option>
            {JOB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expected_done_date">
            วันที่คาดว่าจะซ่อมเสร็จ
          </label>
          <input
            id="expected_done_date"
            name="expected_done_date"
            type="date"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="requested_amount">
            จำนวนเงินที่ขออนุมัติซ่อม
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
            placeholder="เช่น ช่างเข้ามาดูแล้ว ต้องสั่งอะไหล่ รออีก 3 วัน"
          />
        </div>
      </div>

      {/* ---------- 1.2.9 ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปงานที่กำลังซ่อมหรือซ่อมเสร็จแล้ว"
          hint={`แนบได้สูงสุด ${MAX_PHOTOS} รูป`}
          max={MAX_PHOTOS}
          prefix="update"
          endpoint="/api/procurement/photo"
        />
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        บันทึกสถานะเป็น “ได้รับการแก้ไขแล้ว” ระบบจะลงวันที่ที่ได้รับการแก้ไขบนใบขอซ่อมให้อัตโนมัติ
        (ถ้าใบขอซ่อมยังไม่มีวันที่นั้น) · ช่องที่เว้นว่างไว้จะไม่ไปทับค่าเดิมบนใบขอซ่อม
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          บันทึก Update
        </button>
        <Link href="/procurement/updates" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

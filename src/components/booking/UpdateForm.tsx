import Link from "next/link";
import FileUploader from "@/components/marketing/FileUploader";
import { bookingOptionLabel } from "@/lib/booking";
import {
  BOOKING_FILE_ACCEPT,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_ORDER,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
  FILE_KIND_LABEL,
  RECEIPT_FILE_KINDS,
  REFUND_FILE_KINDS,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
  type BookingRow,
} from "@/lib/booking-types";

const UPLOAD_ENDPOINT = "/api/booking/file";

/**
 * ฟอร์มบันทึก Update สถานะใบจอง (หน้าจอ 1.2)
 * ช่องสถานะเว้นว่างไว้ = ไม่เปลี่ยน ระบบจะคงค่าเดิมของใบจองไว้
 */
export default function UpdateForm({
  bookings,
  selected,
  defaultRecorderName,
  action,
}: {
  bookings: BookingRow[];
  selected?: BookingRow | null;
  defaultRecorderName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ Update</label>
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
          <label className="label" htmlFor="recorded_by_name">
            ชื่อผู้บันทึก *
          </label>
          <input
            id="recorded_by_name"
            name="recorded_by_name"
            defaultValue={defaultRecorderName}
            className="input"
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="booking_id">
          อ้างอิงเลขที่ใบจอง *
        </label>
        <select
          id="booking_id"
          name="booking_id"
          defaultValue={selected?.id ?? ""}
          className="input"
          required
        >
          <option value="">— เลือกใบจอง —</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {bookingOptionLabel(b)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          รายการแสดงใบจองที่ยังไม่ปิดงาน เรียงจากใบล่าสุด
        </p>
      </div>

      {/* ---------- สถานะที่ต้องการบันทึก ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="vehicle_status">
            บันทึกสถานะรถ
          </label>
          <select id="vehicle_status" name="vehicle_status" defaultValue="" className="input">
            <option value="">— ไม่เปลี่ยน —</option>
            {VEHICLE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="contract_status">
            บันทึกสถานะสัญญา
          </label>
          <select id="contract_status" name="contract_status" defaultValue="" className="input">
            <option value="">— ไม่เปลี่ยน —</option>
            {CONTRACT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="booking_status">
            บันทึกสถานะการจอง
          </label>
          <select id="booking_status" name="booking_status" defaultValue="" className="input">
            <option value="">— ไม่เปลี่ยน —</option>
            {BOOKING_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cancel_reason">
            บันทึกสาเหตุของการยกเลิก
          </label>
          <select id="cancel_reason" name="cancel_reason" defaultValue="" className="input">
            <option value="">— ไม่ระบุ —</option>
            {CANCEL_REASON_ORDER.map((r) => (
              <option key={r} value={r}>
                {CANCEL_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- ปิดงาน: สัญญาขาย หรือ คืนเงิน ---------- */}
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h3 className="font-medium text-slate-700">ปิดงานใบจอง</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="sale_contract_no">
              เลขที่สัญญาขาย
            </label>
            <input
              id="sale_contract_no"
              name="sale_contract_no"
              className="input"
              placeholder="เช่น SO-6900123"
            />
          </div>
          <div>
            <label className="label" htmlFor="sale_date">
              วันที่ขาย
            </label>
            <input id="sale_date" name="sale_date" type="date" className="input" />
          </div>
          <label className="flex items-end gap-2 pb-2.5 text-sm text-slate-600">
            <input type="checkbox" name="refunded" />
            บันทึกคืนเงินลูกค้าแล้ว
          </label>
        </div>
        <p className="text-xs text-slate-500">
          บันทึกเลขที่สัญญาขาย หรือ ติ๊กคืนเงินลูกค้า → สถานะเอกสารของใบจองจะเปลี่ยนเป็น “ปิดงาน” อัตโนมัติ
          (ข้อ 1.2.13)
        </p>
      </div>

      {/* ---------- เอกสารแนบ ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <h3 className="font-medium text-slate-700">บันทึกแนบเอกสารรับเงิน</h3>
          {RECEIPT_FILE_KINDS.map((kind) => (
            <FileUploader
              key={kind}
              name={`file_${kind}`}
              label={FILE_KIND_LABEL[kind]}
              max={5}
              endpoint={UPLOAD_ENDPOINT}
              accept={BOOKING_FILE_ACCEPT}
            />
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <h3 className="font-medium text-slate-700">บันทึกแนบเอกสารคืนเงิน</h3>
          {REFUND_FILE_KINDS.map((kind) => (
            <FileUploader
              key={kind}
              name={`file_${kind}`}
              label={FILE_KIND_LABEL[kind]}
              max={5}
              endpoint={UPLOAD_ENDPOINT}
              accept={BOOKING_FILE_ACCEPT}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" className="input" placeholder="รายละเอียดเพิ่มเติมของการ update" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          บันทึก Update
        </button>
        <Link href="/booking/updates" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

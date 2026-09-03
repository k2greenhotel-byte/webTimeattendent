import Link from "next/link";
import CustomerPicker, { type CustomerBrief } from "@/components/booking/CustomerPicker";
import VehiclePicker from "@/components/booking/VehiclePicker";
import FileUploader from "@/components/marketing/FileUploader";
import { formatBaht } from "@/lib/booking";
import {
  BOOKING_FILE_ACCEPT,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_ORDER,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
  DOC_STATUS_LABEL,
  FILE_KIND_LABEL,
  PURCHASE_TYPE_LABEL,
  PURCHASE_TYPE_ORDER,
  RECEIPT_FILE_KINDS,
  REFUND_FILE_KINDS,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
  type BookingFile,
  type BookingFileKind,
  type BookingRow,
} from "@/lib/booking-types";
import type { MotoOption } from "@/lib/moto-types";
import type { Branch } from "@/lib/types";

const UPLOAD_ENDPOINT = "/api/booking/file";

/** ไฟล์ของชนิดหนึ่ง ในรูปแบบที่ FileUploader ต้องการ */
function filesOfKind(files: BookingFile[], kind: BookingFileKind) {
  return files
    .filter((f) => f.kind === kind)
    .map((f) => ({ path: f.path, filename: f.filename, mime: f.mime, size: f.size_bytes }));
}

/** ฟอร์มใบจองรถ (หน้าจอ 1.1) ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข */
export default function BookingForm({
  booking,
  customer,
  files = [],
  branches,
  brands,
  models,
  variants,
  colors,
  defaultBranchId,
  action,
  submitLabel,
}: {
  booking?: BookingRow | null;
  customer?: CustomerBrief | null;
  files?: BookingFile[];
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  variants: MotoOption[];
  colors: MotoOption[];
  defaultBranchId?: string | null;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-5">
      {booking && <input type="hidden" name="id" value={booking.id} />}

      {/* ---------- หัวเอกสาร ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบจอง</label>
          <input
            value={booking?.doc_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขาที่รับจอง
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={booking?.branch_id ?? defaultBranchId ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุสาขา —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ref_no">
            เลขที่อ้างอิง
          </label>
          <input
            id="ref_no"
            name="ref_no"
            defaultValue={booking?.ref_no ?? ""}
            className="input"
            placeholder="เลขที่เอกสารของร้าน (คีย์เอง)"
          />
        </div>
        <div>
          <label className="label" htmlFor="booking_date">
            วันที่ *
          </label>
          <input
            id="booking_date"
            name="booking_date"
            type="date"
            defaultValue={booking?.booking_date ?? today}
            className="input"
            required
          />
        </div>
      </div>

      {/* ---------- ลูกค้า ---------- */}
      <CustomerPicker defaultCustomer={customer ?? null} defaultPhone={booking?.customer_phone} />

      {/* ---------- รถที่จอง ---------- */}
      <VehiclePicker
        brands={brands}
        models={models}
        variants={variants}
        colors={colors}
        defaults={{
          brand_id: booking?.brand_id ?? null,
          model_id: booking?.model_id ?? null,
          variant_id: booking?.variant_id ?? null,
          color_id: booking?.color_id ?? null,
        }}
      />

      {/* ---------- เงื่อนไขการซื้อ ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="purchase_type">
            ประเภทการซื้อ
          </label>
          <select
            id="purchase_type"
            name="purchase_type"
            defaultValue={booking?.purchase_type ?? "installment"}
            className="input"
          >
            {PURCHASE_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {PURCHASE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pickup_date">
            วันที่นัดรับรถ
          </label>
          <input
            id="pickup_date"
            name="pickup_date"
            type="date"
            defaultValue={booking?.pickup_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="vehicle_status">
            สถานะรถ
          </label>
          <select
            id="vehicle_status"
            name="vehicle_status"
            defaultValue={booking?.vehicle_status ?? "in_stock"}
            className="input"
          >
            {VEHICLE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="deposit_amount">
            จำนวนเงินที่มัดจำ
          </label>
          <input
            id="deposit_amount"
            name="deposit_amount"
            defaultValue={booking ? String(booking.deposit_amount) : ""}
            className="input"
            inputMode="decimal"
            placeholder="3000"
          />
          {booking && (
            <p className="mt-1 text-xs text-slate-400">ปัจจุบัน {formatBaht(booking.deposit_amount)}</p>
          )}
        </div>
      </div>

      {/* ---------- สถานะเอกสาร ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="receipt_no">
            เลขที่ใบเสร็จรับเงิน
          </label>
          <input
            id="receipt_no"
            name="receipt_no"
            defaultValue={booking?.receipt_no ?? ""}
            className="input"
            placeholder="คีย์เอง"
          />
        </div>
        <div>
          <label className="label" htmlFor="contract_status">
            สถานะสัญญา
          </label>
          <select
            id="contract_status"
            name="contract_status"
            defaultValue={booking?.contract_status ?? "pending"}
            className="input"
          >
            {CONTRACT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="booking_status">
            สถานะการจอง
          </label>
          <select
            id="booking_status"
            name="booking_status"
            defaultValue={booking?.booking_status ?? "wait_contract"}
            className="input"
          >
            {BOOKING_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cancel_reason">
            สาเหตุของการยกเลิก
          </label>
          <select
            id="cancel_reason"
            name="cancel_reason"
            defaultValue={booking?.cancel_reason ?? ""}
            className="input"
          >
            <option value="">— ไม่ยกเลิก —</option>
            {CANCEL_REASON_ORDER.map((r) => (
              <option key={r} value={r}>
                {CANCEL_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="font-medium">สถานะเอกสาร</span> ระบบคำนวณให้เอง:{" "}
        {booking ? DOC_STATUS_LABEL[booking.doc_status] : DOC_STATUS_LABEL.active} — บันทึกเลขที่สัญญาขาย
        หรือคืนเงินลูกค้าแล้วจะเป็น “ปิดงาน” · สถานะการจองเป็น “ยกเลิกไม่รับรถแล้ว” จะเป็น “ยกเลิก”
        · นอกนั้นเป็น “ใช้งาน”
      </p>

      {/* ---------- เอกสารแนบ ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <h3 className="font-medium text-slate-700">เอกสารรับเงิน</h3>
          {RECEIPT_FILE_KINDS.map((kind) => (
            <FileUploader
              key={kind}
              name={`file_${kind}`}
              label={FILE_KIND_LABEL[kind]}
              max={5}
              endpoint={UPLOAD_ENDPOINT}
              accept={BOOKING_FILE_ACCEPT}
              initialFiles={filesOfKind(files, kind)}
            />
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <h3 className="font-medium text-slate-700">เอกสารคืนเงิน</h3>
          {REFUND_FILE_KINDS.map((kind) => (
            <FileUploader
              key={kind}
              name={`file_${kind}`}
              label={FILE_KIND_LABEL[kind]}
              max={5}
              endpoint={UPLOAD_ENDPOINT}
              accept={BOOKING_FILE_ACCEPT}
              initialFiles={filesOfKind(files, kind)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={booking?.note ?? ""} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href="/booking/bookings" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

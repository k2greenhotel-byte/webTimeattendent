import Link from "next/link";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import AddressPicker from "@/components/customers/AddressPicker";
import type { Customer } from "@/lib/customer-db";
import { formatNationalId, type GeoRow } from "@/lib/customers";

/** ฟอร์มประวัติลูกค้า ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข */
export default function CustomerForm({
  customer,
  geo,
  suggestedCode,
  action,
  submitLabel,
}: {
  customer?: Customer | null;
  geo?: GeoRow | null;
  suggestedCode?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {customer?.branch_id && <input type="hidden" name="branch_id" value={customer.branch_id} />}
      {customer?.company_id && <input type="hidden" name="company_id" value={customer.company_id} />}

      {/* ---------- ข้อมูลหลัก ---------- */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">รหัสลูกค้า *</label>
          <input
            name="code"
            defaultValue={customer?.code ?? suggestedCode ?? ""}
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ชื่อลูกค้า *</label>
          <input
            name="full_name"
            defaultValue={customer?.full_name ?? ""}
            className="input"
            placeholder="นายสมชาย ใจดี"
            required
          />
        </div>
        <div>
          <label className="label">เบอร์โทร</label>
          <input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            className="input"
            inputMode="numeric"
            placeholder="0812345678"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">เลขที่บัตรประชาชน</label>
          <input
            name="national_id"
            defaultValue={customer?.national_id ? formatNationalId(customer.national_id) : ""}
            className="input"
            inputMode="numeric"
            placeholder="1-2345-67890-12-3"
          />
          <p className="mt-1 text-xs text-slate-400">ใส่ขีดหรือไม่ใส่ก็ได้ ระบบตรวจความถูกต้องให้</p>
        </div>
        <div>
          <label className="label">วันเกิด</label>
          <input
            name="birth_date"
            type="date"
            defaultValue={customer?.birth_date ?? ""}
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" name="is_active" defaultChecked={customer?.is_active ?? true} />
          ลูกค้ายังใช้งานอยู่
        </label>
      </div>

      {/* ---------- ที่อยู่ ---------- */}
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h3 className="font-medium text-slate-700">ที่อยู่</h3>
        <div>
          <label className="label">ที่อยู่ (บ้านเลขที่ หมู่ ซอย ถนน) — กรอกเอง</label>
          <input
            name="address_detail"
            defaultValue={customer?.address_detail ?? ""}
            className="input"
            placeholder="99/1 หมู่ 4 ถ.แสงชูโต"
          />
        </div>

        <AddressPicker defaultGeo={geo ?? null} />
      </div>

      {/* ---------- รูปถ่าย + ช่องทางติดต่อ ---------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <PhotoUploader
            name="photo_path"
            label="รูปถ่าย"
            max={1}
            initialPaths={customer?.photo_path ? [customer.photo_path] : []}
            endpoint="/api/customer/photo"
          />
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Link Facebook</label>
            <input
              name="facebook_url"
              defaultValue={customer?.facebook_url ?? ""}
              className="input"
              placeholder="https://facebook.com/... หรือชื่อผู้ใช้"
            />
          </div>
          <div>
            <label className="label">Link Line</label>
            <input
              name="line_url"
              defaultValue={customer?.line_url ?? ""}
              className="input"
              placeholder="@kkmotor หรือ LINE ID"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="label">หมายเหตุ</label>
        <input name="note" defaultValue={customer?.note ?? ""} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        <Link href="/customers" className="btn-secondary">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

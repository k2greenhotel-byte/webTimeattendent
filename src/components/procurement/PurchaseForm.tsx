import Link from "next/link";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatBaht } from "@/lib/procurement";
import {
  APPROVE_STATUS_LABEL,
  MAX_PHOTOS,
  PR_DOC_STATUS_LABEL,
  PR_DOC_STATUS_ORDER,
  PURCHASE_PAY_STATUS_LABEL,
  URGENCY_LABEL,
  URGENCY_ORDER,
  type PrType,
  type PurchaseRow,
} from "@/lib/procurement-types";
import type { Company } from "@/lib/core-types";
import type { Branch } from "@/lib/types";

/**
 * ฟอร์มใบขอจัดซื้อ (หน้าจอ 1.3) ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข
 * โครงเดียวกับฟอร์มใบขอซ่อม ต่างที่ผู้ขาย ประเภทวัสดุ และวันที่ได้รับวัสดุ
 */
export default function PurchaseForm({
  purchase,
  photos = [],
  companies,
  branches,
  materialTypes,
  defaultCompanyId,
  defaultBranchId,
  defaultRecorderName,
  action,
  submitLabel,
}: {
  purchase?: PurchaseRow | null;
  photos?: string[];
  companies: Company[];
  branches: Branch[];
  materialTypes: PrType[];
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-5">
      {purchase && <input type="hidden" name="id" value={purchase.id} />}

      {/* ---------- หัวเอกสาร (1.3.1-1.3.4) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบขอจัดซื้อ</label>
          <input
            value={purchase?.doc_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="request_date">
            วันที่ *
          </label>
          <input
            id="request_date"
            name="request_date"
            type="date"
            defaultValue={purchase?.request_date ?? today}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="company_id">
            บริษัท
          </label>
          <select
            id="company_id"
            name="company_id"
            defaultValue={purchase?.company_id ?? defaultCompanyId ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุบริษัท —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขา
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={purchase?.branch_id ?? defaultBranchId ?? ""}
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
      </div>

      {/* ---------- ผู้ขายและสิ่งที่ขอซื้อ (1.3.5-1.3.11) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="supplier_name">
            ผู้ขาย / Supplier
          </label>
          <input
            id="supplier_name"
            name="supplier_name"
            defaultValue={purchase?.supplier_name ?? ""}
            className="input"
            placeholder="ชื่อร้านหรือบริษัทผู้ขาย"
          />
        </div>
        <div>
          <label className="label" htmlFor="supplier_phone">
            เบอร์โทรผู้ขาย
          </label>
          <input
            id="supplier_phone"
            name="supplier_phone"
            defaultValue={purchase?.supplier_phone ?? ""}
            className="input"
            inputMode="tel"
            placeholder="0812345678"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="item_name">
            รายการที่ขอซื้อ *
          </label>
          <input
            id="item_name"
            name="item_name"
            defaultValue={purchase?.item_name ?? ""}
            className="input"
            placeholder="เช่น โต๊ะทำงาน 2 ตัว"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="material_type_id">
            ประเภทวัสดุ
          </label>
          <select
            id="material_type_id"
            name="material_type_id"
            defaultValue={purchase?.material_type_id ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุ —</option>
            {materialTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="urgency">
            ความเร่งด่วน
          </label>
          <select
            id="urgency"
            name="urgency"
            defaultValue={purchase?.urgency ?? "d2_5"}
            className="input"
          >
            {URGENCY_ORDER.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="created_by_name">
            ผู้บันทึกจัดทำ
          </label>
          <input
            id="created_by_name"
            name="created_by_name"
            defaultValue={purchase?.created_by_name ?? defaultRecorderName ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="received_date">
            วันที่ได้รับวัสดุแล้ว
          </label>
          <input
            id="received_date"
            name="received_date"
            type="date"
            defaultValue={purchase?.received_date ?? ""}
            className="input"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="reason">
            สาเหตุหรือความจำเป็นในการซื้อ
          </label>
          <textarea
            id="reason"
            name="reason"
            defaultValue={purchase?.reason ?? ""}
            className="input min-h-20"
            rows={3}
            placeholder="ของเดิมชำรุด / ไม่พอใช้ / เปิดสาขาใหม่"
          />
        </div>
      </div>

      {/* ---------- รูปภาพ (1.3.12) ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปภาพประกอบ"
          hint={`แนบได้สูงสุด ${MAX_PHOTOS} รูป เช่น รูปของที่ต้องการซื้อ หรือใบเสนอราคา`}
          max={MAX_PHOTOS}
          initialPaths={photos}
          prefix="purchase"
          endpoint="/api/procurement/photo"
        />
      </div>

      {/* ---------- จำนวนเงินและสถานะ (1.3.13-1.3.18) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="requested_amount">
            จำนวนเงินที่ขอเบิก
          </label>
          <input
            id="requested_amount"
            name="requested_amount"
            defaultValue={purchase ? String(purchase.requested_amount) : ""}
            className="input"
            inputMode="decimal"
            placeholder="8000"
          />
        </div>
        <div>
          <label className="label">จำนวนเงินที่อนุมัติเบิก</label>
          <input
            value={formatBaht(purchase?.approved_amount ?? 0)}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากหน้าจออนุมัติ (ข้อ 3)</p>
        </div>
        <div>
          <label className="label">จำนวนเงินที่เบิกจริง</label>
          <input
            value={formatBaht(purchase?.actual_amount ?? 0)}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากหน้าจอบันทึกจ่ายเงิน (ข้อ 4)</p>
        </div>
        <div>
          <label className="label" htmlFor="doc_status">
            สถานะเอกสาร
          </label>
          <select
            id="doc_status"
            name="doc_status"
            defaultValue={purchase?.doc_status ?? "active"}
            className="input"
          >
            {PR_DOC_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {PR_DOC_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="font-medium">สถานะอนุมัติ</span>{" "}
        {APPROVE_STATUS_LABEL[purchase?.approve_status ?? "pending"]} ·{" "}
        <span className="font-medium">สถานะการเบิกเงิน</span>{" "}
        {PURCHASE_PAY_STATUS_LABEL[purchase?.pay_status ?? "requested"]} — สองช่องนี้เปลี่ยนได้จาก
        หน้าจออนุมัติ (ข้อ 3) และหน้าจอบันทึกจ่ายเงิน (ข้อ 4) เท่านั้น
      </p>

      {purchase?.reject_note && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-medium">เหตุผลไม่อนุมัติ</span> {purchase.reject_note}
        </p>
      )}

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={purchase?.note ?? ""} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href="/procurement/purchases" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

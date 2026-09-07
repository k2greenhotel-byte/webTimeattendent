import Link from "next/link";
import ClaimItemsEditor from "@/components/claim/ClaimItemsEditor";
import VehiclePicker from "@/components/claim/VehiclePicker";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatBaht } from "@/lib/claim";
import {
  CLAIM_DOC_STATUS_LABEL,
  CLAIM_DOC_STATUS_ORDER,
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_JOB_STATUS_ORDER,
  CLAIM_MAX_PHOTOS,
  CLAIM_URGENCY_LABEL,
  CLAIM_URGENCY_ORDER,
  type ClaimItem,
  type ClaimRow,
} from "@/lib/claim-types";
import type { Company } from "@/lib/core-types";
import type { Branch } from "@/lib/types";

/**
 * ฟอร์มใบขอเคลม (หน้าจอ 1.4) ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข
 *
 * จอเล็กเรียงช่องละบรรทัด จอใหญ่เรียง 4 ช่องต่อแถว — ฟอร์มนี้มีช่องเยอะตามสเปก
 * ถ้าไม่ยุบเป็นคอลัมน์เดียวบนมือถือจะยาวจนกรอกไม่ไหว
 *
 * บริษัท/สาขา/ผู้บันทึก ตั้งค่าเริ่มต้นจากบัญชีที่ล็อกอินอยู่ (ข้อ 1.4.3-1.4.4, 1.4.13)
 * ส่วนยอดที่ขออนุมัติ (1.5.7) และวันที่คาดว่าจะเสร็จ (1.5.6) เป็นค่าที่ใบ update เขียนให้
 * จึงแสดงแบบอ่านอย่างเดียว — กันสถานะสองที่ไม่ตรงกัน
 */
export default function ClaimForm({
  claim,
  items = [],
  photos = [],
  companies,
  branches,
  defaultCompanyId,
  defaultBranchId,
  defaultRecorderName,
  action,
  submitLabel,
}: {
  claim?: ClaimRow | null;
  items?: ClaimItem[];
  photos?: string[];
  companies: Company[];
  branches: Branch[];
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-5">
      {claim && <input type="hidden" name="id" value={claim.id} />}

      {/* ---------- หัวเอกสาร (1.4.1-1.4.4) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบขอเคลม</label>
          <input
            value={claim?.doc_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="claim_date">
            วันที่ *
          </label>
          <input
            id="claim_date"
            name="claim_date"
            type="date"
            defaultValue={claim?.claim_date ?? today}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="company_id">
            บริษัทที่ขอเคลม
          </label>
          <select
            id="company_id"
            name="company_id"
            defaultValue={claim?.company_id ?? defaultCompanyId ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุบริษัท —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">ตั้งต้นจากบริษัทที่เลือกตอนเข้าระบบ</p>
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขา
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={claim?.branch_id ?? defaultBranchId ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุสาขา —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">ตั้งต้นจากสาขาที่เลือกตอนเข้าระบบ</p>
        </div>
      </div>

      {/* ---------- รถและลูกค้า (1.4.5-1.4.9) ---------- */}
      <VehiclePicker
        defaults={
          claim
            ? {
                chassis_no: claim.chassis_no,
                engine_no: claim.engine_no ?? "",
                brand_code: claim.db2_brand_code ?? "",
                brand_name: claim.db2_brand_name ?? "",
                model_code: claim.db2_model_code ?? "",
                model_name: claim.db2_model_name ?? "",
                variant_code: claim.db2_variant_code ?? "",
                variant_name: claim.db2_variant_name ?? "",
                color_code: claim.db2_color_code ?? "",
                color_name: claim.db2_color_name ?? "",
                contno: claim.db2_contno ?? "",
                locat: claim.db2_locat ?? "",
                sale_date: claim.db2_sale_date ?? "",
                cuscod: claim.db2_cuscod ?? "",
                customer_name: claim.customer_name,
                customer_phone: claim.customer_phone ?? "",
                customer_address: claim.customer_address ?? "",
                is_external: claim.is_external,
              }
            : undefined
        }
      />

      {/* ---------- รายการที่ขอเคลม (1.4.10) ---------- */}
      <ClaimItemsEditor items={items} />

      {/* ---------- ความเสียหายและความเร่งด่วน (1.4.11-1.4.13) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="damage_detail">
            อธิบายความเสียหาย
          </label>
          <textarea
            id="damage_detail"
            name="damage_detail"
            defaultValue={claim?.damage_detail ?? ""}
            className="input min-h-20"
            rows={3}
            placeholder="อาการที่พบ พบตอนไหน วิ่งมากี่กิโลเมตร"
          />
        </div>
        <div>
          <label className="label" htmlFor="urgency">
            ความเร่งด่วน
          </label>
          <select
            id="urgency"
            name="urgency"
            defaultValue={claim?.urgency ?? "d2_5"}
            className="input"
          >
            {CLAIM_URGENCY_ORDER.map((u) => (
              <option key={u} value={u}>
                {CLAIM_URGENCY_LABEL[u]}
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
            defaultValue={claim?.created_by_name ?? defaultRecorderName ?? ""}
            className="input"
          />
        </div>
      </div>

      {/* ---------- รูปภาพ (1.4.14) ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปภาพความเสียหาย"
          hint={`แนบได้สูงสุด ${CLAIM_MAX_PHOTOS} รูป · ระบบย่อรูปให้อัตโนมัติ ถ่ายจากมือถือได้เลย`}
          max={CLAIM_MAX_PHOTOS}
          initialPaths={photos}
          prefix="claim"
          endpoint="/api/claim/photo"
        />
      </div>

      {/* ---------- ผู้ผลิต / ผู้ดำเนินการแก้ไข (1.4.15-1.4.17) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="maker_name">
            ชื่อบริษัทผู้ผลิต
          </label>
          <input
            id="maker_name"
            name="maker_name"
            defaultValue={claim?.maker_name ?? ""}
            className="input"
            placeholder="เช่น ไทยยามาฮ่ามอเตอร์"
          />
        </div>
        <div>
          <label className="label" htmlFor="maker_agent_name">
            ชื่อตัวแทนบริษัทผู้ผลิต
          </label>
          <input
            id="maker_agent_name"
            name="maker_agent_name"
            defaultValue={claim?.maker_agent_name ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="maker_phone">
            เบอร์โทรผู้ที่ดำเนินการแก้ไข
          </label>
          <input
            id="maker_phone"
            name="maker_phone"
            defaultValue={claim?.maker_phone ?? ""}
            className="input"
            inputMode="tel"
            placeholder="0812345678"
          />
        </div>
        <div>
          <label className="label" htmlFor="doc_status">
            สถานะเอกสาร
          </label>
          <select
            id="doc_status"
            name="doc_status"
            defaultValue={claim?.doc_status ?? "active"}
            className="input"
          >
            {CLAIM_DOC_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CLAIM_DOC_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- สถานะงานและวันที่ (1.4.19-1.4.23) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="job_status">
            สถานะงาน
          </label>
          <select
            id="job_status"
            name="job_status"
            defaultValue={claim?.job_status ?? "wait_notify"}
            className="input"
          >
            {CLAIM_JOB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CLAIM_JOB_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            ปกติเปลี่ยนจากหน้าจอ Update งานเคลม (1.5) เพื่อให้มีประวัติว่าใครเปลี่ยนเมื่อไหร่
          </p>
        </div>
        <div>
          <label className="label" htmlFor="result_date">
            วันที่แจ้งผลการอนุมัติ
          </label>
          <input
            id="result_date"
            name="result_date"
            type="date"
            defaultValue={claim?.result_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="fixed_date">
            วันที่ซ่อมเสร็จ
          </label>
          <input
            id="fixed_date"
            name="fixed_date"
            type="date"
            defaultValue={claim?.fixed_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="delivered_date">
            วันที่ส่งมอบรถคืนลูกค้า
          </label>
          <input
            id="delivered_date"
            name="delivered_date"
            type="date"
            defaultValue={claim?.delivered_date ?? ""}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="reject_reason">
            เหตุผลไม่อนุมัติ
          </label>
          <input
            id="reject_reason"
            name="reject_reason"
            defaultValue={claim?.reject_reason ?? ""}
            className="input"
            placeholder="กรอกเมื่อสถานะงานเป็น “ไม่อนุมัติ”"
          />
        </div>
        <div>
          <label className="label">จำนวนเงินที่ขออนุมัติ</label>
          <input
            value={formatBaht(claim?.requested_amount ?? 0)}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากใบ Update งานเคลม (1.5.7)</p>
        </div>
        <div>
          <label className="label">วันที่คาดว่าจะซ่อมเสร็จ</label>
          <input
            value={claim?.expected_done_date ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="—"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากใบ Update งานเคลม (1.5.6)</p>
        </div>
      </div>

      {/* ---------- งานซ่อม (Job) — เขียนจากใบ Update เท่านั้น (1.5.10-1.5.13) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ Job no</label>
          <input
            value={claim?.job_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="—"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากใบ Update งานเคลม (1.5.10)</p>
        </div>
        <div>
          <label className="label">วันที่เปิด job</label>
          <input
            value={claim?.job_open_date ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="—"
          />
        </div>
        <div>
          <label className="label">วันที่ปิด job</label>
          <input
            value={claim?.job_close_date ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="—"
          />
        </div>
        <div>
          <label className="label">วันที่ส่งมอบงาน / ปิด job</label>
          <input
            value={claim?.job_deliver_date ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
            placeholder="—"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={claim?.note ?? ""} className="input" />
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        ถ้ายังไม่มีใบ update ระบุ “วันที่คาดว่าจะซ่อมเสร็จ” ระบบจะคิดกำหนดเสร็จให้จากความเร่งด่วนที่เลือกไว้
        (1-2 วัน → 2 วัน · 2-5 วัน → 5 วัน · 5 วันขึ้นไป → 10 วัน) แล้วใช้เตือนงานเกินกำหนดใน Dashboard
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href="/claim/claims" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

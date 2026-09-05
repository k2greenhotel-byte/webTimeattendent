import Link from "next/link";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatBaht } from "@/lib/procurement";
import {
  APPROVE_STATUS_LABEL,
  JOB_STATUS_ENTRY_ORDER,
  JOB_STATUS_LABEL,
  MAX_PHOTOS,
  PR_DOC_STATUS_LABEL,
  PR_DOC_STATUS_ORDER,
  REPAIR_PAY_STATUS_LABEL,
  TECH_KIND_LABEL,
  TECH_KIND_ORDER,
  URGENCY_LABEL,
  URGENCY_ORDER,
  type PrType,
  type RepairRow,
} from "@/lib/procurement-types";
import type { Company } from "@/lib/core-types";
import type { Branch } from "@/lib/types";

/**
 * ฟอร์มใบขอซ่อม (หน้าจอ 1.1) ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข
 *
 * จอเล็กเรียงช่องละบรรทัด จอใหญ่เรียง 4 ช่องต่อแถว — ฟอร์มนี้มี 24 ช่องตามสเปก
 * ถ้าไม่ยุบเป็นคอลัมน์เดียวบนมือถือจะยาวจนกรอกไม่ไหว
 *
 * ช่องที่ระบบเป็นผู้เขียน (เลขที่ใบ ยอดที่อนุมัติ สถานะอนุมัติ) แสดงแบบอ่านอย่างเดียว
 * เพราะมาจากหน้าจออนุมัติ (ข้อ 3) และหน้าจ่ายเงิน (ข้อ 4) — กันสถานะสองที่ไม่ตรงกัน
 */
export default function RepairForm({
  repair,
  photos = [],
  companies,
  branches,
  assetTypes,
  defaultCompanyId,
  defaultBranchId,
  defaultRecorderName,
  action,
  submitLabel,
}: {
  repair?: RepairRow | null;
  photos?: string[];
  companies: Company[];
  branches: Branch[];
  assetTypes: PrType[];
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-5">
      {repair && <input type="hidden" name="id" value={repair.id} />}

      {/* ---------- หัวเอกสาร (1.1.1-1.1.4) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่ใบขอซ่อม</label>
          <input
            value={repair?.doc_no ?? ""}
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
            defaultValue={repair?.request_date ?? today}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="company_id">
            บริษัทที่ขอซ่อม
          </label>
          <select
            id="company_id"
            name="company_id"
            defaultValue={repair?.company_id ?? defaultCompanyId ?? ""}
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
            defaultValue={repair?.branch_id ?? defaultBranchId ?? ""}
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

      {/* ---------- สิ่งที่ต้องซ่อม (1.1.5-1.1.9) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="item_name">
            รายการที่ต้องซ่อม *
          </label>
          <input
            id="item_name"
            name="item_name"
            defaultValue={repair?.item_name ?? ""}
            className="input"
            placeholder="เช่น แอร์ห้องประชุมไม่เย็น"
            maxLength={200}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="asset_type_id">
            ประเภททรัพย์สิน
          </label>
          <select
            id="asset_type_id"
            name="asset_type_id"
            defaultValue={repair?.asset_type_id ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุ —</option>
            {assetTypes.map((t) => (
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
            defaultValue={repair?.urgency ?? "d2_5"}
            className="input"
          >
            {URGENCY_ORDER.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="damage_detail">
            อธิบายความเสียหาย
          </label>
          <textarea
            id="damage_detail"
            name="damage_detail"
            defaultValue={repair?.damage_detail ?? ""}
            className="input min-h-20"
            rows={3}
            placeholder="อาการที่พบ เกิดขึ้นตอนไหน กระทบงานอย่างไร"
          />
        </div>
        <div>
          <label className="label" htmlFor="created_by_name">
            ผู้บันทึกจัดทำ
          </label>
          <input
            id="created_by_name"
            name="created_by_name"
            defaultValue={repair?.created_by_name ?? defaultRecorderName ?? ""}
            className="input"
          />
        </div>
      </div>

      {/* ---------- รูปภาพ (1.1.10) ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปภาพความเสียหาย"
          hint={`แนบได้สูงสุด ${MAX_PHOTOS} รูป · ระบบย่อรูปให้อัตโนมัติ ถ่ายจากมือถือได้เลย`}
          max={MAX_PHOTOS}
          initialPaths={photos}
          prefix="repair"
          endpoint="/api/procurement/photo"
        />
      </div>

      {/* ---------- จำนวนเงิน (1.1.11-1.1.13) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="requested_amount">
            จำนวนเงินที่ขอเบิก
          </label>
          <input
            id="requested_amount"
            name="requested_amount"
            defaultValue={repair ? String(repair.requested_amount) : ""}
            className="input"
            inputMode="decimal"
            placeholder="3500"
          />
        </div>
        <div>
          <label className="label">จำนวนเงินที่อนุมัติเบิก</label>
          <input
            value={formatBaht(repair?.approved_amount ?? 0)}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากหน้าจออนุมัติ (ข้อ 3)</p>
        </div>
        <div>
          <label className="label">จำนวนเงินที่เบิกจริง</label>
          <input
            value={formatBaht(repair?.actual_amount ?? 0)}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-400">มาจากหน้าจอบันทึกจ่ายเงิน (ข้อ 4)</p>
        </div>
        <div>
          <label className="label">สถานะอนุมัติ / การเบิกเงิน</label>
          <input
            value={`${APPROVE_STATUS_LABEL[repair?.approve_status ?? "pending"]} · ${
              REPAIR_PAY_STATUS_LABEL[repair?.pay_status ?? "requested"]
            }`}
            readOnly
            disabled
            className="input bg-slate-50 text-slate-600"
          />
        </div>
      </div>

      {/* ---------- ผู้ดำเนินการแก้ไข (1.1.14-1.1.16) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="tech_name">
            ชื่อผู้ที่จะดำเนินการแก้ไข
          </label>
          <input
            id="tech_name"
            name="tech_name"
            defaultValue={repair?.tech_name ?? ""}
            className="input"
            placeholder="ชื่อช่างหรือร้าน"
          />
        </div>
        <div>
          <label className="label" htmlFor="tech_phone">
            เบอร์โทรผู้ดำเนินการแก้ไข
          </label>
          <input
            id="tech_phone"
            name="tech_phone"
            defaultValue={repair?.tech_phone ?? ""}
            className="input"
            inputMode="tel"
            placeholder="0812345678"
          />
        </div>
        <div>
          <label className="label" htmlFor="tech_kind">
            แก้ไขโดย
          </label>
          <select
            id="tech_kind"
            name="tech_kind"
            defaultValue={repair?.tech_kind ?? "external"}
            className="input"
          >
            {TECH_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {TECH_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="doc_status">
            สถานะเอกสาร
          </label>
          <select
            id="doc_status"
            name="doc_status"
            defaultValue={repair?.doc_status ?? "active"}
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

      {/* ---------- สถานะงานและกำหนดเวลา (1.1.19, 1.1.22-1.1.24) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="job_status">
            สถานะงาน
          </label>
          <select
            id="job_status"
            name="job_status"
            defaultValue={repair?.job_status ?? "wait_tech"}
            className="input"
          >
            {JOB_STATUS_ENTRY_ORDER.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
              </option>
            ))}
            {/* สถานะ "อยู่ระหว่างการซ่อม" บันทึกได้จากหน้าจอ Update (1.2) — แสดงไว้ถ้าใบนี้เป็นอยู่แล้ว */}
            {repair?.job_status === "in_progress" && (
              <option value="in_progress">{JOB_STATUS_LABEL.in_progress}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tech_visit_date">
            วันที่ช่างจะเข้ามาแก้ไข
          </label>
          <input
            id="tech_visit_date"
            name="tech_visit_date"
            type="date"
            defaultValue={repair?.tech_visit_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="expected_done_date">
            วันที่คาดว่าจะซ่อมเสร็จ
          </label>
          <input
            id="expected_done_date"
            name="expected_done_date"
            type="date"
            defaultValue={repair?.expected_done_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="fixed_date">
            วันที่ที่ได้รับการแก้ไขแล้ว
          </label>
          <input
            id="fixed_date"
            name="fixed_date"
            type="date"
            defaultValue={repair?.fixed_date ?? ""}
            className="input"
          />
        </div>
      </div>

      {repair?.reject_note && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-medium">เหตุผลไม่อนุมัติ</span> {repair.reject_note}
        </p>
      )}

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={repair?.note ?? ""} className="input" />
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        ถ้าไม่ได้กรอก “วันที่คาดว่าจะซ่อมเสร็จ” ระบบจะคิดกำหนดเสร็จให้จากความเร่งด่วนที่เลือกไว้
        (1-2 วัน → 2 วัน · 2-5 วัน → 5 วัน · 5 วันขึ้นไป → 10 วัน) แล้วใช้เตือนงานเกินกำหนดใน Dashboard
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href="/procurement/repairs" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

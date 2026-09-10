import Link from "next/link";
import type { AudParams } from "@/lib/audit";
import {
  AUD_CALL_RESULT_LABEL,
  AUD_CALL_RESULT_ORDER,
  AUD_DOC_RESULT_LABEL,
  AUD_DOC_RESULT_ORDER,
  AUD_INFO_RESULT_LABEL,
  AUD_INFO_RESULT_ORDER,
  AUD_RESULT_LABEL,
  AUD_RESULT_ORDER,
  AUD_STATUS_LABEL,
  AUD_STATUS_ORDER,
  type AudCheckType,
} from "@/lib/audit-types";
import type { Company } from "@/lib/core-types";
import type { Branch, Employee } from "@/lib/types";

/** แถบเงื่อนไขค้นหารายเอกสารที่ตรวจ */
export default function CheckFilters({
  params,
  companies,
  branches,
  auditors,
  types,
  resetHref,
}: {
  params: AudParams;
  companies: Company[];
  branches: Branch[];
  auditors: Employee[];
  types: AudCheckType[];
  resetHref: string;
}) {
  return (
    <form className="card no-print space-y-3" method="get">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            className="input"
            placeholder="เลขที่สัญญา/ใบเบิก ชื่อลูกค้า ผู้รับเงิน พนักงานขาย หมายเหตุ"
          />
        </div>

        <div>
          <label className="label" htmlFor="from">
            ตรวจตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
        </div>

        <div>
          <label className="label" htmlFor="type_id">
            รายการตรวจ
          </label>
          <select id="type_id" name="type_id" defaultValue={params.type_id ?? ""} className="input">
            <option value="">ทุกรายการ</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="branch_id">
            สาขา (ของใบคุมงาน)
          </label>
          <select id="branch_id" name="branch_id" defaultValue={params.branch_id ?? ""} className="input">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="auditor_id">
            ผู้ตรวจสอบ
          </label>
          <select id="auditor_id" name="auditor_id" defaultValue={params.auditor_id ?? ""} className="input">
            <option value="">ทุกคน</option>
            {auditors.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="company_id">
            บริษัท
          </label>
          <select id="company_id" name="company_id" defaultValue={params.company_id ?? ""} className="input">
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="result">
            ผลการตรวจ
          </label>
          <select id="result" name="result" defaultValue={params.result ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {AUD_RESULT_ORDER.map((r) => (
              <option key={r} value={r}>
                {AUD_RESULT_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="doc_result">
            เอกสารประกอบ
          </label>
          <select id="doc_result" name="doc_result" defaultValue={params.doc_result ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {AUD_DOC_RESULT_ORDER.map((r) => (
              <option key={r} value={r}>
                {AUD_DOC_RESULT_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="call_result">
            การโทรถาม
          </label>
          <select id="call_result" name="call_result" defaultValue={params.call_result ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {AUD_CALL_RESULT_ORDER.map((r) => (
              <option key={r} value={r}>
                {AUD_CALL_RESULT_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="info_result">
            ผลข้อมูลที่ได้จากการโทร
          </label>
          <select id="info_result" name="info_result" defaultValue={params.info_result ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {AUD_INFO_RESULT_ORDER.map((r) => (
              <option key={r} value={r}>
                {AUD_INFO_RESULT_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="audit_status">
            สถานะใบคุมงาน
          </label>
          <select id="audit_status" name="audit_status" defaultValue={params.audit_status ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {AUD_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {AUD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href={resetHref} className="btn-secondary w-full sm:w-auto">
          ล้างเงื่อนไข
        </Link>
      </div>
    </form>
  );
}

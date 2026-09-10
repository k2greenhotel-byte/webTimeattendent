import Link from "next/link";
import type { AudParams } from "@/lib/audit";
import { AUD_STATUS_LABEL, AUD_STATUS_ORDER } from "@/lib/audit-types";
import type { Company } from "@/lib/core-types";
import type { Branch, Employee } from "@/lib/types";

/**
 * แถบเงื่อนไขค้นหาใบคุมงาน — ใช้ method GET จะได้ bookmark ลิงก์ผลลัพธ์
 * หรือส่งลิงก์ให้หัวหน้างานเปิดดูต่อได้
 */
export default function AuditFilters({
  params,
  companies,
  branches,
  auditors,
  resetHref,
}: {
  params: AudParams;
  companies: Company[];
  branches: Branch[];
  auditors: Employee[];
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
            placeholder="เลขที่คุมงาน ชื่อผู้ตรวจสอบ สาขา หมายเหตุ"
          />
        </div>

        <div>
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
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
          <label className="label" htmlFor="branch_id">
            สาขา
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
          <label className="label" htmlFor="status">
            สถานะใบคุมงาน
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
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

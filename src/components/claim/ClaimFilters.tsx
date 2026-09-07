import Link from "next/link";
import {
  CLAIM_DOC_STATUS_LABEL,
  CLAIM_DOC_STATUS_ORDER,
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_JOB_STATUS_ORDER,
  CLAIM_URGENCY_LABEL,
  CLAIM_URGENCY_ORDER,
  type ClaimQuery,
} from "@/lib/claim-types";
import type { Company } from "@/lib/core-types";
import type { Branch } from "@/lib/types";

export type ClaimParams = Record<string, string | undefined>;

/** อ่านเงื่อนไขค้นหาจาก query string ของหน้าจอ (ใช้ร่วมกันทุกหน้าที่มีฟิลเตอร์) */
export function queryFromParams(params: ClaimParams): ClaimQuery {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | null => {
    const value = params[key] ?? "";
    return (allowed as readonly string[]).includes(value) ? (value as T) : null;
  };

  return {
    keyword: params.q?.trim() || undefined,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    urgency: pick("urgency", CLAIM_URGENCY_ORDER),
    doc_status: pick("doc_status", CLAIM_DOC_STATUS_ORDER),
    job_status: pick("job_status", CLAIM_JOB_STATUS_ORDER),
    external: pick("external", ["1", "0"] as const),
    from: params.from || null,
    to: params.to || null,
  };
}

function StatusSelect<T extends string>({
  name,
  label,
  order,
  labels,
  value,
}: {
  name: string;
  label: string;
  order: readonly T[];
  labels: Record<T, string>;
  value?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">ทั้งหมด</option>
        {order.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * แถบเงื่อนไขค้นหาของหน้าจอสอบถาม (ข้อ 2) และ dashboard (ข้อ 3)
 * ใช้ method GET จะได้ bookmark ลิงก์ผลลัพธ์ หรือส่งลิงก์ให้คนอื่นเปิดต่อได้
 */
export default function ClaimFilters({
  params,
  companies,
  branches,
  resetHref,
}: {
  params: ClaimParams;
  companies: Company[];
  branches: Branch[];
  resetHref: string;
}) {
  return (
    <form className="card space-y-3 no-print" method="get">
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
            placeholder="เลขที่ใบ เลขที่ job เลขตัวถัง เลขเครื่อง ชื่อ/เบอร์ลูกค้า รุ่นรถ ผู้ผลิต รายการที่ขอเคลม"
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
          <select
            id="company_id"
            name="company_id"
            defaultValue={params.company_id ?? ""}
            className="input"
          >
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
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={params.branch_id ?? ""}
            className="input"
          >
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <StatusSelect
          name="urgency"
          label="ความเร่งด่วน"
          order={CLAIM_URGENCY_ORDER}
          labels={CLAIM_URGENCY_LABEL}
          value={params.urgency}
        />

        <StatusSelect
          name="job_status"
          label="สถานะงาน"
          order={CLAIM_JOB_STATUS_ORDER}
          labels={CLAIM_JOB_STATUS_LABEL}
          value={params.job_status}
        />

        <StatusSelect
          name="doc_status"
          label="สถานะเอกสาร"
          order={CLAIM_DOC_STATUS_ORDER}
          labels={CLAIM_DOC_STATUS_LABEL}
          value={params.doc_status}
        />

        <StatusSelect
          name="external"
          label="ที่มาของลูกค้า"
          order={["0", "1"] as const}
          labels={{ "0": "มีข้อมูลในระบบขาย", "1": "ลูกค้าภายนอก" }}
          value={params.external}
        />
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

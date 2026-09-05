import Link from "next/link";
import {
  APPROVE_STATUS_LABEL,
  APPROVE_STATUS_ORDER,
  DOC_KIND_LABEL,
  DOC_KIND_ORDER,
  JOB_STATUS_LABEL,
  JOB_STATUS_ORDER,
  PAY_STATUS_ORDER,
  PR_DOC_STATUS_LABEL,
  PR_DOC_STATUS_ORDER,
  REPAIR_PAY_STATUS_LABEL,
  URGENCY_LABEL,
  URGENCY_ORDER,
  type PrDocQuery,
} from "@/lib/procurement-types";
import type { Branch } from "@/lib/types";
import type { Company } from "@/lib/core-types";

export type PrParams = Record<string, string | undefined>;

/** อ่านเงื่อนไขค้นหาจาก query string ของหน้าจอ (ใช้ร่วมกันทุกหน้าที่มีฟิลเตอร์) */
export function queryFromParams(params: PrParams): PrDocQuery {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | null => {
    const value = params[key] ?? "";
    return (allowed as readonly string[]).includes(value) ? (value as T) : null;
  };

  return {
    keyword: params.q?.trim() || undefined,
    kind: pick("kind", DOC_KIND_ORDER),
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    urgency: pick("urgency", URGENCY_ORDER),
    doc_status: pick("doc_status", PR_DOC_STATUS_ORDER),
    pay_status: pick("pay_status", PAY_STATUS_ORDER),
    approve_status: pick("approve_status", APPROVE_STATUS_ORDER),
    job_status: pick("job_status", JOB_STATUS_ORDER),
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
 * แถบเงื่อนไขค้นหาของหน้าสอบถาม/อนุมัติ/dashboard (ข้อ 5)
 * จอเล็กเรียงช่องละบรรทัด จอใหญ่เรียง 4 ช่องต่อแถว — ใช้ method GET จะได้ bookmark ลิงก์ผลลัพธ์ได้
 */
export default function DocFilters({
  params,
  companies,
  branches,
  resetHref,
  showKind = true,
  showJobStatus = true,
  extraHiddenFields,
}: {
  params: PrParams;
  companies: Company[];
  branches: Branch[];
  resetHref: string;
  showKind?: boolean;
  showJobStatus?: boolean;
  extraHiddenFields?: Record<string, string>;
}) {
  return (
    <form className="card space-y-3" method="get">
      {Object.entries(extraHiddenFields ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

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
            placeholder="เลขที่เอกสาร รายการ ประเภท สาขา ผู้บันทึก"
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

        {showKind && (
          <StatusSelect
            name="kind"
            label="ชนิดเอกสาร"
            order={DOC_KIND_ORDER}
            labels={DOC_KIND_LABEL}
            value={params.kind}
          />
        )}

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
          order={URGENCY_ORDER}
          labels={URGENCY_LABEL}
          value={params.urgency}
        />

        {showJobStatus && (
          <StatusSelect
            name="job_status"
            label="สถานะงาน"
            order={JOB_STATUS_ORDER}
            labels={JOB_STATUS_LABEL}
            value={params.job_status}
          />
        )}

        <StatusSelect
          name="approve_status"
          label="สถานะอนุมัติ"
          order={APPROVE_STATUS_ORDER}
          labels={APPROVE_STATUS_LABEL}
          value={params.approve_status}
        />

        <StatusSelect
          name="pay_status"
          label="สถานะการเบิกเงิน"
          order={PAY_STATUS_ORDER}
          labels={REPAIR_PAY_STATUS_LABEL}
          value={params.pay_status}
        />

        <StatusSelect
          name="doc_status"
          label="สถานะเอกสาร"
          order={PR_DOC_STATUS_ORDER}
          labels={PR_DOC_STATUS_LABEL}
          value={params.doc_status}
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

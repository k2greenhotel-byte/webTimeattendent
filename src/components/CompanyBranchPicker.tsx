"use client";

import { useState } from "react";
import type { Company } from "@/lib/core-types";
import type { Branch } from "@/lib/types";

/**
 * เลือกบริษัทและสาขาที่จะเข้าทำงาน — แสดงเฉพาะรายการที่ผู้ใช้มีสิทธิ์
 * เลือกบริษัทแล้วรายการสาขาจะเหลือเฉพาะสาขาของบริษัทนั้น
 */
export default function CompanyBranchPicker({
  companies,
  branches,
  defaultCompanyId,
  defaultBranchId,
  action,
  next,
  submitLabel = "เข้าใช้งาน",
}: {
  companies: Company[];
  branches: Branch[];
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
  action: (formData: FormData) => void | Promise<void>;
  next?: string;
  submitLabel?: string;
}) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "");

  const visibleBranches = branches.filter((b) => !companyId || b.company_id === companyId);
  const noBranch = visibleBranches.length === 0;

  return (
    <form action={action} className="card space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label className="label">บริษัท *</label>
        <select
          name="company_id"
          className="input"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          required
        >
          {companies.length === 0 && <option value="">— ไม่มีบริษัทที่มีสิทธิ์ —</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">สาขา *</label>
        <select
          name="branch_id"
          className="input"
          defaultValue={defaultBranchId ?? ""}
          key={companyId}
          required={!noBranch}
          disabled={noBranch}
        >
          {noBranch && <option value="">— ยังไม่มีสาขาที่มีสิทธิ์ในบริษัทนี้ —</option>}
          {visibleBranches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={companies.length === 0}>
        {submitLabel}
      </button>

      {companies.length === 0 && (
        <p className="text-sm text-rose-600">
          บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าบริษัทใดเลย กรุณาให้ผู้ดูแลระบบกำหนดสิทธิ์ที่เมนู
          ระบบส่วนกลาง → กำหนดผู้ใช้งาน
        </p>
      )}
    </form>
  );
}

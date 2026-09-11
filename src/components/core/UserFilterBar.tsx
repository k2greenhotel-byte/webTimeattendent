import Link from "next/link";
import type { ReactNode } from "react";
import type { Company } from "@/lib/core-types";
import type { Branch, Position } from "@/lib/types";
import { hasUserFilter, type UserFilter } from "@/lib/user-filter";

/**
 * แถบค้นหา/กรองรายชื่อผู้ใช้ในหน้าตั้งค่าสิทธิ์ (GET form — แชร์ลิงก์ได้ กด back ได้)
 * ค้นคำ + บริษัท + สาขา + ตำแหน่ง · ส่ง hidden เพิ่มได้ (เช่น program/user ที่เลือกอยู่)
 */
export default function UserFilterBar({
  action,
  filter,
  companies,
  branches,
  positions,
  hidden = {},
  shown,
  total,
  children,
}: {
  action: string;
  filter: UserFilter;
  companies: Company[];
  branches: Branch[];
  positions: Position[];
  hidden?: Record<string, string | undefined>;
  shown: number;
  total: number;
  children?: ReactNode;
}) {
  const companyCode = new Map(companies.map((c) => [c.id, c.code]));
  const clearQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) if (v) clearQuery.set(k, v);
  const clearHref = clearQuery.toString() ? `${action}?${clearQuery.toString()}` : action;

  return (
    <form method="get" action={action} className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="sm:w-64">
        <label className="label">ค้นหา</label>
        <input
          type="search"
          name="q"
          defaultValue={filter.q ?? ""}
          placeholder="ชื่อ / User ID / รหัสพนักงาน / เบอร์"
          className="input"
          autoComplete="off"
        />
      </div>
      <div className="sm:w-44">
        <label className="label">บริษัท</label>
        <select name="company" defaultValue={filter.companyId ?? ""} className="input">
          <option value="">ทุกบริษัท</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:w-56">
        <label className="label">สาขา</label>
        <select name="branch" defaultValue={filter.branchId ?? ""} className="input">
          <option value="">ทุกสาขา</option>
          {branches
            .filter((b) => !filter.companyId || b.company_id === filter.companyId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.company_id && companyCode.get(b.company_id) ? `${companyCode.get(b.company_id)} · ` : ""}
                {b.name}
              </option>
            ))}
        </select>
      </div>
      <div className="sm:w-44">
        <label className="label">ตำแหน่ง</label>
        <select name="position" defaultValue={filter.positionId ?? ""} className="input">
          <option value="">ทุกตำแหน่ง</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {children}
      <button type="submit" className="btn-secondary sm:py-2 sm:text-sm">
        ค้นหา
      </button>
      {hasUserFilter(filter) && (
        <Link href={clearHref} className="pb-2 text-sm text-slate-500 hover:underline">
          ล้างตัวกรอง
        </Link>
      )}
      <span className="pb-2 text-sm text-slate-500">
        แสดง {shown} จาก {total} คน
      </span>
    </form>
  );
}

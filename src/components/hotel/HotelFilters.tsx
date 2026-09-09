import Link from "next/link";
import type { Company } from "@/lib/core-types";
import {
  HTL_PRIORITY_LABEL,
  HTL_PRIORITY_ORDER,
  HTL_STATUS_LABEL,
  HTL_STATUS_ORDER,
  type HtlIssueQuery,
  type HtlRoundQuery,
} from "@/lib/hotel-types";
import type { Branch } from "@/lib/types";

export type HotelParams = Record<string, string | undefined>;

/** อ่านเงื่อนไขค้นหาใบตรวจจาก query string (ใช้ร่วมกันทุกหน้าที่มีฟิลเตอร์) */
export function roundQueryFromParams(params: HotelParams): HtlRoundQuery {
  const status = params.status ?? "";

  return {
    keyword: params.q?.trim() || undefined,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    status: (HTL_STATUS_ORDER as string[]).includes(status)
      ? (status as HtlRoundQuery["status"])
      : null,
    from: params.from || null,
    to: params.to || null,
  };
}

/** อ่านเงื่อนไขค้นหาข้อที่ต้องแก้ไขจาก query string */
export function issueQueryFromParams(params: HotelParams): HtlIssueQuery {
  const priority = params.priority ?? "";
  const fixed = params.fixed ?? "";

  return {
    keyword: params.q?.trim() || undefined,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    group_name: params.group_name || null,
    priority: (HTL_PRIORITY_ORDER as string[]).includes(priority)
      ? (priority as HtlIssueQuery["priority"])
      : null,
    fixed: fixed === "1" ? true : fixed === "0" ? false : null,
    from: params.from || null,
    to: params.to || null,
  };
}

/**
 * แถบเงื่อนไขค้นหาของหน้ารายการ หน้าสอบถาม dashboard และหน้ารายการที่ต้องแก้ไข
 * ใช้ method GET จะได้ bookmark ลิงก์ผลลัพธ์ หรือส่งลิงก์ให้คนอื่นเปิดต่อได้
 */
export default function HotelFilters({
  params,
  companies,
  branches,
  resetHref,
  /** โหมด issue เปลี่ยนช่อง "สถานะเอกสาร" เป็นความเร่งด่วน + สถานะการแก้ไข */
  mode = "round",
  groupNames = [],
}: {
  params: HotelParams;
  companies: Company[];
  branches: Branch[];
  resetHref: string;
  mode?: "round" | "issue";
  groupNames?: string[];
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
            placeholder={
              mode === "issue"
                ? "ชื่อรายการ ประเภทงาน สาขา หมายเหตุ เลขที่ใบซ่อม"
                : "เลขที่ใบ ชื่อสาขา บริษัท ผู้ตรวจเช็ค หมายเหตุ"
            }
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
            สาขา / โรงแรม
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

        {mode === "round" ? (
          <div>
            <label className="label" htmlFor="status">
              สถานะเอกสาร
            </label>
            <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
              <option value="">ทั้งหมด</option>
              {HTL_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {HTL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="priority">
                ความเร่งด่วน
              </label>
              <select
                id="priority"
                name="priority"
                defaultValue={params.priority ?? ""}
                className="input"
              >
                <option value="">ทุกระดับ</option>
                {HTL_PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {HTL_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="fixed">
                สถานะการแก้ไข
              </label>
              <select id="fixed" name="fixed" defaultValue={params.fixed ?? ""} className="input">
                <option value="">ทั้งหมด</option>
                <option value="0">ยังไม่ได้แก้</option>
                <option value="1">แก้ไขแล้ว</option>
              </select>
            </div>

            {groupNames.length > 0 && (
              <div>
                <label className="label" htmlFor="group_name">
                  ประเภทงาน
                </label>
                <select
                  id="group_name"
                  name="group_name"
                  defaultValue={params.group_name ?? ""}
                  className="input"
                >
                  <option value="">ทุกประเภทงาน</option>
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
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

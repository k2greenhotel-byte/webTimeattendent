import Link from "next/link";
import type { Company } from "@/lib/core-types";
import type { LeaveType } from "@/lib/leave-types";
import type { Branch, Employee } from "@/lib/types";

export type HrReportParams = Record<string, string | undefined>;

/**
 * แถบเงื่อนไขค้นหาของหน้าสอบถามข้อมูลการลา/ขอเบิกเงิน (ใช้ร่วมกันทั้งสองหน้า)
 * ส่งด้วย GET เพื่อให้บันทึก/แชร์ลิงก์เงื่อนไขเดิมได้ และปุ่มย้อนกลับใช้ได้ตามปกติ
 *
 * จอเล็กเรียงช่องลงมาทีละช่องเต็มความกว้าง จอใหญ่เรียงเป็นแถวเดียว (แพตเทิร์นเดียวกับ LeadFilters)
 */
export default function HrReportFilters({
  basePath,
  params,
  companies,
  branches,
  employees,
  types,
  statusOptions,
}: {
  basePath: string;
  params: HrReportParams;
  companies: Company[];
  branches: Branch[];
  employees: Employee[];
  /** ส่งมาเฉพาะหน้าสอบถามการลา — หน้าขอเบิกเงินไม่มีประเภท */
  types?: LeaveType[];
  /** เว้นว่าง = ไม่แสดงช่องกรองสถานะ (ใช้กับหน้า Dashboard ที่รวมทุกสถานะเสมอ) */
  statusOptions?: { value: string; label: string }[];
}) {
  return (
    <form method="get" className="card no-print grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <label className="label" htmlFor="company">
          บริษัท
        </label>
        <select id="company" name="company" defaultValue={params.company ?? ""} className="input">
          <option value="">ทุกบริษัท</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="branch">
          สาขา
        </label>
        <select id="branch" name="branch" defaultValue={params.branch ?? ""} className="input">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor="employee">
          พนักงาน
        </label>
        <select id="employee" name="employee" defaultValue={params.employee ?? ""} className="input">
          <option value="">ทุกคน</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.emp_code} · {e.full_name}
              {e.is_active ? "" : " (ปิดใช้งาน)"}
            </option>
          ))}
        </select>
      </div>

      {types && (
        <div>
          <label className="label" htmlFor="type">
            ประเภทการลา
          </label>
          <select id="type" name="type" defaultValue={params.type ?? ""} className="input">
            <option value="">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {statusOptions && (
        <div>
          <label className="label" htmlFor="status">
            สถานะ
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
            <option value="">ทุกสถานะ</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href={basePath} className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </div>
    </form>
  );
}

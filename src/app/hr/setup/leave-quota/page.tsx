import Link from "next/link";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees } from "@/lib/db";
import { workDateOf } from "@/lib/datetime";
import { listEntitlementsForEmployees, listLeaveTypes, usedLeaveDaysBulk } from "@/lib/leave-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { saveEntitlementsForm } from "./actions";

export const dynamic = "force-dynamic";

/** สิทธิ์คงเหลือ = ที่ตั้งไว้ (หรือโควตาเริ่มต้นของประเภทถ้าไม่ได้ตั้ง) - ใช้ไปแล้ว */
function remainingText(granted: number | null, used: number): string {
  if (granted === null) return "ไม่จำกัด";
  const remaining = Math.round((granted - used) * 10) / 10;
  return `${remaining} วัน`;
}

export default async function LeaveQuotaSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; branch?: string; q?: string; year?: string; msg?: string; err?: string }>;
}) {
  await requirePermission("HR_LEAVE_QUOTA", "read");
  const params = await searchParams;
  const canEdit = await checkPermission("HR_LEAVE_QUOTA", "edit");

  const today = workDateOf();
  const beYearNow = Number(today.slice(0, 4)) + 543;
  const beYear = Number(params.year) || beYearNow;
  const year = beYear - 543;

  const [companies, branches, types, employeesAll] = await Promise.all([
    listCompanies(true),
    listBranches(true, params.company || undefined),
    listLeaveTypes(true),
    listEmployees({ activeOnly: true, companyId: params.company || undefined, branchId: params.branch || undefined }),
  ]);

  const keyword = (params.q ?? "").trim().toLowerCase();
  const employees = keyword
    ? employeesAll.filter(
        (e) => e.full_name.toLowerCase().includes(keyword) || e.emp_code.toLowerCase().includes(keyword),
      )
    : employeesAll;

  const employeeIds = employees.map((e) => e.id);
  const [entitlements, used] = await Promise.all([
    listEntitlementsForEmployees(employeeIds, year),
    usedLeaveDaysBulk(employeeIds, year),
  ]);

  const backParams = new URLSearchParams();
  if (params.company) backParams.set("company", params.company);
  if (params.branch) backParams.set("branch", params.branch);
  if (params.q) backParams.set("q", params.q);
  backParams.set("year", String(beYear));
  const backHref = `/hr/setup/leave-quota?${backParams.toString()}`;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่าสิทธิ์การลารายบุคคล</h1>
          <p className="text-sm text-slate-500">
            เว้นว่าง = ใช้โควตาเริ่มต้นของประเภทการลานั้น (ตั้งที่{" "}
            <Link href="/hr/setup/leave-types" className="text-brand-600 hover:underline">
              ตั้งค่าประเภทการลา
            </Link>
            ) · กรอกตัวเลข = ใช้ค่านี้แทนเฉพาะคนนี้ เฉพาะปีนี้
          </p>
        </div>
        <Link href="/hr/manage/leave" className="text-sm text-brand-600 hover:underline">
          ← แก้ไขข้อมูลการลา
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}
      {!canEdit && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีของคุณเปิดดูได้อย่างเดียว ยังแก้ไขไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์ &quot;แก้ไข&quot;
          ของเมนูนี้ให้ก่อน
        </p>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label">คำค้น</label>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className="input w-56"
            placeholder="ชื่อพนักงาน / รหัสพนักงาน"
          />
        </div>
        <div>
          <label className="label">บริษัท</label>
          <select name="company" defaultValue={params.company ?? ""} className="input w-56">
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">สาขา</label>
          <select name="branch" defaultValue={params.branch ?? ""} className="input w-56">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ปี พ.ศ.</label>
          <input
            name="year"
            type="number"
            defaultValue={beYear}
            className="input w-28"
          />
        </div>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
      </form>

      {employees.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500">ไม่พบพนักงานที่ตรงกับเงื่อนไข</p>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => {
            const overrides = entitlements.get(emp.id) ?? {};
            const usedByType = used.get(emp.id) ?? {};

            return (
              <form
                key={emp.id}
                action={saveEntitlementsForm}
                className="rounded-xl border border-slate-200 bg-white p-3 md:p-4"
              >
                <input type="hidden" name="employee_id" value={emp.id} />
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="back" value={backHref} />

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-700">
                    <strong>{emp.full_name}</strong>
                    <span className="ml-2 text-xs text-slate-400">{emp.emp_code}</span>
                    {emp.branch_name ? ` · สาขา ${emp.branch_name}` : ""}
                  </p>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {types.map((type) => {
                    const override = overrides[type.id];
                    const usedDays = usedByType[type.id] ?? 0;
                    const effectiveGranted = override ?? type.max_days_per_year;

                    return (
                      <div key={type.id} className="rounded-lg border border-slate-200 p-2">
                        <label className="label">
                          {type.icon} {type.name}
                        </label>
                        <input
                          name={`granted_${type.id}`}
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={override ?? ""}
                          placeholder={type.max_days_per_year !== null ? String(type.max_days_per_year) : "ไม่จำกัด"}
                          className="input"
                          disabled={!canEdit}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          ใช้ไป {usedDays} วัน · คงเหลือ {remainingText(effectiveGranted, usedDays)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {canEdit && (
                  <button type="submit" className="btn-primary mt-3">
                    บันทึกสิทธิ์ของ {emp.full_name}
                  </button>
                )}
              </form>
            );
          })}
        </div>
      )}
    </main>
  );
}

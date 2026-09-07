import Link from "next/link";
import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
import { findPayrollDuplicates, listBranches, listEmployees } from "@/lib/db";
import type { Employee } from "@/lib/types";
import { importPastedForm, savePayrollCodesForm } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  company?: string;
  branch?: string;
  only?: string;
  msg?: string;
  err?: string;
};

export default async function PayrollMapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const access = await requireMenuAccess("ATT_PAYROLL_MAP", "read");
  const scope = await getCompanyScope(params.company);

  const branchId = params.branch || undefined;
  const onlyUnmapped = params.only === "unmapped";

  const [allBranches, allEmployees] = await Promise.all([
    listBranches(true, scope.companyId),
    listEmployees({ activeOnly: true, branchId, companyId: scope.companyId }),
  ]);

  // ผู้ใช้ที่เข้าด้วยสิทธิ์รายเมนู เห็นเฉพาะสาขาในขอบเขตของตัวเอง
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const scoped = access.branchIds
    ? allEmployees.filter((e) => e.branch_id !== null && access.branchIds!.has(e.branch_id))
    : allEmployees;

  // นับคนที่ยังไม่จับคู่ของ "ทุกบริษัท" ด้วย ไม่งั้นเปิดมาเจอบริษัทที่ครบแล้วจะนึกว่าไม่เหลือใคร
  const otherCompanies = await Promise.all(
    scope.companies
      .filter((c) => c.id !== scope.companyId)
      .map(async (c) => {
        const staff = await listEmployees({ activeOnly: true, companyId: c.id });
        const inScope = access.branchIds
          ? staff.filter((e) => e.branch_id !== null && access.branchIds!.has(e.branch_id))
          : staff;
        return { company: c, remaining: inScope.filter((e) => !e.payroll_code).length };
      }),
  );
  const pending = otherCompanies.filter((c) => c.remaining > 0);

  const mappedCount = scoped.filter((e) => e.payroll_code).length;
  const duplicates = findPayrollDuplicates(scoped);
  const employees = onlyUnmapped ? scoped.filter((e) => !e.payroll_code) : scoped;
  const canEdit = access.rights.can_edit;
  const canWrite = access.rights.can_write;

  // จัดกลุ่มตามสาขา เพื่อให้คีย์ทีละสาขาได้ง่าย
  const byBranch = new Map<string, { name: string; list: Employee[] }>();
  for (const e of employees) {
    const key = e.branch_id ?? "none";
    const entry = byBranch.get(key) ?? { name: e.branch_name ?? "ไม่ระบุสาขา", list: [] };
    entry.list.push(e);
    byBranch.set(key, entry);
  }
  const groups = [...byBranch.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));

  const viewHidden = (
    <>
      <input type="hidden" name="view_company" value={scope.companyId ?? ""} />
      <input type="hidden" name="view_branch" value={params.branch ?? ""} />
      <input type="hidden" name="view_only" value={params.only ?? ""} />
    </>
  );

  return (
    <>
      {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">จับคู่รหัสเงินเดือน</h1>
          <p className="text-sm text-slate-500">
            ผูกรหัสพนักงานของระบบลงเวลา (เช่น K2S001) เข้ากับรหัสจากระบบเงินเดือน (เช่น K2009) ·
            เมื่อจับคู่แล้ว รายงานทุกแบบจะแสดงรหัสทั้งสองชุด
            {scope.companyName ? ` · ${scope.companyName}` : ""}
          </p>
        </div>

        {params.msg && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
        )}
        {params.err && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
        )}

        {/* ---------- สรุป + ตัวกรอง ---------- */}
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge bg-emerald-50 text-emerald-700">
              จับคู่แล้ว {mappedCount} คน
            </span>
            <span className={`badge ${scoped.length - mappedCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              ยังไม่จับคู่ {scoped.length - mappedCount} คน
            </span>
            <span className="text-xs text-slate-500">จากพนักงานที่ยังทำงานอยู่ {scoped.length} คน</span>
          </div>

          {pending.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span>บริษัทอื่นยังจับคู่ไม่ครบ:</span>
              {pending.map((c) => (
                <Link
                  key={c.company.id}
                  href={`/admin/payroll-map?company=${c.company.id}&only=unmapped`}
                  className="badge bg-white text-amber-800 underline"
                >
                  {c.company.name} · เหลือ {c.remaining} คน
                </Link>
              ))}
            </p>
          )}

          <form method="get" className="flex flex-wrap items-end gap-3">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
            <BranchFilter branches={branches} value={params.branch} />
            <div>
              <label className="label" htmlFor="only">
                แสดง
              </label>
              <select id="only" name="only" defaultValue={params.only ?? ""} className="input">
                <option value="">ทุกคน</option>
                <option value="unmapped">เฉพาะที่ยังไม่จับคู่</option>
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              แสดง
            </button>
          </form>

          {duplicates.length > 0 && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">รหัสเงินเดือนซ้ำกัน {duplicates.length} รหัส</p>
              <ul className="list-inside list-disc text-xs">
                {duplicates.map((d) => (
                  <li key={d.code}>
                    {d.code} — {d.employees.map((e) => `${e.emp_code} ${e.full_name}`).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ---------- วางจาก Excel ---------- */}
        {canWrite && (
          <details className="card">
            <summary className="cursor-pointer font-semibold text-slate-800">
              วางข้อมูลจาก Excel แล้วให้ระบบจับคู่ชื่อให้
            </summary>
            <form action={importPastedForm} className="mt-3 space-y-3">
              {viewHidden}
              <p className="text-xs text-slate-500">
                ก๊อปจาก Excel ทั้งคอลัมน์ <strong>รหัส · ชื่อ · ชื่อเล่น</strong> (ชื่อเล่นไม่บังคับ) มาวางในช่องนี้ได้เลย
                — ระบบจับคู่ตามชื่อ ถ้าชื่อซ้ำหรือหาไม่เจอจะข้ามไว้ให้คีย์เอง
              </p>
              <textarea
                name="pasted"
                rows={6}
                className="input font-mono text-xs"
                placeholder={"K2009\tน.ส.กาญจนรินทร์ ปรีดา\tแก้ว\nK0004\tน.ส.สุทธิลักษณ์ กันบัว\tแหมว"}
                required
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="overwrite" />
                  ทับรหัสเดิมที่จับคู่ไว้แล้ว
                </label>
                <button type="submit" className="btn-primary">
                  จับคู่และบันทึก
                </button>
              </div>
            </form>
          </details>
        )}

        {/* ---------- ตารางคีย์รหัส ---------- */}
        <form action={savePayrollCodesForm} className="space-y-4">
          {viewHidden}

          {employees.length === 0 ? (
            <p className="card py-6 text-center text-sm text-slate-500">
              {onlyUnmapped ? "จับคู่ครบทุกคนแล้ว 🎉" : "ไม่มีพนักงานตามตัวกรองที่เลือก"}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.name} className="card space-y-2">
                <h2 className="font-semibold text-slate-800">
                  {g.name} <span className="text-xs font-normal text-slate-500">({g.list.length} คน)</span>
                </h2>
                <div className="table-wrap">
                  <table className="table-report">
                    <thead>
                      <tr>
                        <th>รหัสลงเวลา</th>
                        <th>ชื่อ-สกุล</th>
                        <th>ชื่อเล่น</th>
                        <th>ตำแหน่ง</th>
                        <th>รหัสเงินเดือน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.list.map((e) => (
                        <tr key={e.id} className={e.payroll_code ? "" : "bg-amber-50/40"}>
                          <td className="font-medium">{e.emp_code}</td>
                          <td className="text-left">{e.full_name}</td>
                          <td>{e.nickname ?? "-"}</td>
                          <td>{e.position_name ?? "-"}</td>
                          <td>
                            <input type="hidden" name={`original_${e.id}`} value={e.payroll_code ?? ""} />
                            <input
                              name={`code_${e.id}`}
                              defaultValue={e.payroll_code ?? ""}
                              className="input w-36"
                              placeholder="เช่น K2009"
                              disabled={!canEdit}
                              aria-label={`รหัสเงินเดือนของ ${e.full_name}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}

          {canEdit && employees.length > 0 && (
            <div className="sticky bottom-0 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
              <button type="submit" className="btn-primary">
                บันทึกรหัสที่แก้ทั้งหมด
              </button>
              <span className="text-xs text-slate-500">บันทึกเฉพาะช่องที่แก้ · ล้างช่องให้ว่าง = เอารหัสออก</span>
            </div>
          )}
        </form>
      </main>
    </>
  );
}

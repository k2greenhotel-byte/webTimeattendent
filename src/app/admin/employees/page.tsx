import CreateEmployeeForm from "@/components/CreateEmployeeForm";
import { listBranches, listDepartments, listEmployees, listPositions } from "@/lib/db";
import { deleteEmployeeForm, resetPinForm, updateEmployeeForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = params.branch || undefined;
  const [employees, branches, departments, positions] = await Promise.all([
    listEmployees({ branchId }),
    listBranches(),
    listDepartments(),
    listPositions(),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">จัดการพนักงาน</h1>
          <p className="text-sm text-slate-500">
            พนักงานเข้าระบบด้วย <strong>เบอร์มือถือ + รหัสผ่าน</strong> (เบอร์ห้ามซ้ำกัน) ·
            พนักงานเปลี่ยนรหัสผ่านเองได้ที่หน้า &quot;ประวัติของฉัน&quot;
          </p>
        </div>

        <form method="get" className="flex items-end gap-2">
          <div>
            <label className="label" htmlFor="branch">
              กรองตามสาขา
            </label>
            <select id="branch" name="branch" defaultValue={branchId ?? ""} className="input">
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
        </form>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <CreateEmployeeForm branches={branches} departments={departments} positions={positions} />

      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">รายชื่อพนักงาน ({employees.length} คน)</h2>

        {employees.map((emp) => (
          <div key={emp.id} className="rounded-xl border border-slate-200 p-3">
            <form action={updateEmployeeForm} className="grid items-end gap-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={emp.id} />

              <div>
                <span className="label">รหัส</span>
                <p className="pt-2 font-mono text-sm">{emp.emp_code}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">ชื่อ-สกุล</label>
                <input name="full_name" defaultValue={emp.full_name} className="input" required />
              </div>
              <div>
                <label className="label">ชื่อเล่น</label>
                <input name="nickname" defaultValue={emp.nickname ?? ""} className="input" />
              </div>
              <div>
                <label className="label">เบอร์มือถือ (ใช้เข้าระบบ)</label>
                <input
                  name="phone"
                  defaultValue={emp.phone ?? ""}
                  className="input"
                  inputMode="numeric"
                  placeholder="08xxxxxxxx"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">อีเมล</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={emp.email ?? ""}
                  className="input"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="label">สาขา</label>
                <select name="branch_id" defaultValue={emp.branch_id ?? ""} className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">แผนก</label>
                <select name="department_id" defaultValue={emp.department_id ?? ""} className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ตำแหน่ง</label>
                <select name="position_id" defaultValue={emp.position_id ?? ""} className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">สิทธิ์</label>
                <select name="role" defaultValue={emp.role} className="input">
                  <option value="employee">พนักงาน</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked={emp.is_active} />
                ใช้งานอยู่
              </label>
              <button type="submit" className="btn-secondary">
                บันทึก
              </button>
            </form>

            <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-slate-200 pt-2">
              <form action={resetPinForm} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={emp.id} />
                <div>
                  <label className="label">รีเซ็ตรหัสผ่าน (4-8 หลัก)</label>
                  <input
                    name="pin"
                    className="input w-40"
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    maxLength={8}
                    placeholder="1234"
                    required
                  />
                </div>
                <button type="submit" className="btn-secondary">
                  ตั้งรหัสผ่านใหม่
                </button>
              </form>

              <form action={deleteEmployeeForm}>
                <input type="hidden" name="id" value={emp.id} />
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบพนักงานถาวร (ลบประวัติการลงเวลาทั้งหมดด้วย)
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

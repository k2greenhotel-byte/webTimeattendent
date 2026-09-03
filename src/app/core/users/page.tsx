import Link from "next/link";
import { listCompanies, listCoreUsers, listPrograms } from "@/lib/core-db";
import { ACCESS_LEVELS, ACCESS_LEVEL_HINT, ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { listBranches } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { createUserForm, deleteUserForm, saveUserProgramsForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; q?: string }>;
}) {
  const params = await searchParams;
  const keyword = (params.q ?? "").trim().toLowerCase();

  const [users, companies, branches, programs] = await Promise.all([
    listCoreUsers(),
    listCompanies(),
    listBranches(),
    listPrograms(true),
  ]);

  const shown = keyword
    ? users.filter((u) =>
        [u.username, u.emp_code, u.full_name, u.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(keyword)),
      )
    : users;

  const scopeText = (u: (typeof users)[number]) => {
    const c = u.all_companies ? "ทุกบริษัท" : `${u.company_ids.length} บริษัท`;
    const b = u.all_branches ? "ทุกสาขา" : `${u.branch_ids.length} สาขา`;
    return `${c} · ${b}`;
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">กำหนดผู้ใช้งาน</h1>
        <p className="text-sm text-slate-500">
          User ID ชื่อผู้ใช้ รหัสผ่าน และสถานะ · เลือกโปรแกรมที่ใช้งานได้จากในตารางแล้วกดบันทึกในแถวนั้น — กดที่ชื่อเพื่อกำหนดบริษัท/สาขาและสิทธิ์รายเมนูละเอียด
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={createUserForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มผู้ใช้งานใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">User ID *</label>
            <input name="username" className="input" placeholder="somchai" required />
          </div>
          <div>
            <label className="label">รหัสพนักงาน (เว้นว่าง = ใช้ User ID)</label>
            <input name="emp_code" className="input" placeholder="EMP001" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อผู้ใช้งาน *</label>
            <input name="full_name" className="input" placeholder="สมชาย ใจดี" required />
          </div>
          <div>
            <label className="label">เบอร์มือถือ (ใช้เข้าระบบ)</label>
            <input name="phone" className="input" inputMode="numeric" placeholder="0812345678" />
          </div>
          <div>
            <label className="label">รหัสผ่าน (4-8 หลัก) *</label>
            <input
              name="pin"
              className="input"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="123456"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ระดับการทำงาน</label>
            <select name="access_level" defaultValue="user" className="input">
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {ACCESS_LEVEL_LABEL[l]} — {ACCESS_LEVEL_HINT[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="all_companies" />
            เข้าถึงได้ทุกบริษัท ({companies.length} บริษัท)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="all_branches" />
            เข้าถึงได้ทุกสาขา ({branches.length} สาขา)
          </label>
        </div>

        <div>
          <span className="label">โปรแกรมที่ใช้งานได้</span>
          <div className="flex flex-wrap gap-3">
            {programs.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="program_ids" value={p.id} defaultChecked />
                {p.icon} {p.name}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          เพิ่มผู้ใช้งาน
        </button>
        <p className="text-xs text-slate-500">
          ผู้ใช้เข้าระบบด้วย <strong>เบอร์มือถือ + รหัสผ่าน</strong> และเปลี่ยนรหัสผ่านเองได้จากหน้าล็อกอิน
        </p>
      </form>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-semibold text-slate-800">
            ผู้ใช้งานทั้งหมด ({shown.length}
            {keyword ? ` จาก ${users.length}` : ""})
          </h2>
          <form method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              className="input w-56"
              placeholder="ค้นหา User ID / ชื่อ / เบอร์"
            />
            <button type="submit" className="btn-secondary">
              ค้นหา
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="table-report">
            <thead>
              <tr>
                <th>User ID</th>
                <th>รหัสพนักงาน</th>
                <th>ชื่อผู้ใช้งาน</th>
                <th>เบอร์มือถือ</th>
                <th>ระดับ</th>
                <th>ขอบเขต</th>
                <th>โปรแกรมที่ใช้งานได้ ({programs.length})</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.username ?? "-"}</td>
                  <td>{u.emp_code}</td>
                  <td className="text-left">
                    <Link href={`/core/users/${u.id}`} className="text-brand-600 hover:underline">
                      {u.full_name}
                    </Link>
                  </td>
                  <td>{formatPhone(u.phone)}</td>
                  <td>{ACCESS_LEVEL_LABEL[u.access_level]}</td>
                  <td>{scopeText(u)}</td>
                  <td className="text-left">
                    <form
                      action={saveUserProgramsForm}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="full_name" value={u.full_name} />
                      <input type="hidden" name="q" value={params.q ?? ""} />

                      {programs.map((p) => (
                        <label
                          key={p.id}
                          title={p.name}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            name="program_ids"
                            value={p.id}
                            defaultChecked={u.program_ids.includes(p.id)}
                          />
                          {p.icon} {p.code}
                        </label>
                      ))}

                      <button
                        type="submit"
                        className="rounded-lg border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs text-brand-700 hover:bg-brand-100"
                      >
                        บันทึก
                      </button>
                    </form>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.is_active ? "ใช้งานได้" : "ยกเลิก"}
                    </span>
                  </td>
                  <td>
                    <form action={deleteUserForm} className="flex items-center justify-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input type="checkbox" name="confirm" />
                        ยืนยัน
                      </label>
                      <button type="submit" className="text-xs text-rose-600 hover:underline">
                        ลบ
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shown.length === 0 && (
          <p className="text-sm text-slate-500">ไม่พบผู้ใช้งานที่ตรงกับคำค้น</p>
        )}
      </section>
    </main>
  );
}

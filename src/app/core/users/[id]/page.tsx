import Link from "next/link";
import { notFound } from "next/navigation";
import PermissionMatrix, { type MatrixRow } from "@/components/core/PermissionMatrix";
import {
  getCoreUser,
  getLevelPermissions,
  getUserOverrides,
  listCompanies,
  listMenus,
  listPrograms,
} from "@/lib/core-db";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_HINT,
  ACCESS_LEVEL_LABEL,
  type MenuRights,
} from "@/lib/core-types";
import { listBranches } from "@/lib/db";
import { NO_RIGHTS } from "@/lib/permissions";
import { resetPinForm, saveProfileForm, savePermissionsForm, saveScopeForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const user = await getCoreUser(id);
  if (!user) notFound();

  const [companies, branches, programs, menus, overrides, levelDefaults] = await Promise.all([
    listCompanies(),
    listBranches(),
    listPrograms(),
    listMenus(),
    getUserOverrides(id),
    getLevelPermissions(user.access_level),
  ]);

  const programName = new Map(programs.map((p) => [p.id, p]));

  // แสดงเฉพาะเมนูของโปรแกรมที่คนนี้มีสิทธิ์เข้า (เมนู 5) — โปรแกรมอื่นไม่ต้องกำหนดอะไร
  const hiddenPrograms = programs.filter((p) => !user.program_ids.includes(p.id));
  const shownMenus = menus.filter((m) => user.program_ids.includes(m.program_id));

  const rows: MatrixRow[] = shownMenus.map((m) => ({
    menu_id: m.id,
    menu_code: m.code,
    menu_name: m.name,
    menu_kind: m.kind,
    program_code: programName.get(m.program_id)?.code ?? "-",
    program_name: programName.get(m.program_id)?.name ?? "ไม่ระบุโปรแกรม",
    override: (overrides.get(m.id) as MenuRights | undefined) ?? null,
    levelDefault: levelDefaults.get(m.id) ?? NO_RIGHTS,
    hasProgramAccess: true,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{user.full_name}</h1>
          <p className="text-sm text-slate-500">
            User ID {user.username ?? "-"} · รหัสพนักงาน {user.emp_code} ·{" "}
            {ACCESS_LEVEL_LABEL[user.access_level]}
          </p>
        </div>
        <Link href="/core/users" className="btn-secondary">
          ← กลับรายชื่อผู้ใช้งาน
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {/* ---------- ข้อมูลบัญชี ---------- */}
      <form action={saveProfileForm} className="card space-y-3">
        <input type="hidden" name="id" value={user.id} />
        <h2 className="font-semibold text-slate-800">ข้อมูลบัญชี</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">User ID</label>
            <input name="username" defaultValue={user.username ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อผู้ใช้งาน *</label>
            <input name="full_name" defaultValue={user.full_name} className="input" required />
          </div>
          <div>
            <label className="label">เบอร์มือถือ (ใช้เข้าระบบ)</label>
            <input name="phone" defaultValue={user.phone ?? ""} className="input" inputMode="numeric" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">ระดับการทำงาน</label>
            <select name="access_level" defaultValue={user.access_level} className="input">
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {ACCESS_LEVEL_LABEL[l]} — {ACCESS_LEVEL_HINT[l]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" name="is_active" defaultChecked={user.is_active} />
            สถานะ: ใช้งานได้ (ไม่ติ๊ก = ยกเลิก)
          </label>
        </div>
        <button type="submit" className="btn-primary">
          บันทึกข้อมูลบัญชี
        </button>
      </form>

      {/* ---------- รหัสผ่าน ---------- */}
      <form action={resetPinForm} className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={user.id} />
        <div>
          <h2 className="font-semibold text-slate-800">ตั้งรหัสผ่านใหม่</h2>
          <p className="text-sm text-slate-500">
            ใช้เมื่อผู้ใช้ลืมรหัส — ผู้ใช้เปลี่ยนเองได้ที่หน้าล็อกอิน
          </p>
        </div>
        <div className="ml-auto">
          <label className="label">รหัสผ่านใหม่ (4-8 หลัก)</label>
          <input name="pin" className="input" inputMode="numeric" pattern="\d{4,8}" required />
        </div>
        <button type="submit" className="btn-secondary">
          ตั้งรหัสผ่านใหม่
        </button>
      </form>

      {/* ---------- ขอบเขตบริษัท/สาขา/โปรแกรม ---------- */}
      <form action={saveScopeForm} className="card space-y-4">
        <input type="hidden" name="id" value={user.id} />
        <div>
          <h2 className="font-semibold text-slate-800">บริษัท สาขา และโปรแกรมที่ทำงานได้</h2>
          <p className="text-sm text-slate-500">
            ติ๊ก &quot;ทุกบริษัท/ทุกสาขา&quot; แล้วไม่ต้องเลือกรายตัว (สาขาที่เปิดใหม่จะเข้าได้เองอัตโนมัติ)
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="all_companies" defaultChecked={user.all_companies} />
              เข้าถึงได้ทุกบริษัท
            </label>
            <div className="space-y-1 rounded-xl border border-slate-200 p-3">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="company_ids"
                    value={c.id}
                    defaultChecked={user.company_ids.includes(c.id)}
                  />
                  {c.code} · {c.name}
                  {!c.is_active && <span className="text-xs text-slate-400">(ปิดใช้งาน)</span>}
                </label>
              ))}
              {companies.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีบริษัท</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="all_branches" defaultChecked={user.all_branches} />
              เข้าถึงได้ทุกสาขา
            </label>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="branch_ids"
                    value={b.id}
                    defaultChecked={user.branch_ids.includes(b.id)}
                  />
                  {b.code} · {b.name}
                  {!b.is_active && <span className="text-xs text-slate-400">(ปิดใช้งาน)</span>}
                </label>
              ))}
              {branches.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีสาขา</p>}
            </div>
          </div>
        </div>

        <div>
          <span className="label">โปรแกรมที่ใช้งานได้</span>
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 p-3">
            {programs.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="program_ids"
                  value={p.id}
                  defaultChecked={user.program_ids.includes(p.id)}
                />
                {p.icon} {p.name}
                {!p.is_active && <span className="text-xs text-slate-400">(ปิดใช้งาน)</span>}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          บันทึกขอบเขตการทำงาน
        </button>
      </form>

      {/* ---------- สิทธิ์รายเมนู ---------- */}
      <form action={savePermissionsForm} className="card space-y-4">
        <input type="hidden" name="id" value={user.id} />
        <div>
          <h2 className="font-semibold text-slate-800">สิทธิ์รายเมนู (อ่าน / เพิ่ม / แก้ไข / ลบ)</h2>
          <p className="text-sm text-slate-500">
            แถวที่ติ๊ก &quot;ตามระดับ&quot; จะใช้ค่าเริ่มต้นของ{" "}
            <Link href="/core/levels" className="text-brand-600 hover:underline">
              {ACCESS_LEVEL_LABEL[user.access_level]}
            </Link>{" "}
            — เอาติ๊กออกเพื่อกำหนดเฉพาะคนนี้ · แสดงเฉพาะโปรแกรมที่มีสิทธิ์เข้า (
            <Link href="/core/program-rights" className="text-brand-600 hover:underline">
              กำหนดจากฝั่งโปรแกรมได้ที่เมนู 4
            </Link>
            )
          </p>
        </div>

        {hiddenPrograms.length > 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ไม่แสดงอีก {hiddenPrograms.length} โปรแกรม (
            {hiddenPrograms.map((p) => p.name).join(", ")}) เพราะยังไม่ได้ให้สิทธิ์เข้าโปรแกรม —
            ติ๊กที่ &quot;โปรแกรมที่ใช้งานได้&quot; ด้านบนแล้วบันทึกก่อน จึงจะกำหนดสิทธิ์รายเมนูได้
          </p>
        )}

        {rows.length === 0 && (
          <p className="text-sm text-slate-500">ยังไม่มีสิทธิ์เข้าโปรแกรมใดเลย</p>
        )}

        <PermissionMatrix
          rows={rows}
          readOnlyNote={
            user.access_level === "admin"
              ? "ผู้ใช้ระดับ Admin ได้ทุกสิทธิ์ทุกเมนูเสมอ ค่าที่ตั้งในตารางนี้จะยังไม่มีผลจนกว่าจะเปลี่ยนระดับ"
              : undefined
          }
        />

        <button type="submit" className="btn-primary">
          บันทึกสิทธิ์รายเมนู
        </button>
      </form>
    </main>
  );
}

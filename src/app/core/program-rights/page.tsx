import Link from "next/link";
import PermissionMatrix, { type MatrixRow } from "@/components/core/PermissionMatrix";
import {
  getLevelPermissions,
  getProgramPermissions,
  getUserOverrides,
  listCoreUsers,
  listMenus,
  listPrograms,
} from "@/lib/core-db";
import { ACCESS_LEVEL_LABEL, type EffectiveMenuPermission, type MenuRights } from "@/lib/core-types";
import { NO_RIGHTS, summarizeAccess } from "@/lib/permissions";
import {
  copyRightsToProgramForm,
  resetProgramOverridesForm,
  saveProgramUserRightsForm,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * เมนู 4: กำหนดสิทธิ์เมนูในโปรแกรม
 * เลือกโปรแกรม → เห็นเฉพาะคนที่มีสิทธิ์เข้าโปรแกรม (จากเมนู 5) → เลือกคน → ติ๊กว่าเข้าเมนูไหนได้ ทำอะไรได้
 */
export default async function ProgramRightsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; user?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;

  const [programs, users, menus] = await Promise.all([listPrograms(), listCoreUsers(), listMenus()]);

  const current = programs.find((p) => p.id === params.program) ?? programs[0] ?? null;
  const programMenus = current
    ? menus.filter((m) => m.program_id === current.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // เฉพาะคนที่มีสิทธิ์เข้าโปรแกรมนี้ตามเมนู 5 — คนอื่นไม่ต้องกำหนดอะไร จึงไม่แสดง
  const programUsers = current
    ? users
        .filter((u) => u.program_ids.includes(current.id))
        .sort((a, b) => a.emp_code.localeCompare(b.emp_code))
    : [];

  const perms = current ? await getProgramPermissions(current.code) : [];
  const permsByUser = new Map<string, EffectiveMenuPermission[]>();
  for (const p of perms) {
    permsByUser.set(p.user_id, [...(permsByUser.get(p.user_id) ?? []), p]);
  }

  const selected = programUsers.find((u) => u.id === params.user) ?? null;
  const [overrides, levelDefaults] = selected
    ? await Promise.all([getUserOverrides(selected.id), getLevelPermissions(selected.access_level)])
    : [new Map<string, MenuRights>(), new Map<string, MenuRights>()];

  const rows: MatrixRow[] = current
    ? programMenus.map((m) => ({
        menu_id: m.id,
        menu_code: m.code,
        menu_name: m.name,
        menu_kind: m.kind,
        program_code: current.code,
        program_name: current.name,
        override: overrides.get(m.id) ?? null,
        levelDefault: levelDefaults.get(m.id) ?? NO_RIGHTS,
        hasProgramAccess: true,
      }))
    : [];

  const countWithAccess = (programId: string) =>
    users.filter((u) => u.program_ids.includes(programId)).length;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">กำหนดสิทธิ์เมนูในโปรแกรม</h1>
        <p className="text-sm text-slate-500">
          ยึดตาม{" "}
          <Link href="/core/program-users" className="text-brand-600 hover:underline">
            5. ผู้ใช้งานโปรแกรม
          </Link>{" "}
          เป็นหลัก — เลือกโปรแกรม แล้วกำหนดให้คนที่มีสิทธิ์เข้าโปรแกรมนั้นว่าเข้าหน้าจอ/เมนูไหนได้ และ
          อ่าน / เพิ่ม / แก้ไข / ลบ ได้ในเมนูใดบ้าง · คนที่ไม่มีสิทธิ์เข้าโปรแกรมจะไม่แสดงในหน้านี้
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- 1. เลือกโปรแกรม ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {programs.map((p) => (
          <Link
            key={p.id}
            href={`/core/program-rights?program=${p.id}`}
            className={`card block ${p.id === current?.id ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
          >
            <p className="font-semibold text-slate-800">
              {p.icon} {p.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.code} · {menus.filter((m) => m.program_id === p.id).length} เมนู
              {p.is_active ? "" : " · ปิดใช้งานอยู่"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              ผู้ใช้ที่เข้าได้ <strong className="text-slate-800">{countWithAccess(p.id)}</strong> /{" "}
              {users.length} คน
            </p>
          </Link>
        ))}
      </div>

      {!current && (
        <p className="card text-sm text-slate-600">
          ยังไม่มีโปรแกรมในระบบ — เพิ่มได้ที่{" "}
          <Link href="/core/programs" className="text-brand-600 hover:underline">
            ทะเบียนโปรแกรม
          </Link>
        </p>
      )}

      {current && (
        <>
          {/* ---------- 2. ผู้ใช้ที่มีสิทธิ์เข้าโปรแกรมนี้ ---------- */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800">
                  ผู้ใช้ที่เข้า {current.icon} {current.name} ได้ ({programUsers.length} คน)
                </h2>
                <p className="text-sm text-slate-500">
                  กดที่ชื่อเพื่อกำหนดเมนูและสิทธิ์ของคนนั้น · &quot;เข้าได้ X/Y เมนู&quot; = เมนูที่เปิดดูได้จากทั้งหมดในโปรแกรมนี้
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  href={`/core/program-users?program=${current.id}`}
                  className="text-brand-600 hover:underline"
                >
                  เพิ่ม/ลดผู้ใช้ของโปรแกรมนี้ (เมนู 5) →
                </Link>
                <Link href="/core/levels" className="text-slate-500 hover:underline">
                  ค่าเริ่มต้นตามระดับ (แม่แบบ) →
                </Link>
              </div>
            </div>

            {programUsers.length === 0 ? (
              <p className="text-sm text-slate-500">
                ยังไม่มีใครมีสิทธิ์เข้าโปรแกรมนี้ — ไปให้สิทธิ์ที่เมนู 5 ก่อน แล้วค่อยกลับมากำหนดเมนู
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-report">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>รหัสพนักงาน</th>
                      <th className="text-left">ชื่อผู้ใช้งาน</th>
                      <th>ระดับ</th>
                      <th>เข้าได้ (เมนู)</th>
                      <th>กำหนดเฉพาะราย</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programUsers.map((u) => {
                      const summary = summarizeAccess(permsByUser.get(u.id) ?? []);
                      const isSelected = u.id === selected?.id;
                      return (
                        <tr key={u.id} className={isSelected ? "bg-brand-50/60" : ""}>
                          <td>{u.username ?? "-"}</td>
                          <td>{u.emp_code}</td>
                          <td className="text-left">
                            <Link
                              href={`/core/program-rights?program=${current.id}&user=${u.id}`}
                              className={`hover:underline ${isSelected ? "font-semibold text-brand-700" : "text-brand-600"}`}
                            >
                              {u.full_name}
                            </Link>
                          </td>
                          <td className="text-xs text-slate-500">{ACCESS_LEVEL_LABEL[u.access_level]}</td>
                          <td>
                            <span
                              className={`badge ${
                                summary.readable === 0
                                  ? "bg-rose-50 text-rose-700"
                                  : summary.readable === summary.total
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {summary.readable} / {summary.total}
                            </span>
                          </td>
                          <td className="text-xs text-slate-500">
                            {summary.overrides > 0 ? `${summary.overrides} เมนู` : "ตามระดับทั้งหมด"}
                          </td>
                          <td>
                            <span
                              className={`badge ${u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                            >
                              {u.is_active ? "ใช้งานได้" : "ยกเลิก"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------- 3. สิทธิ์รายเมนูของคนที่เลือก ---------- */}
          {selected && (
            <>
              <form action={saveProgramUserRightsForm} className="card space-y-4">
                <input type="hidden" name="program_id" value={current.id} />
                <input type="hidden" name="user_id" value={selected.id} />
                <input type="hidden" name="user_name" value={selected.full_name} />
                <div>
                  <h2 className="font-semibold text-slate-800">
                    เมนูใน {current.icon} {current.name} ของ {selected.full_name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    ติ๊ก &quot;อ่าน&quot; = เข้าหน้าจอนั้นได้ · แถวที่ติ๊ก &quot;ตามระดับ&quot; ใช้ค่าเริ่มต้นของ{" "}
                    <Link
                      href={`/core/levels?level=${selected.access_level}`}
                      className="text-brand-600 hover:underline"
                    >
                      {ACCESS_LEVEL_LABEL[selected.access_level]}
                    </Link>{" "}
                    — เอาติ๊กออกเพื่อกำหนดเฉพาะคนนี้ · บันทึกแล้วมีผลเฉพาะเมนูของโปรแกรมนี้
                  </p>
                </div>

                <PermissionMatrix
                  rows={rows}
                  readOnlyNote={
                    selected.access_level === "admin"
                      ? "ผู้ใช้ระดับ Admin ได้ทุกสิทธิ์ทุกเมนูเสมอ ค่าที่ตั้งตรงนี้จะยังไม่มีผลจนกว่าจะเปลี่ยนระดับ"
                      : undefined
                  }
                />

                <button type="submit" className="btn-primary">
                  บันทึกสิทธิ์ของ {selected.full_name}
                </button>
              </form>

              <div className="grid gap-3 sm:grid-cols-2">
                <form action={copyRightsToProgramForm} className="card space-y-2">
                  <input type="hidden" name="program_id" value={current.id} />
                  <input type="hidden" name="user_id" value={selected.id} />
                  <input type="hidden" name="user_name" value={selected.full_name} />
                  <h3 className="font-semibold text-slate-800">คัดลอกสิทธิ์ของคนนี้ไปให้ทุกคนในโปรแกรม</h3>
                  <p className="text-sm text-slate-500">
                    ตั้งคนหนึ่งให้ถูกต้องก่อน แล้วกดคัดลอกให้อีก {Math.max(programUsers.length - 1, 0)} คน
                    (ใช้เมนูที่บันทึกแล้วของคนนี้ ไม่ใช่ที่ยังไม่ได้กดบันทึก)
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="confirm" />
                      ยืนยัน แทนที่สิทธิ์เดิมของทุกคน
                    </label>
                    <button type="submit" className="btn-secondary">
                      คัดลอกให้ทุกคน
                    </button>
                  </div>
                </form>

                <form action={resetProgramOverridesForm} className="card space-y-2">
                  <input type="hidden" name="program_id" value={current.id} />
                  <input type="hidden" name="user_id" value={selected.id} />
                  <h3 className="font-semibold text-slate-800">รีเซ็ตทุกคนให้ใช้ค่าตามระดับ</h3>
                  <p className="text-sm text-slate-500">
                    ล้างค่าเฉพาะรายทั้งหมดของโปรแกรมนี้ ทุกคนกลับไปใช้แม่แบบของระดับตัวเอง
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="confirm" />
                      ยืนยัน
                    </label>
                    <button type="submit" className="btn-secondary text-rose-600">
                      รีเซ็ตทั้งโปรแกรม
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

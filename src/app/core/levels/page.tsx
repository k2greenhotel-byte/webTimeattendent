import Link from "next/link";
import { getLevelPermissions, listCoreUsers, listMenus, listPrograms } from "@/lib/core-db";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_HINT,
  ACCESS_LEVEL_LABEL,
  MENU_KIND_LABEL,
  PERM_ACTION_LABEL,
  type AccessLevel,
  type MenuRights,
  type PermAction,
} from "@/lib/core-types";
import { NO_RIGHTS } from "@/lib/permissions";
import { saveLevelPermissionsForm } from "./actions";

export const dynamic = "force-dynamic";

const ACTIONS: PermAction[] = ["read", "write", "edit", "delete"];
const FIELD: Record<PermAction, keyof MenuRights> = {
  read: "can_read",
  write: "can_write",
  edit: "can_edit",
  delete: "can_delete",
};

function asLevel(value: string | undefined): AccessLevel {
  return (ACCESS_LEVELS as string[]).includes(value ?? "") ? (value as AccessLevel) : "supervisor";
}

export default async function LevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const level = asLevel(params.level);

  const [programs, menus, defaults, users] = await Promise.all([
    listPrograms(),
    listMenus(),
    getLevelPermissions(level),
    listCoreUsers(),
  ]);

  const programById = new Map(programs.map((p) => [p.id, p]));
  const grouped = programs.map((p) => ({
    program: p,
    menus: menus.filter((m) => m.program_id === p.id),
  }));
  const orphans = menus.filter((m) => !programById.has(m.program_id));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ค่าเริ่มต้นสิทธิ์ตามระดับ (แม่แบบ)</h1>
        <p className="text-sm text-slate-500">
          ใช้เป็นค่าตั้งต้นให้ทุกคนในระดับนั้น <strong>เฉพาะโปรแกรมที่คนนั้นมีสิทธิ์เข้าตาม</strong>{" "}
          <Link href="/core/program-users" className="text-brand-600 hover:underline">
            5. ผู้ใช้งานโปรแกรม
          </Link>{" "}
          — ไม่มีสิทธิ์เข้าโปรแกรมก็ไม่ได้อะไรจากตรงนี้ · กำหนดรายคนรายเมนูได้ที่{" "}
          <Link href="/core/program-rights" className="text-brand-600 hover:underline">
            4. กำหนดสิทธิ์เมนูในโปรแกรม
          </Link>
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {ACCESS_LEVELS.map((l) => (
          <Link
            key={l}
            href={`/core/levels?level=${l}`}
            className={`card block ${l === level ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
          >
            <p className="font-semibold text-slate-800">{ACCESS_LEVEL_LABEL[l]}</p>
            <p className="mt-1 text-xs text-slate-500">{ACCESS_LEVEL_HINT[l]}</p>
            <p className="mt-2 text-sm text-slate-600">
              {users.filter((u) => u.access_level === l).length} คน
            </p>
          </Link>
        ))}
      </div>

      <form action={saveLevelPermissionsForm} className="card space-y-4">
        <input type="hidden" name="level" value={level} />
        <div>
          <h2 className="font-semibold text-slate-800">
            สิทธิ์เริ่มต้นของ {ACCESS_LEVEL_LABEL[level]}
          </h2>
          <p className="text-sm text-slate-500">
            {level === "admin"
              ? "ระดับ Admin ได้ทุกสิทธิ์ทุกเมนูเสมอโดยไม่สนค่าที่ตั้งไว้ (กันแอดมินล็อกตัวเองออกจากระบบ)"
              : "ติ๊กเพื่อให้สิทธิ์ ไม่ติ๊กคือไม่มีสิทธิ์"}
          </p>
        </div>

        {[...grouped, ...(orphans.length ? [{ program: null, menus: orphans }] : [])].map(
          ({ program, menus: list }) =>
            list.length > 0 && (
              <div key={program?.id ?? "orphan"} className="overflow-x-auto">
                <table className="table-report">
                  <thead>
                    <tr>
                      <th className="text-left">
                        {program ? `${program.icon ?? ""} ${program.name}` : "เมนูที่ไม่มีโปรแกรม"}
                      </th>
                      <th>ประเภทหน้าจอ</th>
                      {ACTIONS.map((a) => (
                        <th key={a}>{PERM_ACTION_LABEL[a]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => {
                      const rights = defaults.get(m.id) ?? NO_RIGHTS;
                      return (
                        <tr key={m.id}>
                          <td className="text-left">
                            <input type="hidden" name="menu_ids" value={m.id} />
                            {m.name}
                            <span className="ml-2 text-xs text-slate-400">{m.code}</span>
                          </td>
                          <td className="text-xs text-slate-500">{MENU_KIND_LABEL[m.kind]}</td>
                          {ACTIONS.map((a) => (
                            <td key={a}>
                              <input
                                type="checkbox"
                                name={`${a}__${m.id}`}
                                defaultChecked={rights[FIELD[a]]}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ),
        )}

        <button type="submit" className="btn-primary">
          บันทึกสิทธิ์ของระดับนี้
        </button>
      </form>
    </main>
  );
}

import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { listPrograms } from "@/lib/core-db";
import { ACCESS_LEVEL_LABEL, MENU_KIND_LABEL, type EffectiveMenuPermission } from "@/lib/core-types";
import { getLiveAccount, getMyPermissions, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้ารวมโปรแกรมขององค์กร — แสดงเฉพาะโปรแกรมและเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const live = await getLiveAccount();
  const closed = !live || !live.is_active;

  const [permissions, programs] = closed
    ? [[], []]
    : await Promise.all([getMyPermissions(), listPrograms(true)]);

  const byProgram = new Map<string, EffectiveMenuPermission[]>();
  for (const p of permissions) {
    if (!p.can_read) continue;
    byProgram.set(p.program_code, [...(byProgram.get(p.program_code) ?? []), p]);
  }

  const cards = programs
    .filter((p) => byProgram.has(p.code))
    .map((p) => ({
      program: p,
      menus: (byProgram.get(p.code) ?? []).slice().sort((a, b) => a.menu_name.localeCompare(b.menu_name, "th")),
    }));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="card flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-slate-800">โปรแกรมขององค์กร</h1>
          <p className="text-sm text-slate-500">
            {user.full_name} · {ACCESS_LEVEL_LABEL[live?.access_level ?? user.level]}
            {user.company_name ? ` · ${user.company_name}` : ""}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>
        <Link href="/select-context" className="btn-secondary">
          เปลี่ยนบริษัท/สาขา
        </Link>
        <Link href="/login/change-pin" className="btn-secondary">
          เปลี่ยนรหัสผ่าน
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="btn-secondary text-rose-600">
            ออกจากระบบ
          </button>
        </form>
      </header>

      {params.err && !closed && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {closed && (
        <p className="card text-sm text-rose-700">
          บัญชีนี้ถูกปิดการใช้งานหรือถูกลบออกจากระบบแล้ว — กดออกจากระบบแล้วติดต่อผู้ดูแลระบบ
        </p>
      )}

      {!closed && cards.length === 0 && (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าโปรแกรมใดเลย กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ program, menus }) => (
          <section key={program.id} className="card space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{program.icon ?? "📁"}</span>
              <div>
                <h2 className="font-semibold text-slate-800">
                  {program.path ? (
                    <Link href={program.path} className="hover:text-brand-600">
                      {program.name}
                    </Link>
                  ) : (
                    program.name
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  {program.code}
                  {program.description ? ` · ${program.description}` : ""}
                </p>
              </div>
            </div>

            <ul className="space-y-1">
              {menus.map((m) => (
                <li key={m.menu_id} className="flex items-center gap-2 text-sm">
                  <span className="badge bg-slate-100 text-slate-500">
                    {MENU_KIND_LABEL[m.menu_kind]}
                  </span>
                  {m.menu_path ? (
                    <Link href={m.menu_path} className="text-brand-600 hover:underline">
                      {m.menu_name}
                    </Link>
                  ) : (
                    <span className="text-slate-600">{m.menu_name}</span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">
                    {[
                      m.can_read && "อ่าน",
                      m.can_write && "เพิ่ม",
                      m.can_edit && "แก้ไข",
                      m.can_delete && "ลบ",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

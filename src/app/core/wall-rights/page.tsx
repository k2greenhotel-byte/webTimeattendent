import Link from "next/link";
import { getWallPermissions, listCoreUsers, listWallMenus } from "@/lib/core-db";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABEL, type AccessLevel } from "@/lib/core-types";
import { checkPermission, requirePermission } from "@/lib/session";
import { saveWallRightsForm } from "./actions";

export const dynamic = "force-dynamic";

/**
 * เมนู 4.1: สิทธิ์จอ War Room — รวมจอ War Room ของทุกโปรแกรมไว้ตารางเดียว
 * แถว = ผู้ใช้ · คอลัมน์ = จอ · ติ๊ก = เปิดดูจอนั้นได้ (ทั้งจอเดี่ยวและในจอรวม /wall)
 * ใช้สิทธิ์รายเมนู *_WALL ชุดเดียวกับหน้า "สิทธิ์เมนูในโปรแกรม" แค่มองจากมุมจอแทนมุมโปรแกรม
 */
export default async function WallRightsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; only?: string; msg?: string; err?: string }>;
}) {
  await requirePermission("CORE_WALL", "read");
  const params = await searchParams;
  const canEdit = await checkPermission("CORE_WALL", "edit");

  const [walls, users, perms] = await Promise.all([listWallMenus(), listCoreUsers(), getWallPermissions()]);

  // สิทธิ์ที่มีผลจริง: user_id → menu_id → { can_read, is_override }
  const readable = new Map<string, Map<string, { can_read: boolean; is_override: boolean }>>();
  for (const p of perms) {
    const row = readable.get(p.user_id) ?? new Map();
    row.set(p.menu_id, { can_read: p.can_read, is_override: p.is_override });
    readable.set(p.user_id, row);
  }
  const canSee = (userId: string, menuId: string) => readable.get(userId)?.get(menuId)?.can_read ?? false;

  const q = (params.q ?? "").trim().toLowerCase();
  const level = (ACCESS_LEVELS as string[]).includes(params.level ?? "") ? (params.level as AccessLevel) : null;
  const onlyGranted = params.only === "granted";

  const shown = users
    .filter((u) => u.is_active)
    .filter((u) => !level || u.access_level === level)
    .filter(
      (u) =>
        !q || [u.full_name, u.username, u.emp_code, u.phone].some((v) => (v ?? "").toLowerCase().includes(q)),
    )
    .filter((u) => !onlyGranted || walls.some((w) => canSee(u.id, w.id)))
    .sort((a, b) => a.emp_code.localeCompare(b.emp_code));

  const viewerCount = (menuId: string) =>
    users.filter((u) => u.is_active && canSee(u.id, menuId)).length;

  const shortName = (name: string) => name.replace(/^\d+\.\s*/, "").replace(/^จอ War Room\s*/, "");

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">สิทธิ์จอ War Room</h1>
        <p className="text-sm text-slate-500">
          ติ๊กว่าใครเปิดดูจอ War Room จอไหนได้บ้าง (จอเดี่ยวของแต่ละโปรแกรม และจอรวม{" "}
          <Link href="/wall" className="text-brand-600 hover:underline">
            /wall
          </Link>{" "}
          จะแสดงเฉพาะจอที่ติ๊กไว้) · ค่าเริ่มต้น: หัวหน้าขึ้นไปเห็นทุกจอ ผู้ใช้ทั่วไปไม่เห็น ·
          ติ๊กให้คนที่ยังไม่มีสิทธิ์เข้าโปรแกรมนั้น ระบบจะให้สิทธิ์เข้าโปรแกรมเพิ่มให้เอง ·
          สิทธิ์เมนูอื่น ๆ ตั้งที่{" "}
          <Link href="/core/program-rights" className="text-brand-600 hover:underline">
            4. สิทธิ์เมนูในโปรแกรม
          </Link>
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- สรุปรายจอ ---------- */}
      <div className="grid gap-2 sm:grid-cols-5">
        {walls.map((w) => (
          <Link key={w.id} href={w.path ?? "#"} className="card block py-2">
            <p className="text-sm font-semibold text-slate-800">
              {w.program_icon} {shortName(w.name)}
            </p>
            <p className="text-xs text-slate-500">
              {w.program_name} · เห็นได้ <strong className="text-slate-800">{viewerCount(w.id)}</strong> คน
            </p>
          </Link>
        ))}
      </div>

      {/* ---------- ค้นหา / กรอง ---------- */}
      <form method="get" action="/core/wall-rights" className="card grid gap-2 sm:flex sm:flex-wrap sm:items-end">
        <div className="sm:w-72">
          <label className="label">ค้นหาผู้ใช้</label>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="ชื่อ / User ID / รหัสพนักงาน / เบอร์"
            className="input"
            autoComplete="off"
          />
        </div>
        <div className="sm:w-48">
          <label className="label">ระดับการทำงาน</label>
          <select name="level" defaultValue={level ?? ""} className="input">
            <option value="">ทุกระดับ</option>
            {ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {ACCESS_LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" name="only" value="granted" defaultChecked={onlyGranted} />
          เฉพาะคนที่เห็นจออยู่แล้ว
        </label>
        <button type="submit" className="btn-secondary sm:py-2 sm:text-sm">
          ค้นหา
        </button>
        {(q || level || onlyGranted) && (
          <Link href="/core/wall-rights" className="pb-2 text-sm text-slate-500 hover:underline">
            ล้างตัวกรอง
          </Link>
        )}
        <span className="pb-2 text-sm text-slate-500">
          แสดง {shown.length} จาก {users.filter((u) => u.is_active).length} คน
        </span>
      </form>

      {/* ---------- ตารางติ๊ก ---------- */}
      <form action={saveWallRightsForm} className="card space-y-3">
        <input type="hidden" name="q" value={params.q ?? ""} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            ● = กำหนดเฉพาะราย (ต่างจากค่าเริ่มต้นของระดับ) · ระดับผู้ดูแลระบบเห็นทุกจอเสมอ แก้ไม่ได้
          </p>
          {canEdit && shown.length > 0 && (
            <button type="submit" className="btn-primary">
              บันทึก ({shown.length} คน)
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่พบผู้ใช้ตามเงื่อนไข</p>
        ) : (
          <div className="table-wrap overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white text-left">ผู้ใช้งาน</th>
                  <th>ระดับ</th>
                  {walls.map((w) => (
                    <th key={w.id} className="whitespace-normal px-1 text-xs">
                      <span className="block text-base">{w.program_icon}</span>
                      {shortName(w.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => {
                  const isAdmin = u.access_level === "admin";
                  return (
                    <tr key={u.id}>
                      <td className="sticky left-0 z-10 bg-white text-left">
                        <input type="hidden" name="user_ids" value={u.id} />
                        <Link href={`/core/users/${u.id}`} className="text-brand-600 hover:underline">
                          {u.full_name}
                        </Link>
                        <span className="ml-1 text-xs text-slate-400">
                          {u.username ?? u.emp_code}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">{ACCESS_LEVEL_LABEL[u.access_level]}</td>
                      {walls.map((w) => {
                        const cell = readable.get(u.id)?.get(w.id);
                        return (
                          <td key={w.id} className="text-center">
                            <label className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5">
                              <input
                                type="checkbox"
                                name={`r__${u.id}__${w.id}`}
                                defaultChecked={isAdmin || (cell?.can_read ?? false)}
                                disabled={isAdmin || !canEdit}
                                className="h-5 w-5"
                              />
                              {cell?.is_override && !isAdmin && (
                                <span className="text-[10px] text-brand-600" title="กำหนดเฉพาะราย">
                                  ●
                                </span>
                              )}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && shown.length > 0 && (
          <button type="submit" className="btn-primary">
            บันทึก ({shown.length} คน)
          </button>
        )}
      </form>
    </main>
  );
}

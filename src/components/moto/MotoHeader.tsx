import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { MOTO_MASTERS, masterTitle } from "@/lib/moto";
import type { SessionUser } from "@/lib/types";

/** แถบเมนูของโปรแกรมข้อมูลเบื้องต้น — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้เปิดดูได้ */
export default function MotoHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = MOTO_MASTERS.filter((m) => readableMenuCodes.includes(m.menuCode));

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">
            ข้อมูลเบื้องต้น · ธุรกิจรถจักรยานยนต์
            <span className="ml-2 font-normal text-slate-500">· {user.full_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            {user.emp_code}
            {user.company_name ? ` · ${user.company_name}` : ""}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          <Link
            href="/moto"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            หน้าแรก
          </Link>
          {menus.map((m) => (
            <Link
              key={m.kind}
              href={`/moto/setup/${m.slug}`}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {masterTitle(m)}
            </Link>
          ))}
          <Link
            href="/apps"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            โปรแกรมอื่น
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

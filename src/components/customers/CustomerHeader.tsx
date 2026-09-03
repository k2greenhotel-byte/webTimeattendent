import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/customers", label: "ค้นหา/รายชื่อลูกค้า" },
  { href: "/customers/new", label: "เพิ่มลูกค้าใหม่" },
];

export default function CustomerHeader({ user }: { user: SessionUser }) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">
            ประวัติลูกค้า
            <span className="ml-2 font-normal text-slate-500">· {user.full_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            {user.company_name ?? "องค์กร"}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/apps"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            รวมโปรแกรม
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

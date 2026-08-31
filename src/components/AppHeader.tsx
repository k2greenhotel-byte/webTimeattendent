import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/types";

type NavLink = { href: string; label: string };

export default function AppHeader({
  user,
  links = [],
  subtitle,
}: {
  user: SessionUser;
  links?: NavLink[];
  subtitle?: string;
}) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
          <p className="text-xs text-slate-500">
            {user.emp_code}
            {user.role === "admin" ? " · ผู้ดูแลระบบ" : ""}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

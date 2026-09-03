import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/core", label: "ภาพรวม" },
  { href: "/core/companies", label: "1. บริษัท" },
  { href: "/core/branches", label: "2. สาขา" },
  { href: "/core/users", label: "3. ผู้ใช้งาน" },
  { href: "/core/levels", label: "4. สิทธิ์ตามระดับ" },
  { href: "/core/program-users", label: "5. ผู้ใช้งานโปรแกรม" },
  { href: "/core/programs", label: "6. ทะเบียนโปรแกรม" },
];

export default function CoreHeader({ user }: { user: SessionUser }) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">
            ระบบส่วนกลาง
            <span className="ml-2 font-normal text-slate-500">· {user.full_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            {ACCESS_LEVEL_LABEL[user.level]}
            {user.company_name ? ` · ${user.company_name}` : ""}
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

import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/hr/leave/new", label: "1. แจ้งลา/หยุด/สาย", menu: "HR_LEAVE_NEW" },
  { href: "/hr/leave", label: "2. ใบแจ้งลาของฉัน", menu: "HR_LEAVE_MINE" },
  { href: "/hr/advance/new", label: "3. ขอเบิกเงินเดือน", menu: "HR_ADV_NEW" },
  { href: "/hr/advance", label: "4. ใบขอเบิกของฉัน", menu: "HR_ADV_MINE" },
  { href: "/hr/approvals/leave", label: "5. อนุมัติการลา", menu: "HR_LEAVE_APPROVE" },
  { href: "/hr/approvals/advance", label: "6. อนุมัติขอเบิกเงิน", menu: "HR_ADV_APPROVE" },
  { href: "/hr/setup/leave-types", label: "7. ตั้งค่าประเภทการลา", menu: "HR_TYPES" },
];

export default function HrHeader({
  user,
  readableMenus,
}: {
  user: SessionUser;
  readableMenus: string[];
}) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">
            <Link href="/hr" className="hover:underline">
              ระบบขอลา / ขอเบิกเงินเดือน
            </Link>
            <span className="ml-2 font-normal text-slate-500">· {user.full_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            {user.company_name ?? "องค์กร"}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV.filter((l) => readableMenus.includes(l.menu)).map((l) => (
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

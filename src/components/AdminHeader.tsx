import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/reports/employee", label: "รายบุคคล" },
  { href: "/admin/reports/daily", label: "รายวัน" },
  { href: "/admin/reports/monthly", label: "รายเดือน" },
  { href: "/admin/branches", label: "สาขา" },
  { href: "/admin/employees", label: "พนักงาน" },
  { href: "/admin/holidays", label: "วันหยุด" },
  { href: "/admin/settings", label: "ตั้งค่า" },
];

export default function AdminHeader() {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">ระบบหลังบ้าน</p>
          <p className="text-xs text-slate-500">ผู้ดูแลระบบ · เข้าด้วย PIN</p>
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
          <form action={adminLogoutAction}>
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

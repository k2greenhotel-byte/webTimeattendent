import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/types";

/** เมนูของระบบข้อมูล Lead — ลำดับตรงกับสเปกข้อ 1-3 */
const NAV = [
  { href: "/leads/leads", label: "1. บันทึก Lead", menuCode: "LEAD_ENTRY" },
  { href: "/leads/follow", label: "2. ติดตามการขาย", menuCode: "LEAD_FOLLOW" },
  { href: "/leads/search", label: "3. สอบถาม", menuCode: "LEAD_SEARCH" },
  { href: "/leads/dashboard", label: "4. Dashboard", menuCode: "LEAD_DASH" },
];

export default function LeadHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="w-full sm:mr-auto sm:w-auto">
          <p className="text-sm font-semibold text-slate-800">
            ระบบข้อมูล Lead
            <span className="ml-2 font-normal text-slate-500">· {user.full_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            {user.emp_code}
            {user.company_name ? ` · ${user.company_name}` : ""}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>

        {/* จอเล็กเลื่อนเมนูซ้าย-ขวาแทนการตัดขึ้นบรรทัดใหม่หลายแถว (กินพื้นที่จอมือถือ) */}
        <nav className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
          <Link
            href="/leads"
            className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            หน้าแรก
          </Link>
          {menus.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {m.label}
            </Link>
          ))}
          <Link
            href="/apps"
            className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            โปรแกรมอื่น
          </Link>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

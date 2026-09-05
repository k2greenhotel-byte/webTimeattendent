import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/types";

/** เมนูของโปรแกรมจัดซื้อจัดจ้างแจ้งซ่อม — ลำดับตรงกับสเปกข้อ 1-6 */
const NAV = [
  { href: "/procurement/repairs", label: "1.1 แจ้งซ่อม", menuCode: "PR_REPAIR" },
  { href: "/procurement/updates", label: "1.2 Update งานซ่อม", menuCode: "PR_REPAIR_UPD" },
  { href: "/procurement/purchases", label: "2.1 ขอจัดซื้อ", menuCode: "PR_PURCHASE" },
  { href: "/procurement/approvals", label: "3.1 อนุมัติ", menuCode: "PR_APPROVE" },
  { href: "/procurement/payments", label: "4.1 จ่ายเงิน", menuCode: "PR_PAYMENT" },
  { href: "/procurement/search", label: "5. สอบถาม", menuCode: "PR_SEARCH" },
  { href: "/procurement/dashboard", label: "6. Dashboard", menuCode: "PR_DASH" },
];

export default function ProcurementHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));
  const canSetup =
    readableMenuCodes.includes("PR_ASSET_TYPE") || readableMenuCodes.includes("PR_MATERIAL_TYPE");

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="w-full sm:mr-auto sm:w-auto">
          <p className="text-sm font-semibold text-slate-800">
            ระบบจัดซื้อจัดจ้างแจ้งซ่อม
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
            href="/procurement"
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
          {canSetup && (
            <Link
              href="/procurement/setup/asset-types"
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              ตั้งค่า
            </Link>
          )}
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

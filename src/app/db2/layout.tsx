import type { Metadata } from "next";
import Link from "next/link";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ข้อมูลสดจากระบบขาย (Db2)",
  description: "ยอดขายสด สต็อกรถคงเหลือ และค้นลูกค้า/สัญญาผ่อน จากฐานข้อมูลระบบขายในบริษัท",
};

const MENUS: { code: string; href: string; label: string }[] = [
  { code: "DB2_DASH", href: "/db2/dashboard", label: "Dashboard ยอดขาย" },
  { code: "DB2_STOCK", href: "/db2/stock", label: "สต็อกรถ" },
  { code: "DB2_CUSTOMER", href: "/db2/customers", label: "ค้นลูกค้า / สัญญา" },
  { code: "DB2_WALL", href: "/db2/wall", label: "จอ War Room" },
  { code: "DB2_PIVOT", href: "/db2/stock/pivot", label: "สต็อก Cross Tab" },
];

/** ทุกหน้าในโปรแกรมนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม DB2 */
export default async function Db2Layout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("DB2");
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
          <Link href="/db2" className="font-semibold text-slate-800">
            📡 ข้อมูลสดจากระบบขาย
          </Link>
          <nav className="flex flex-wrap gap-1">
            {MENUS.filter((m) => readable.has(m.code)).map((m) => (
              <Link
                key={m.code}
                href={m.href}
                className="rounded-lg px-3 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {m.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>{user.full_name}</span>
            <Link href="/apps" className="hover:underline">
              โปรแกรมทั้งหมด
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

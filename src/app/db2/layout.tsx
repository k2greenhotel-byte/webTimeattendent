import type { Metadata } from "next";
import ModuleNav from "@/components/ModuleNav";
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
  { code: "DB2_JOBS", href: "/db2/jobs", label: "Dashboard งานซ่อม" },
  { code: "DB2_JOB_WALL", href: "/db2/jobs/wall", label: "War Room งานซ่อม" },
  { code: "DB2_HP_WALL", href: "/db2/hpdebt/wall", label: "War Room ลูกหนี้เช่าซื้อ" },
];

/** ทุกหน้าในโปรแกรมนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม DB2 */
export default async function Db2Layout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("DB2");
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));

  return (
    <div className="min-h-screen">
      <ModuleNav
        title="📡 ข้อมูลสดจากระบบขาย"
        titleHref="/db2"
        userName={user.full_name}
        subtitle={
          <>
            {user.company_name ?? "องค์กร"}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </>
        }
        links={MENUS.filter((m) => readable.has(m.code)).map((m) => ({
          href: m.href,
          label: m.label,
        }))}
        appsLink={{ href: "/apps", label: "โปรแกรมทั้งหมด" }}
      />
      {children}
    </div>
  );
}

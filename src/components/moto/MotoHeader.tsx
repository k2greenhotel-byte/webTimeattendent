import ModuleNav from "@/components/ModuleNav";
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
    <ModuleNav
      title="ข้อมูลเบื้องต้น · ธุรกิจรถจักรยานยนต์"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/moto", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: `/moto/setup/${m.slug}`, label: masterTitle(m) })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/salework/daily", label: "1. บันทึกงานวันนี้", menuCode: "SW_ENTRY" },
  { href: "/salework/search", label: "2. ประวัติการทำงาน", menuCode: "SW_SEARCH" },
  { href: "/salework/dashboard", label: "3. Dashboard", menuCode: "SW_DASH" },
  { href: "/salework/setup", label: "4. ตั้งค่าประเภทงาน", menuCode: "SW_SETUP" },
  { href: "/salework/mapping", label: "5. จับคู่กับระบบขาย", menuCode: "SW_MAP" },
  { href: "/salework/wall", label: "จอ War Room", menuCode: "SW_WALL" },
];

export default function SaleWorkHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="บันทึกงานประจำวันพนักงานขาย"
      titleHref="/salework"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/salework", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

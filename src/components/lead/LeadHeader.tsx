import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/leads/leads", label: "1. บันทึก Lead", menuCode: "LEAD_ENTRY" },
  { href: "/leads/follow", label: "2. ติดตามการขาย", menuCode: "LEAD_FOLLOW" },
  { href: "/leads/search", label: "3. สอบถาม", menuCode: "LEAD_SEARCH" },
  { href: "/leads/dashboard", label: "4. Dashboard", menuCode: "LEAD_DASH" },
  { href: "/leads/setup", label: "5. ตั้งค่าสถานะ", menuCode: "LEAD_SETUP" },
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
    <ModuleNav
      title="ระบบข้อมูล Lead"
      titleHref="/leads"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/leads", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

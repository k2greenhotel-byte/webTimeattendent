import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/inspection/inspections", label: "1. บันทึกตรวจสาขา", menuCode: "INSP_ENTRY" },
  { href: "/inspection/search", label: "2. สอบถามผลตรวจ", menuCode: "INSP_SEARCH" },
  { href: "/inspection/dashboard", label: "3. Dashboard", menuCode: "INSP_DASH" },
  { href: "/inspection/setup", label: "4. ตั้งค่ารายการตรวจ", menuCode: "INSP_SETUP" },
  { href: "/inspection/wall", label: "จอ War Room", menuCode: "INSP_WALL" },
];

export default function InspectionHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="ระบบตรวจสอบสาขา"
      titleHref="/inspection"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/inspection", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

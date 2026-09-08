import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/claim/claims", label: "1.4 แจ้งเคลม", menuCode: "CLM_CLAIM" },
  { href: "/claim/updates", label: "1.5 Update งานเคลม", menuCode: "CLM_UPDATE" },
  { href: "/claim/search", label: "2. สอบถาม", menuCode: "CLM_SEARCH" },
  { href: "/claim/dashboard", label: "3. Dashboard", menuCode: "CLM_DASH" },
];

export default function ClaimHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="ระบบแจ้งเคลม"
      titleHref="/claim"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/claim", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

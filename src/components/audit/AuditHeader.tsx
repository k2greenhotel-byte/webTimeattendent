import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/audit/audits", label: "1. บันทึกผลตรวจสอบ", menuCode: "AUD_ENTRY" },
  { href: "/audit/search", label: "2. สอบถามผลตรวจ", menuCode: "AUD_SEARCH" },
  { href: "/audit/reports", label: "3. รายงาน", menuCode: "AUD_REPORT" },
  { href: "/audit/dashboard", label: "4. Dashboard", menuCode: "AUD_DASH" },
  { href: "/audit/setup", label: "5. ตั้งค่ารายการตรวจ", menuCode: "AUD_SETUP" },
];

export default function AuditHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="ระบบตรวจสอบบัญชี"
      titleHref="/audit"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[{ href: "/audit", label: "หน้าแรก" }, ...menus.map((m) => ({ href: m.href, label: m.label }))]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

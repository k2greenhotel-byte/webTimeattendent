import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/procurement/repairs", label: "1.1 แจ้งซ่อม", menuCode: "PR_REPAIR" },
  { href: "/procurement/updates", label: "1.2 Update งานซ่อม", menuCode: "PR_REPAIR_UPD" },
  { href: "/procurement/purchases", label: "2.1 ขอจัดซื้อ", menuCode: "PR_PURCHASE" },
  { href: "/procurement/approvals", label: "3.1 อนุมัติ", menuCode: "PR_APPROVE" },
  { href: "/procurement/payments", label: "4.1 จ่ายเงินสดย่อย", menuCode: "PR_PAYMENT" },
  { href: "/procurement/central-payments", label: "4.2 จ่ายจากส่วนกลาง", menuCode: "PR_CENTRAL_PAY" },
  { href: "/procurement/tag-report", label: "4.3 รายงานป้ายกำกับ", menuCode: "PR_TAG_REPORT" },
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
    readableMenuCodes.includes("PR_ASSET_TYPE") ||
    readableMenuCodes.includes("PR_MATERIAL_TYPE") ||
    readableMenuCodes.includes("PR_ACCOUNT") ||
    readableMenuCodes.includes("PR_VENDOR");

  return (
    <ModuleNav
      title="ระบบจัดซื้อจัดจ้างแจ้งซ่อม"
      titleHref="/procurement"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/procurement", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
        ...(canSetup ? [{ href: "/procurement/setup/asset-types", label: "ตั้งค่า" }] : []),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

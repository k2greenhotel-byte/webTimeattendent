import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/approvals", label: "1. กล่องรออนุมัติ", menu: "APV_INBOX" },
  { href: "/approvals/new", label: "2. ยื่นเรื่อง", menu: "APV_NEW" },
  { href: "/approvals/mine", label: "3. เรื่องของฉัน", menu: "APV_MINE" },
  { href: "/approvals/search", label: "4. สอบถามประวัติ", menu: "APV_SEARCH" },
  { href: "/approvals/setup/limits", label: "5. อำนาจอนุมัติ", menu: "APV_LIMITS" },
  { href: "/approvals/setup/types", label: "6. ประเภทเรื่อง", menu: "APV_TYPES" },
];

export default function ApprovalHeader({
  user,
  readableMenus,
}: {
  user: SessionUser;
  readableMenus: string[];
}) {
  return (
    <ModuleNav
      title="ระบบอนุมัติกลาง"
      titleHref="/approvals"
      userName={user.full_name}
      subtitle={
        <>
          {user.company_name ?? "องค์กร"}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={NAV.filter((l) => readableMenus.includes(l.menu)).map((l) => ({
        href: l.href,
        label: l.label,
      }))}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

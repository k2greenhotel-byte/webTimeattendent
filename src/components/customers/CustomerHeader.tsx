import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/customers", label: "ค้นหา/รายชื่อลูกค้า" },
  { href: "/customers/new", label: "เพิ่มลูกค้าใหม่" },
];

export default function CustomerHeader({ user }: { user: SessionUser }) {
  return (
    <ModuleNav
      title="ประวัติลูกค้า"
      userName={user.full_name}
      subtitle={
        <>
          {user.company_name ?? "องค์กร"}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={NAV}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

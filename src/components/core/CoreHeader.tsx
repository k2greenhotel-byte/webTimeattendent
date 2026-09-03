import ModuleNav from "@/components/ModuleNav";
import { ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/core", label: "ภาพรวม" },
  { href: "/core/companies", label: "1. บริษัท" },
  { href: "/core/branches", label: "2. สาขา" },
  { href: "/core/users", label: "3. ผู้ใช้งาน" },
  { href: "/core/levels", label: "4. สิทธิ์ตามระดับ" },
  { href: "/core/program-users", label: "5. ผู้ใช้งานโปรแกรม" },
  { href: "/core/programs", label: "6. ทะเบียนโปรแกรม" },
];

export default function CoreHeader({ user }: { user: SessionUser }) {
  return (
    <ModuleNav
      title="ระบบส่วนกลาง"
      userName={user.full_name}
      subtitle={
        <>
          {ACCESS_LEVEL_LABEL[user.level]}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={NAV}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

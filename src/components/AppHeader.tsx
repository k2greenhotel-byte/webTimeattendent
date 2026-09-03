import ModuleNav, { type NavLink } from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

export default function AppHeader({
  user,
  links = [],
  subtitle,
}: {
  user: SessionUser;
  links?: NavLink[];
  subtitle?: string;
}) {
  return (
    <ModuleNav
      title={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.role === "admin" ? " · ผู้ดูแลระบบ" : ""}
          {subtitle ? ` · ${subtitle}` : ""}
        </>
      }
      links={links}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

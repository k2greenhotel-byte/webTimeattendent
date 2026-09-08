import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/booking/bookings", label: "1.1 รับจองรถ", menuCode: "BOOK_ENTRY" },
  { href: "/booking/updates", label: "1.2 Update สถานะ", menuCode: "BOOK_UPDATE" },
  { href: "/booking/search", label: "1.3 สอบถาม", menuCode: "BOOK_SEARCH" },
  { href: "/booking/dashboard", label: "1.4 Dashboard", menuCode: "BOOK_DASH" },
  { href: "/booking/stock", label: "1.5 สอบถามสต๊อกรถ", menuCode: "BOOK_STOCK" },
];

export default function BookingHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="ระบบจองรถ"
      titleHref="/booking"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/booking", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

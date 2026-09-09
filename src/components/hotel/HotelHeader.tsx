import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/hotel/rounds", label: "1. ตรวจเช็คอาคาร", menuCode: "HTL_ENTRY" },
  { href: "/hotel/rooms", label: "2. ตรวจเช็คห้องพัก", menuCode: "HTL_ROOM" },
  { href: "/hotel/issues", label: "3. รายการที่ต้องแก้ไข", menuCode: "HTL_ISSUE" },
  { href: "/hotel/search", label: "4. สอบถามผลตรวจเช็ค", menuCode: "HTL_SEARCH" },
  { href: "/hotel/dashboard", label: "5. Dashboard", menuCode: "HTL_DASH" },
  { href: "/hotel/setup", label: "6. ตั้งค่ารายการและห้องพัก", menuCode: "HTL_SETUP" },
  { href: "/hotel/wall", label: "จอ War Room", menuCode: "HTL_WALL" },
];

export default function HotelHeader({
  user,
  readableMenuCodes,
}: {
  user: SessionUser;
  readableMenuCodes: string[];
}) {
  const menus = NAV.filter((n) => readableMenuCodes.includes(n.menuCode));

  return (
    <ModuleNav
      title="ตรวจเช็คโรงแรมประจำวัน"
      titleHref="/hotel"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.company_name ? ` · ${user.company_name}` : ""}
          {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
        </>
      }
      links={[
        { href: "/hotel", label: "หน้าแรก" },
        ...menus.map((m) => ({ href: m.href, label: m.label })),
      ]}
      appsLink={{ href: "/apps", label: "โปรแกรมอื่น" }}
    />
  );
}

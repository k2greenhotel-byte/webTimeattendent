import ModuleNav, { type NavLink } from "@/components/ModuleNav";
import { readableMenuCodes } from "@/lib/att-access";
import type { SessionUser } from "@/lib/types";

const MENU_LINKS: { code: string; href: string; label: string }[] = [
  { code: "ATT_ROSTER", href: "/admin/roster", label: "ตารางเวร" },
  { code: "ATT_FIELD_ROSTER", href: "/admin/field/roster", label: "ตารางบูธ" },
  { code: "ATT_FIELD", href: "/admin/field", label: "งานนอกสถานที่" },
  { code: "ATT_REP_FIELD", href: "/admin/reports/field", label: "รายงานนอกสถานที่" },
];

/**
 * แถบเมนูของหน้าจัดตาราง เมื่อผู้ใช้เข้าด้วยสิทธิ์รายเมนู (ไม่ได้ผ่าน PIN หลังบ้าน)
 * แสดงเฉพาะเมนูที่คนนั้นมีสิทธิ์อ่าน
 */
export default async function AttStaffNav({ user }: { user: SessionUser }) {
  const readable = await readableMenuCodes(MENU_LINKS.map((m) => m.code));
  const links: NavLink[] = [
    ...MENU_LINKS.filter((m) => readable.has(m.code)).map(({ href, label }) => ({ href, label })),
    { href: "/punch", label: "ลงเวลา" },
  ];

  return (
    <ModuleNav
      title="ระบบลงเวลา · จัดตาราง"
      subtitle={
        <>
          {user.full_name} · {user.emp_code}
          {user.branch_name ? ` · ${user.branch_name}` : ""}
        </>
      }
      links={links}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

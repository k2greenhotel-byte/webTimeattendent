import ModuleNav from "@/components/ModuleNav";
import { adminLogoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/reports/employee", label: "รายบุคคล" },
  { href: "/admin/reports/daily", label: "รายวัน" },
  { href: "/admin/reports/monthly", label: "รายเดือน" },
  { href: "/admin/branches", label: "สาขา" },
  { href: "/admin/employees", label: "พนักงาน" },
  { href: "/admin/holidays", label: "วันหยุด" },
  { href: "/admin/roster", label: "ตารางเวร" },
  { href: "/admin/field/roster", label: "ตารางบูธ" },
  { href: "/admin/field", label: "งานนอกสถานที่" },
  { href: "/admin/reports/field", label: "รายงานนอกสถานที่" },
  { href: "/admin/setup", label: "ตั้งค่าข้อมูลหลัก" },
  { href: "/admin/settings", label: "ตั้งค่าองค์กร" },
  { href: "/admin/data", label: "ลบข้อมูล" },
  { href: "/core", label: "ระบบส่วนกลาง" },
];

export default function AdminHeader() {
  return (
    <ModuleNav
      title="ระบบหลังบ้าน"
      subtitle="ผู้ดูแลระบบ · เข้าด้วย PIN"
      links={NAV}
      onLogout={adminLogoutAction}
    />
  );
}

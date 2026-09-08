import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/hr/leave/new", label: "1. แจ้งลา/หยุด/สาย", menu: "HR_LEAVE_NEW" },
  { href: "/hr/leave", label: "2. ใบแจ้งลาของฉัน", menu: "HR_LEAVE_MINE" },
  { href: "/hr/advance/new", label: "3. ขอเบิกเงินเดือน", menu: "HR_ADV_NEW" },
  { href: "/hr/advance", label: "4. ใบขอเบิกของฉัน", menu: "HR_ADV_MINE" },
  { href: "/hr/approvals/leave", label: "5. อนุมัติการลา", menu: "HR_LEAVE_APPROVE" },
  { href: "/hr/approvals/advance", label: "6. อนุมัติขอเบิกเงิน", menu: "HR_ADV_APPROVE" },
  { href: "/hr/setup/leave-types", label: "7. ตั้งค่าประเภทการลา", menu: "HR_TYPES" },
  { href: "/hr/search/leave", label: "8. สอบถามข้อมูลการลา", menu: "HR_SEARCH_LEAVE" },
  { href: "/hr/search/advance", label: "9. สอบถามข้อมูลขอเบิกเงิน", menu: "HR_SEARCH_ADV" },
  { href: "/hr/dashboard", label: "10. Dashboard สรุป", menu: "HR_DASHBOARD" },
  { href: "/hr/manage/leave", label: "11. แก้ไขข้อมูลการลา (ฝ่ายบุคคล)", menu: "HR_LEAVE_MANAGE" },
  { href: "/hr/setup/leave-quota", label: "12. ตั้งค่าสิทธิ์การลารายบุคคล", menu: "HR_LEAVE_QUOTA" },
];

export default function HrHeader({
  user,
  readableMenus,
}: {
  user: SessionUser;
  readableMenus: string[];
}) {
  return (
    <ModuleNav
      title="ระบบขอลา / ขอเบิกเงินเดือน"
      titleHref="/hr"
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

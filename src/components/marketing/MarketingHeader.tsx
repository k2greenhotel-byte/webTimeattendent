import ModuleNav from "@/components/ModuleNav";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/marketing", label: "หน้าแรก" },
  { href: "/marketing/activities", label: "1. บันทึกกิจกรรม" },
  { href: "/marketing/submit", label: "2. ส่งเรื่องเบิกเงิน" },
  { href: "/marketing/receive", label: "3. รับเงิน" },
  { href: "/marketing/setup", label: "4. ค่าเริ่มต้น" },
  { href: "/marketing/search", label: "5. สอบถาม" },
  { href: "/marketing/dashboard", label: "6. Dashboard" },
  { href: "/marketing/memos", label: "7. Memo" },
  { href: "/marketing/memos/status", label: "8. เปลี่ยนสถานะ Memo" },
];

export default function MarketingHeader({ user }: { user: SessionUser }) {
  return (
    <ModuleNav
      title="ระบบกิจกรรมการตลาด"
      userName={user.full_name}
      subtitle={
        <>
          {user.emp_code}
          {user.role === "admin" ? " · ผู้ดูแลระบบ" : ""} · คุมการเบิกเงินค่าส่งเสริมกับบริษัทรถ
        </>
      }
      links={NAV}
      appsLink={{ href: "/apps", label: "รวมโปรแกรม" }}
    />
  );
}

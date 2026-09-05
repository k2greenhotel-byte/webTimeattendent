import type { Metadata } from "next";
import LeadHeader from "@/components/lead/LeadHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบข้อมูล Lead",
  description: "บันทึกลูกค้ามุ่งหวัง โทรติดตามการขาย จัดลำดับโอกาส และ dashboard งานขาย",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม LEAD */
export default async function LeadLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("LEAD");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <LeadHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

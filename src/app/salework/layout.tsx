import type { Metadata } from "next";
import SaleWorkHeader from "@/components/salework/SaleWorkHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "บันทึกงานประจำวันพนักงานขาย",
  description: "ติ๊กงานที่ทำในแต่ละวัน กรอกผลงาน แนบรูป/คลิป และดู dashboard สรุปรายคน",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม SALEWORK */
export default async function SaleWorkLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("SALEWORK");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <SaleWorkHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

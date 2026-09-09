import type { Metadata } from "next";
import InspectionHeader from "@/components/inspection/InspectionHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบตรวจสอบสาขา",
  description:
    "ออกตรวจสาขาตามแบบฟอร์มที่ตั้งไว้ ให้คะแนนรายข้อ บันทึกหมายเหตุและแนบรูปประกอบ สรุปคะแนน ค่าปรับ และเงินรางวัล",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม INSP */
export default async function InspectionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("INSP");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <InspectionHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

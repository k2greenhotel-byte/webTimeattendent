import type { Metadata } from "next";
import ClaimHeader from "@/components/claim/ClaimHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบแจ้งเคลม",
  description: "แจ้งเคลมรถของลูกค้ากับบริษัทผู้ผลิต ติดตามผลการอนุมัติและงานแก้ไขจนส่งมอบรถคืน",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม CLM */
export default async function ClaimLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("CLM");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <ClaimHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

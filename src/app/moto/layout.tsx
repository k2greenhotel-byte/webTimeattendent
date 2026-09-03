import type { Metadata } from "next";
import MotoHeader from "@/components/moto/MotoHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ข้อมูลเบื้องต้น ธุรกิจรถจักรยานยนต์",
  description: "ยี่ห้อ รุ่น แบบ สีรถ บริษัทรถ ไฟแนนซ์ รายการรับ-จ่ายเงิน ช่องทางติดต่อ และงานขาย",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม MC */
export default async function MotoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("MC");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <MotoHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

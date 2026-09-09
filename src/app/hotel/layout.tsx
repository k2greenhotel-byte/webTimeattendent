import type { Metadata } from "next";
import HotelHeader from "@/components/hotel/HotelHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ตรวจเช็คโรงแรมประจำวัน",
  description:
    "ช่างเลือกบริษัทและสาขา แล้วตรวจเช็คตามรายการที่ตั้งไว้ ระบุปกติ/ไม่ปกติ แนบรูป ใส่หมายเหตุ กำหนดความเร่งด่วนที่ต้องแก้ และเปิดใบแจ้งซ่อมต่อได้ทันที",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม HTL */
export default async function HotelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("HTL");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <HotelHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

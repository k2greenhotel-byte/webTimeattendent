import type { Metadata } from "next";
import BookingHeader from "@/components/booking/BookingHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบจองรถ",
  description: "รับจองรถ ติดตามสถานะสัญญาและสถานะรถ นัดรับรถ และ dashboard งานขาย",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม BOOK */
export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("BOOK");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <BookingHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

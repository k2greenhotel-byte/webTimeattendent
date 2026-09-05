import type { Metadata } from "next";
import ProcurementHeader from "@/components/procurement/ProcurementHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบจัดซื้อจัดจ้างแจ้งซ่อม",
  description: "แจ้งขอซ่อม ขอจัดซื้อ อนุมัติ บันทึกจ่ายเงิน พร้อมสอบถามและติดตามสถานะงาน",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม PR */
export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("PR");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <ProcurementHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

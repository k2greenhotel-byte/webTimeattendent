import type { Metadata } from "next";
import AuditHeader from "@/components/audit/AuditHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบตรวจสอบบัญชี",
  description:
    "ผู้ตรวจสอบบันทึกผลการตรวจประจำวันเป็นใบคุมงาน — ใบสั่งขาย ใบเบิกเงินสดย่อย กระทบยอดเงินสด และรายการตรวจที่เพิ่มเองได้",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอิน และมีสิทธิ์อย่างน้อยหนึ่งเมนูของโปรแกรม AUD */
export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("AUD");
  const permissions = await getMyPermissions();
  const readableMenuCodes = permissions.filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <AuditHeader user={user} readableMenuCodes={readableMenuCodes} />
      {children}
    </div>
  );
}

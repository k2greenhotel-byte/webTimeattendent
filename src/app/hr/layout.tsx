import type { Metadata } from "next";
import HrHeader from "@/components/hr/HrHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบขอลา / ขอเบิกเงินเดือน",
  description: "พนักงานแจ้งลา แจ้งหยุดงาน แจ้งเข้างานสาย และขอเบิกเงินเดือนล่วงหน้า",
};

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("HR");
  const readableMenus = (await getMyPermissions()).filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <HrHeader user={user} readableMenus={readableMenus} />
      {children}
    </div>
  );
}

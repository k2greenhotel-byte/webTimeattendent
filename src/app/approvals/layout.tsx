import type { Metadata } from "next";
import ApprovalHeader from "@/components/approval/ApprovalHeader";
import { getMyPermissions, requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบอนุมัติกลาง",
  description: "ผู้จัดการและผู้บริหารอนุมัติงานทุกเรื่องในที่เดียว",
};

export default async function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("APV");
  const readableMenus = (await getMyPermissions()).filter((p) => p.can_read).map((p) => p.menu_code);

  return (
    <div className="min-h-screen">
      <ApprovalHeader user={user} readableMenus={readableMenus} />
      {children}
    </div>
  );
}

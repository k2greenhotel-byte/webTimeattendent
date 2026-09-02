import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบกิจกรรมการตลาด",
  description: "บันทึกกิจกรรมการตลาด และคุมการเบิกเงินค่าส่งเสริมการขายกับบริษัทรถ",
};

/** ทุกหน้าในโมดูลนี้ต้องล็อกอินด้วยเบอร์มือถือ + รหัสผ่านก่อน */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <MarketingHeader user={user} />
      {children}
    </div>
  );
}

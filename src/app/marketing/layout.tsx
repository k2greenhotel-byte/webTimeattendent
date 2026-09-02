import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "ระบบกิจกรรมการตลาด",
  description: "บันทึกกิจกรรมการตลาด และคุมการเบิกเงินค่าส่งเสริมการขายกับบริษัทรถ",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      {children}
    </div>
  );
}

import type { Metadata } from "next";
import CustomerHeader from "@/components/customers/CustomerHeader";
import { requireProgram } from "@/lib/session";

export const metadata: Metadata = {
  title: "ประวัติลูกค้า",
  description: "ทะเบียนลูกค้า ที่อยู่ รูปถ่าย และช่องทางติดต่อ",
};

/** ทุกหน้าของโมดูลนี้ต้องมีสิทธิ์เข้าโปรแกรม CUST */
export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProgram("CUST");

  return (
    <div className="min-h-screen">
      <CustomerHeader user={user} />
      {children}
    </div>
  );
}

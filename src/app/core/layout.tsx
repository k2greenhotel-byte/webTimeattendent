import type { Metadata } from "next";
import CoreHeader from "@/components/core/CoreHeader";
import { requireCoreAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "ระบบส่วนกลาง",
  description: "ตั้งค่าบริษัท สาขา ผู้ใช้งาน สิทธิ์การใช้งาน และทะเบียนโปรแกรมขององค์กร",
};

/** ทุกหน้าในระบบส่วนกลางต้องเป็นระดับ admin หรือผู้ช่วย admin เท่านั้น */
export default async function CoreLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCoreAdmin();

  return (
    <div className="min-h-screen">
      <CoreHeader user={user} />
      {children}
    </div>
  );
}

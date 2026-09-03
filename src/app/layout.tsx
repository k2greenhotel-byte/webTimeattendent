import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบลงเวลาเข้า-ออกงาน",
  description: "บันทึกเวลาเข้า-ออกงานด้วยรูปถ่าย พร้อมรายงานรายบุคคล รายวัน และรายเดือน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ไม่ล็อก maximumScale เพื่อให้ผู้ใช้ซูมอ่านตารางบนมือถือได้
  themeColor: "#2f7de1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

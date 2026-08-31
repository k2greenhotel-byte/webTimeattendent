import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบลงเวลาเข้า-ออกงาน",
  description: "บันทึกเวลาเข้า-ออกงานด้วยรูปถ่าย พร้อมรายงานรายบุคคล รายวัน และรายเดือน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2f7de1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

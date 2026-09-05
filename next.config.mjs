/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["bcryptjs"],
  /*
   * ปกติใช้ .next เหมือนเดิม แต่ถ้าตั้ง NEXT_DIST_DIR ไว้จะแยกโฟลเดอร์ build ให้
   * มีไว้เพื่อให้เปิด dev server หลายตัวพร้อมกันในโฟลเดอร์เดียวกันได้
   * (สองตัวใช้ .next ร่วมกันจะเขียนทับกันจนหน้าเว็บขึ้น 404 หรือ "missing required error components")
   *
   *   NEXT_DIST_DIR=.next-preview npx next dev -p 3200
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /*
   * แอปนี้ไม่ได้ใช้ next/image เลย (รูปทั้งหมดโหลดผ่าน signed URL ของ Supabase Storage
   * ด้วย <img> ธรรมดา) — ปิด image optimizer ของ Next เพื่อไม่ให้ OpenNext พยายามรวม
   * sharp (native binary) เข้าไปใน worker ซึ่ง Cloudflare Workers รันไม่ได้อยู่แล้ว
   * และทำให้ build พังตอน bundle ถ้า sharp ถูกติดตั้งอยู่ใน node_modules
   */
  images: { unoptimized: true },
};

export default nextConfig;

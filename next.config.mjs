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
};

export default nextConfig;

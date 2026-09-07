/**
 * ลบ sharp ออกจาก node_modules ก่อน build ขึ้น Cloudflare Workers
 *
 * Next.js ประกาศ sharp เป็น optional peer dependency สำหรับ next/image optimizer
 * แอปนี้ไม่เคยใช้ next/image เลย (ตั้ง images.unoptimized: true ไว้แล้ว) แต่ตั้งค่านั้น
 * อย่างเดียวไม่พอ — ถ้า sharp ถูกติดตั้งอยู่จริง (เช่นจาก npm install ปกติที่ไม่ได้ข้าม
 * optional deps) ตัว bundler ของ OpenNext จะยังพยายามรวม native binary (.node) ของ sharp
 * เข้าไปในเซิร์ฟเวอร์บันเดิลอยู่ดี ซึ่ง esbuild ไม่มี loader รองรับไฟล์ .node ทำให้ build ล้ม
 *
 * ลบไฟล์ตรง ๆ ปลอดภัยกว่าสั่ง npm install --omit=optional เพราะ optional deps
 * อื่น (เช่น @esbuild/win32-x64, workerd) จำเป็นต้องมีจริงสำหรับ build นี้
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = join(root, "node_modules");

function remove(path, label) {
  if (!existsSync(path)) return;
  rmSync(path, { recursive: true, force: true });
  console.log(`ลบ ${label} แล้ว`);
}

remove(join(nodeModules, "sharp"), "node_modules/sharp");

const imgDir = join(nodeModules, "@img");
if (existsSync(imgDir)) {
  for (const name of readdirSync(imgDir)) {
    if (name.startsWith("sharp")) remove(join(imgDir, name), `node_modules/@img/${name}`);
  }
}

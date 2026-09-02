/**
 * Deploy ขึ้น Cloudflare Workers โดยหยิบ API token ให้อัตโนมัติ
 *
 *   npm run cf:deploy            # build ต้องรันมาก่อน (npm run cf:build)
 *   npm run cf:deploy -- --dry-run
 *
 * ลำดับการหา token:
 *   1. ตัวแปรสภาพแวดล้อม CLOUDFLARE_API_TOKEN
 *   2. บรรทัด CLOUDFLARE_API_TOKEN=... ในไฟล์ .env.local
 *   3. ไฟล์ token.txt (ในโปรเจกต์ หรือโฟลเดอร์แม่) — บรรทัดที่ขึ้นต้นด้วย cfut_
 *
 * สคริปต์นี้ไม่พิมพ์ค่า token ออกหน้าจอ และไม่เขียน token ลงไฟล์ใด ๆ
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** อ่าน CLOUDFLARE_API_TOKEN จาก .env.local ถ้ามี */
function fromEnvFile() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return null;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^CLOUDFLARE_API_TOKEN=(.+)$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return null;
}

/** อ่าน token จากไฟล์ token.txt — รับทั้งแบบมีชื่อตัวแปรนำหน้าและแบบค่าเปล่า */
function fromTokenFile() {
  const candidates = [
    process.env.CLOUDFLARE_TOKEN_FILE,
    join(root, "token.txt"),
    join(root, "..", "token.txt"),
  ].filter(Boolean);

  for (const file of candidates) {
    if (!existsSync(file)) continue;

    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      const withName = /^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/.exec(line);
      if (withName) return withName[1].trim();
      if (/^cfut_[A-Za-z0-9_-]{20,}$/.test(line)) return line;
    }
  }
  return null;
}

const token = process.env.CLOUDFLARE_API_TOKEN || fromEnvFile() || fromTokenFile();

if (!token) {
  console.error(
    [
      "ไม่พบ Cloudflare API token",
      "",
      "แก้ได้ 3 ทาง (เลือกทางใดทางหนึ่ง):",
      "  1. ใส่บรรทัด CLOUDFLARE_API_TOKEN=... ในไฟล์ .env.local",
      "  2. วางค่า token (ขึ้นต้นด้วย cfut_) ไว้ในไฟล์ token.txt",
      "  3. ตั้งตัวแปรสภาพแวดล้อม CLOUDFLARE_API_TOKEN ก่อนรันคำสั่ง",
      "",
      "สร้าง token ใหม่ได้ที่ Cloudflare → My Profile → API Tokens (สิทธิ์ Edit Cloudflare Workers)",
    ].join("\n"),
  );
  process.exit(1);
}

// เรียกไฟล์ .js ของ opennextjs-cloudflare ด้วย node ตรง ๆ
// (บน Windows การ spawn ไฟล์ .cmd อย่าง npx.cmd จะได้ EINVAL ตั้งแต่ Node 20 เป็นต้นมา)
const cli = join(root, "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "index.js");

if (!existsSync(cli)) {
  console.error("ไม่พบ @opennextjs/cloudflare — รัน npm install ก่อน");
  process.exit(1);
}

console.log("▶ กำลัง deploy ขึ้น Cloudflare Workers …");

const child = spawn(process.execPath, [cli, "deploy", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
});

child.on("error", (err) => {
  console.error(`เรียก opennextjs-cloudflare ไม่สำเร็จ: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 1));

/**
 * เปิด dev server ที่ใช้โฟลเดอร์ build แยก (.next-<port>) เพื่อรันคู่กับ dev server ตัวอื่นในโฟลเดอร์เดียวกันได้
 *
 *   node scripts/dev-isolated.mjs 3200
 *
 * ใช้คู่กับ distDir ใน next.config.mjs (อ่านจาก NEXT_DIST_DIR)
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] || "3200";

const child = spawn(
  process.execPath,
  [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", port],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: `.next-${port}`, PORT: port },
  },
);
child.on("exit", (code) => process.exit(code ?? 0));

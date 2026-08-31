/**
 * ติดตั้งฐานข้อมูลบน Supabase: รัน migration + seed ผ่าน connection string
 *
 *   npm run db:setup           # รัน migration แล้วตามด้วย seed
 *   npm run db:setup -- --skip-seed
 *
 * ต้องมี SUPABASE_DB_URL ในไฟล์ .env.local
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const text = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // ไม่มีไฟล์ .env.local ก็ใช้ตัวแปรจาก environment ปกติ
  }
}

async function run(client, label, file) {
  const sql = readFileSync(join(root, file), "utf8");
  process.stdout.write(`▶ ${label} (${file}) … `);
  await client.query(sql);
  console.log("สำเร็จ");
}

async function main() {
  loadEnv();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("ไม่พบ SUPABASE_DB_URL ใน .env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const migrations = readdirSync(join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      await run(client, "รัน migration", `supabase/migrations/${file}`);
    }
    if (!process.argv.includes("--skip-seed")) {
      await run(client, "ใส่ข้อมูลตั้งต้น", "supabase/seed.sql");
    }

    const { rows } = await client.query(
      "select emp_code, full_name, role from public.employees order by emp_code",
    );
    console.log("\nบัญชีในระบบตอนนี้:");
    for (const r of rows) console.log(`  ${r.emp_code.padEnd(8)} ${r.full_name} (${r.role})`);
    console.log("\nเสร็จเรียบร้อย — PIN เริ่มต้นของบัญชี seed คือ 1234");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nล้มเหลว:", err.message);
  process.exit(1);
});

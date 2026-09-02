/**
 * ติดตั้งฐานข้อมูลบน Supabase: รัน migration + seed ผ่าน connection string
 *
 *   npm run db:setup           # รัน migration แล้วตามด้วย seed
 *   npm run db:setup -- --skip-seed
 *
 * ต้องมี SUPABASE_DB_URL ในไฟล์ .env.local
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
    // จำว่า migration ไหนรันไปแล้ว จะได้ไม่รันซ้ำโดยไม่จำเป็น
    await client.query(`
      create table if not exists public.schema_migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const force = process.argv.includes("--force");
    const { rows: applied } = await client.query("select filename from public.schema_migrations");
    const done = new Set(applied.map((r) => r.filename));

    const migrations = readdirSync(join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrations) {
      if (done.has(file) && !force) {
        console.log(`• ข้าม ${file} (รันไปแล้ว)`);
        continue;
      }
      await run(client, "รัน migration", `supabase/migrations/${file}`);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
        [file],
      );
    }
    // seed รันครั้งเดียวเหมือน migration — ไม่งั้นบัญชี/ข้อมูลตัวอย่างที่ลบไปแล้วจะกลับมาทุกครั้งที่ตั้งค่าใหม่
    if (!process.argv.includes("--skip-seed")) {
      for (const [label, file] of [
        ["ใส่ข้อมูลตั้งต้น", "supabase/seed.sql"],
        ["ใส่ข้อมูลหลักของกิจการ", "supabase/seed_master_data.sql"],
      ]) {
        if (!existsSync(join(root, file))) continue;
        if (done.has(file) && !force) {
          console.log(`• ข้าม ${file} (รันไปแล้ว)`);
          continue;
        }
        await run(client, label, file);
        await client.query(
          "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
          [file],
        );
      }
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

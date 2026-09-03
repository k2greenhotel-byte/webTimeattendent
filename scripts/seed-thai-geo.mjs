/**
 * เติมตาราง thai_geo (ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ ทั่วประเทศ 7,436 แถว)
 *
 *   npm run db:geo            # ดาวน์โหลดชุดข้อมูลแล้วใส่ลงฐานข้อมูล (รันซ้ำได้ ไม่เพิ่มซ้ำ)
 *   npm run db:geo -- --force # เขียนทับข้อมูลเดิมทุกแถว
 *
 * ไม่ใส่ข้อมูลชุดนี้ในไฟล์ migration เพราะไฟล์จะใหญ่เกินไปและไม่ค่อยเปลี่ยน
 * แหล่งข้อมูล: github.com/thailand-geography-data/thailand-geography-json (อ้างอิงข้อมูลราชการ)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE =
  "https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src/geography.json";

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

async function main() {
  loadEnv();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("ไม่พบ SUPABASE_DB_URL ใน .env.local");
    process.exit(1);
  }

  process.stdout.write("▶ ดาวน์โหลดข้อมูลตำบล/อำเภอ/จังหวัด … ");
  const res = await fetch(SOURCE);
  if (!res.ok) {
    console.error(`ไม่สำเร็จ (HTTP ${res.status})`);
    process.exit(1);
  }
  const rows = await res.json();
  console.log(`ได้ ${rows.length} แถว`);

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { rows: before } = await client.query("select count(*)::int as n from public.thai_geo");
    if (before[0].n > 0 && !process.argv.includes("--force")) {
      console.log(`• มีข้อมูลอยู่แล้ว ${before[0].n} แถว — เติมเฉพาะตำบลที่ยังไม่มี (ใช้ --force เพื่อเขียนทับ)`);
    }

    // ยัดทีละ 500 แถว เร็วกว่าและไม่ชนขนาด statement
    const conflict = process.argv.includes("--force")
      ? `do update set subdistrict_name = excluded.subdistrict_name,
                       district_code    = excluded.district_code,
                       district_name    = excluded.district_name,
                       province_code    = excluded.province_code,
                       province_name    = excluded.province_name,
                       postal_code      = excluded.postal_code`
      : "do nothing";

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const values = [];
      const params = [];

      chunk.forEach((r, index) => {
        const base = index * 7;
        values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
        params.push(
          r.subdistrictCode,
          r.subdistrictNameTh,
          r.districtCode,
          r.districtNameTh,
          r.provinceCode,
          r.provinceNameTh,
          String(r.postalCode),
        );
      });

      await client.query(
        `insert into public.thai_geo
           (subdistrict_code, subdistrict_name, district_code, district_name, province_code, province_name, postal_code)
         values ${values.join(",")}
         on conflict (subdistrict_code) ${conflict}`,
        params,
      );
      process.stdout.write(`\r▶ บันทึกแล้ว ${Math.min(i + CHUNK, rows.length)}/${rows.length} แถว`);
    }

    const { rows: after } = await client.query(
      "select count(*)::int as n, count(distinct province_name)::int as provinces from public.thai_geo",
    );
    console.log(`\n✅ เสร็จเรียบร้อย — ตำบล ${after[0].n} แถว จาก ${after[0].provinces} จังหวัด`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nผิดพลาด:", err.message);
  process.exit(1);
});

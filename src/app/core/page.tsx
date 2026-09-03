import Link from "next/link";
import { listCompanies, listCoreUsers, listMenus, listPrograms } from "@/lib/core-db";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { listBranches } from "@/lib/db";

export const dynamic = "force-dynamic";

const SHORTCUTS = [
  {
    href: "/core/companies",
    title: "1. ตั้งค่าบริษัท",
    desc: "รหัสบริษัท ชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี",
  },
  {
    href: "/core/branches",
    title: "2. ตั้งค่าสาขา",
    desc: "รหัสสาขา ชื่อสาขา ที่อยู่ เบอร์โทร พิกัดสาขา และบริษัทที่สังกัด",
  },
  {
    href: "/core/users",
    title: "3. กำหนดผู้ใช้งานและสิทธิ์",
    desc: "User ID ชื่อผู้ใช้ รหัสผ่าน สถานะ บริษัท/สาขาที่เข้าได้ และสิทธิ์รายเมนู",
  },
  {
    href: "/core/levels",
    title: "4. สิทธิ์ตามระดับการทำงาน",
    desc: "ค่าเริ่มต้นของ admin / ผู้ช่วย admin / หัวหน้างาน / ผู้ใช้ทั่วไป",
  },
  {
    href: "/core/program-users",
    title: "5. กำหนดผู้ใช้งานโปรแกรม",
    desc: "เลือกโปรแกรม แล้วเพิ่ม-ลด user ที่ใช้โปรแกรมนั้นได้ทีเดียวทั้งชุด",
  },
  {
    href: "/core/programs",
    title: "6. ทะเบียนโปรแกรม",
    desc: "รหัสโปรแกรม ชื่อโปรแกรม สถานะ และเมนู/หน้าจอของแต่ละโปรแกรม",
  },
];

export default async function CoreHomePage() {
  const [companies, branches, users, programs, menus] = await Promise.all([
    listCompanies(),
    listBranches(),
    listCoreUsers(),
    listPrograms(),
    listMenus(),
  ]);

  const cards = [
    { label: "บริษัท", value: companies.length, sub: `เปิดใช้งาน ${companies.filter((c) => c.is_active).length}` },
    { label: "สาขา", value: branches.length, sub: `เปิดใช้งาน ${branches.filter((b) => b.is_active).length}` },
    { label: "ผู้ใช้งาน", value: users.length, sub: `ใช้งานได้ ${users.filter((u) => u.is_active).length}` },
    { label: "โปรแกรม", value: programs.length, sub: `เปิดใช้งาน ${programs.filter((p) => p.is_active).length}` },
    { label: "เมนู/หน้าจอ", value: menus.length, sub: "ที่กำหนดสิทธิ์ได้" },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบส่วนกลางขององค์กร</h1>
        <p className="text-sm text-slate-500">
          จุดเดียวที่ตั้งค่าบริษัท สาขา ผู้ใช้งาน สิทธิ์การใช้งาน และทะเบียนโปรแกรมทั้งหมด
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="card block hover:border-brand-300">
            <p className="font-semibold text-slate-800">{s.title}</p>
            <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
          </Link>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold text-slate-800">ผู้ใช้งานแยกตามระดับ</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACCESS_LEVELS.map((level) => (
            <div key={level} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{ACCESS_LEVEL_LABEL[level]}</p>
              <p className="mt-1 text-xl font-bold text-slate-800">
                {users.filter((u) => u.access_level === level).length} คน
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

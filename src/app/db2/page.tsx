import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENUS = [
  {
    menuCode: "DB2_DASH",
    href: "/db2/dashboard",
    title: "1. Dashboard ยอดขายสด",
    description: "จำนวนคัน ยอดขาย ต้นทุน กำไรขั้นต้น แยกรายเดือน/ช่องทาง/สาขา/รุ่น — เลือกช่วงวันที่ได้",
  },
  {
    menuCode: "DB2_STOCK",
    href: "/db2/stock",
    title: "2. สต็อกรถคงเหลือ",
    description: "รถที่ยังไม่ขายทุกสาขา อายุสต็อก มูลค่าต้นทุน และรายการค้างนานสุด",
  },
  {
    menuCode: "DB2_CUSTOMER",
    href: "/db2/customers",
    title: "3. ค้นลูกค้า / สัญญาผ่อน",
    description: "ค้นด้วยชื่อ รหัสลูกค้า เลขบัตร หรือเบอร์ ดูสัญญาผ่อนพร้อมยอดคงเหลือจริง และรถที่เคยซื้อ",
  },
  {
    menuCode: "DB2_WALL",
    href: "/db2/wall",
    title: "4. จอ War Room ยอดขาย",
    description: "เปิดค้างบนจอมอนิเตอร์ — วันนี้/เดือนนี้/ปีนี้ อันดับสาขา พนักงานขาย รุ่นรถ รีเฟรชเองทุกนาที",
  },
  {
    menuCode: "DB2_PIVOT",
    href: "/db2/stock/pivot",
    title: "5. สต็อกรถ Cross Tab",
    description: "เลือกแกนตั้ง/แกนนอนได้เอง กรองตามประเภท ยี่ห้อ รุ่น แบบ สี สาขา — จำนวนคันและจำนวนเงิน",
  },
  {
    menuCode: "DB2_JOBS",
    href: "/db2/jobs",
    title: "6. Dashboard งานซ่อม",
    description:
      "ใบงานซ่อมจากศูนย์บริการ — รายได้/กำไรแยกตามสาขาและช่างซ่อม ประเภทงานซ่อม และรายการงานที่ยังค้างปิด job",
  },
  {
    menuCode: "DB2_JOB_WALL",
    href: "/db2/jobs/wall",
    title: "7. จอ War Room งานซ่อม",
    description: "เปิดค้างบนจอมอนิเตอร์ — อันดับสาขา/ช่างซ่อม งานค้างปิด job แยกตามอายุ รีเฟรชเองทุกนาที",
  },
  {
    menuCode: "DB2_HP_WALL",
    href: "/db2/hpdebt/wall",
    title: "8. จอ War Room ลูกหนี้เช่าซื้อ",
    description:
      "ยอดคงเหลือและยอดเกินกำหนดของสัญญาผ่อน แยกตามสาขา กลุ่มลูกค้า ช่วงค้างงวด ผู้เก็บเงิน พร้อมผลการติดตามล่าสุดรายสัญญา",
  },
];

/** หน้าแรกของโปรแกรม — เมนูตามสิทธิ์ */
export default async function Db2HomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const menus = MENUS.filter((m) => readable.has(m.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ข้อมูลสดจากระบบขาย (Db2)</h1>
        <p className="text-sm text-slate-500">
          ทุกหน้าดึงข้อมูล ณ เวลาที่เปิดดูจากฐานข้อมูลระบบขายในบริษัทโดยตรง ไม่ใช่สำเนา —
          ถ้าเครื่องในบริษัทปิดอยู่จะเปิดไม่ได้ชั่วคราว
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {menus.map((m) => (
          <Link key={m.menuCode} href={m.href} className="card block hover:border-brand-500">
            <h2 className="font-semibold text-slate-800">{m.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{m.description}</p>
          </Link>
        ))}
      </div>

      {menus.length === 0 && (
        <p className="card text-sm text-slate-600">บัญชีนี้ยังไม่มีสิทธิ์ดูเมนูใดในโปรแกรมนี้</p>
      )}
    </main>
  );
}

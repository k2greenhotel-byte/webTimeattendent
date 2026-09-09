import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const CARDS: { href: string; menuCode: string; title: string; desc: string }[] = [
  {
    href: "/hotel/rounds",
    menuCode: "HTL_ENTRY",
    title: "1. บันทึกตรวจเช็คอาคาร",
    desc: "ตรวจงานส่วนกลางของทั้งสาขา — เลือกสาขาและวันที่ แล้วกดผลทีละข้อ ปกติ/ไม่ปกติ",
  },
  {
    href: "/hotel/rooms",
    menuCode: "HTL_ROOM",
    title: "2. บันทึกตรวจเช็คห้องพัก",
    desc: "ตรวจรายห้อง — เลือกสาขาแล้วไล่ตรวจทีละห้อง เห็นทันทีว่าห้องไหนยังไม่ได้ตรวจวันนี้",
  },
  {
    href: "/hotel/issues",
    menuCode: "HTL_ISSUE",
    title: "3. รายการที่ต้องแก้ไข",
    desc: "ติดตามข้อที่ตรวจแล้วไม่ปกติ เรียงตามความเร่งด่วน ผูกใบแจ้งซ่อม และปิดงานเมื่อแก้เสร็จ",
  },
  {
    href: "/hotel/search",
    menuCode: "HTL_SEARCH",
    title: "4. สอบถามผลการตรวจเช็ค",
    desc: "ค้นย้อนหลังทั้งงานอาคารและงานห้องพัก ตามสาขา ห้อง และช่วงวันที่ พร้อมรูปที่ถ่ายไว้",
  },
  {
    href: "/hotel/dashboard",
    menuCode: "HTL_DASH",
    title: "5. Dashboard ตรวจเช็ค",
    desc: "สรุปรายวัน รายสัปดาห์ รายเดือน · ปัญหาแยกตามประเภทงานและสาขา",
  },
  {
    href: "/hotel/setup",
    menuCode: "HTL_SETUP",
    title: "6. ตั้งค่ารายการและห้องพัก",
    desc: "ตั้งรายการที่ต้องตรวจแยกรายสาขา ทั้งงานอาคารและงานห้องพัก และเพิ่ม/ลดเบอร์ห้องพักได้เอง",
  },
  {
    href: "/hotel/wall",
    menuCode: "HTL_WALL",
    title: "จอ War Room ตรวจเช็คโรงแรม",
    desc: "เปิดค้างบนจอในออฟฟิศ — งานเร่งด่วน งานเลยกำหนด และสาขาที่ยังไม่ได้ตรวจวันนี้",
  },
];

/** หน้าแรกของโปรแกรม — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function HotelHomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = CARDS.filter((c) => readable.has(c.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตรวจเช็คโรงแรมประจำวัน</h1>
        <p className="text-sm text-slate-500">เลือกเมนูที่ต้องการใช้งาน</p>
      </div>

      {cards.length === 0 ? (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าเมนูใดของโปรแกรมนี้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="card block hover:border-brand-300">
              <h2 className="font-semibold text-slate-800">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

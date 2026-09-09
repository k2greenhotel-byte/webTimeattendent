import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const CARDS: { href: string; menuCode: string; title: string; desc: string }[] = [
  {
    href: "/inspection/inspections",
    menuCode: "INSP_ENTRY",
    title: "1. บันทึกตรวจสอบสาขา",
    desc: "เลือกบริษัท สาขา วันที่ และแบบฟอร์ม แล้วให้คะแนนรายข้อ พร้อมหมายเหตุและรูปประกอบ",
  },
  {
    href: "/inspection/search",
    menuCode: "INSP_SEARCH",
    title: "2. สอบถามผลการตรวจ",
    desc: "ค้นย้อนหลังตามบริษัท สาขา ช่วงวันที่ และแบบฟอร์ม เปิดดูผลรายข้อพร้อมรูปที่ถ่ายไว้",
  },
  {
    href: "/inspection/dashboard",
    menuCode: "INSP_DASH",
    title: "3. Dashboard ตรวจสาขา",
    desc: "คะแนนเฉลี่ยรายสาขา ค่าปรับ เงินรางวัล และข้อที่สาขาต่าง ๆ ตกซ้ำบ่อยที่สุด",
  },
  {
    href: "/inspection/setup",
    menuCode: "INSP_SETUP",
    title: "4. ตั้งค่ารายการตรวจ",
    desc: "เพิ่ม/ลด/แก้หมวด รายการ ตัวเลือก คะแนน และค่าปรับของแต่ละแบบฟอร์มได้เอง",
  },
  {
    href: "/inspection/wall",
    menuCode: "INSP_WALL",
    title: "จอ War Room ตรวจสาขา",
    desc: "เปิดค้างบนจอในออฟฟิศ — สาขาคะแนนต่ำ สาขาที่หลุดคิวตรวจ และข้อที่ตกบ่อย",
  },
];

/** หน้าแรกของโปรแกรม — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function InspectionHomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = CARDS.filter((c) => readable.has(c.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบตรวจสอบสาขา</h1>
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

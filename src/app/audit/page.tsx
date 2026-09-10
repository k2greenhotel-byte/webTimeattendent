import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const CARDS: { href: string; menuCode: string; title: string; desc: string }[] = [
  {
    href: "/audit/audits",
    menuCode: "AUD_ENTRY",
    title: "1. บันทึกผลการตรวจสอบประจำวัน",
    desc: "เปิดใบคุมงานของวันที่ทำงาน ดึงใบสั่งขายและใบเบิกเงินสดย่อยเข้ามาตรวจ ลงผลตรวจ เอกสารประกอบ และผลการโทรถาม",
  },
  {
    href: "/audit/search",
    menuCode: "AUD_SEARCH",
    title: "2. สอบถามผลการตรวจสอบ",
    desc: "ค้นย้อนหลังรายเอกสาร — ตามช่วงวันที่ สาขา ผู้ตรวจสอบ ผลตรวจ เอกสารครบ/ไม่ครบ และผลการโทร",
  },
  {
    href: "/audit/reports",
    menuCode: "AUD_REPORT",
    title: "3. รายงานผลการตรวจสอบ",
    desc: "สรุปรายสาขา รายผู้ตรวจสอบ รายรายการตรวจ เอกสารที่ขาดบ่อย และรายการที่ต้องตามต่อ พร้อมหน้าพิมพ์",
  },
  {
    href: "/audit/dashboard",
    menuCode: "AUD_DASH",
    title: "4. Dashboard ตรวจสอบบัญชี",
    desc: "ภาพรวมงานตรวจในช่วงที่เลือก — ตรวจไปเท่าไร ผิดกี่รายการ ข้อมูลไม่ตรงกี่ราย และสาขาที่ต้องจับตา",
  },
  {
    href: "/audit/setup",
    menuCode: "AUD_SETUP",
    title: "5. ตั้งค่ารายการตรวจสอบ",
    desc: "เพิ่ม/ลด/แก้รายการที่ต้องตรวจเอง และทะเบียนเอกสารประกอบที่ใช้ติ๊กว่าขาดอะไรบ้าง",
  },
];

/** หน้าแรกของโปรแกรม — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function AuditHomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = CARDS.filter((c) => readable.has(c.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบตรวจสอบบัญชี (ธุรกิจมอเตอร์ไซค์)</h1>
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

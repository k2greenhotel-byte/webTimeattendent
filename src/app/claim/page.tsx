import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const CARDS: { href: string; menuCode: string; title: string; desc: string }[] = [
  {
    href: "/claim/claims",
    menuCode: "CLM_CLAIM",
    title: "1.4 บันทึกแจ้งเคลม",
    desc: "เปิดใบขอเคลม ดึงรถและลูกค้าจากระบบขายด้วยเลขตัวถัง แนบรูปความเสียหาย",
  },
  {
    href: "/claim/updates",
    menuCode: "CLM_UPDATE",
    title: "1.5 Update งานเคลม",
    desc: "บันทึกความคืบหน้า ผลอนุมัติจากผู้ผลิต และรูปงานที่ซ่อม",
  },
  {
    href: "/claim/search",
    menuCode: "CLM_SEARCH",
    title: "2. สอบถามงานขอเคลม",
    desc: "ค้นตามความเร่งด่วน บริษัท สาขา สถานะงาน และสถานะเอกสาร",
  },
  {
    href: "/claim/dashboard",
    menuCode: "CLM_DASH",
    title: "3. Dashboard ติดตามงานเคลม",
    desc: "ภาพรวมสถานะ งานเกินกำหนด งานรอผลจากผู้ผลิต และรถที่รอส่งคืนลูกค้า",
  },
];

/** หน้าแรกของโปรแกรม — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function ClaimHomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = CARDS.filter((c) => readable.has(c.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบแจ้งเคลม</h1>
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

import Link from "next/link";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const CARDS: { href: string; menuCode: string; title: string; desc: string }[] = [
  { href: "/procurement/repairs", menuCode: "PR_REPAIR", title: "1.1 บันทึกแจ้งซ่อม", desc: "แจ้งขอซ่อมทรัพย์สิน แนบรูป และติดตามสถานะ" },
  { href: "/procurement/updates", menuCode: "PR_REPAIR_UPD", title: "1.2 Update งานซ่อม", desc: "บันทึกความคืบหน้าของงานซ่อมที่กำลังดำเนินการ" },
  { href: "/procurement/purchases", menuCode: "PR_PURCHASE", title: "2.1 บันทึกขอจัดซื้อ", desc: "ขอจัดซื้อวัสดุ/ครุภัณฑ์ พร้อมแนบรูปประกอบ" },
  { href: "/procurement/approvals", menuCode: "PR_APPROVE", title: "3.1 อนุมัติซ่อม/จัดซื้อ", desc: "พิจารณาอนุมัติ ไม่อนุมัติ หรือให้หาราคาใหม่มาเทียบ" },
  { href: "/procurement/payments", menuCode: "PR_PAYMENT", title: "4.1 จ่ายเงินจากเงินสดย่อย", desc: "จ่ายทั้งรายการที่อนุมัติแล้วและรายการทั่วไป พร้อมลายเซ็นและพิมพ์เอกสาร" },
  { href: "/procurement/central-payments", menuCode: "PR_CENTRAL_PAY", title: "4.2 จ่ายเงินจากส่วนกลาง", desc: "ฟังก์ชันเหมือนเงินสดย่อยทุกอย่าง แต่ใช้ชุดเลขที่เอกสารแยกต่างหาก" },
  { href: "/procurement/tag-report", menuCode: "PR_TAG_REPORT", title: "4.3 รายงานสรุปตามป้ายกำกับ", desc: "สรุปยอดจ่ายแยกตามป้ายที่ติดไว้ ทั้งเงินสดย่อยและส่วนกลาง" },
  { href: "/procurement/search", menuCode: "PR_SEARCH", title: "5. สอบถามงานซ่อม/งานขอซื้อ", desc: "ค้นหาและติดตามเอกสารทุกสถานะ" },
  { href: "/procurement/dashboard", menuCode: "PR_DASH", title: "6. Dashboard ติดตามงานซ่อม", desc: "ภาพรวมสถานะงาน ยอดเงิน และงานเกินกำหนด" },
  { href: "/procurement/setup/accounts", menuCode: "PR_ACCOUNT", title: "ตั้งค่า ผังบัญชี", desc: "กำหนดหมวดบัญชี บัญชีคุม และบัญชีย่อย ใช้เป็นประเภทค่าใช้จ่าย" },
  { href: "/procurement/setup/asset-types", menuCode: "PR_ASSET_TYPE", title: "ตั้งค่า ประเภททรัพย์สิน", desc: "ประเภททรัพย์สินที่ใช้ในใบขอซ่อม" },
  { href: "/procurement/setup/material-types", menuCode: "PR_MATERIAL_TYPE", title: "ตั้งค่า ประเภทวัสดุ", desc: "ประเภทวัสดุที่ใช้ในใบขอจัดซื้อ" },
];

/** หน้าแรกของโปรแกรม — แสดงเฉพาะเมนูที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง */
export default async function ProcurementHomePage() {
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = CARDS.filter((c) => readable.has(c.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบจัดซื้อจัดจ้างแจ้งซ่อม</h1>
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

import StockPivot from "@/components/db2/StockPivot";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Db2StockPivotPage() {
  await requirePermission("DB2_PIVOT");
  return (
    <main className="mx-auto max-w-[1600px] space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">สต็อกรถคงเหลือ — ตาราง Cross Tab</h1>
        <p className="text-sm text-slate-500">
          เลือกมิติแกนตั้ง/แกนนอน และกรองตาม ประเภทรถ ยี่ห้อ รุ่น แบบ สี สาขาที่เก็บ สภาพรถ · ตัวเลขคือจำนวนคัน
          และต้นทุนก่อน VAT ณ ตอนนี้
        </p>
      </div>
      <StockPivot />
    </main>
  );
}

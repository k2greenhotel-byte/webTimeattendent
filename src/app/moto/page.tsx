import Link from "next/link";
import { MOTO_MASTERS, masterTitle } from "@/lib/moto";
import { countAllMasters } from "@/lib/moto-db";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าแรกของโปรแกรม — รวมข้อมูลหลักทั้ง 10 ชุด พร้อมจำนวนรายการที่มีอยู่ */
export default async function MotoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const [permissions, counts] = await Promise.all([getMyPermissions(), countAllMasters()]);
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = MOTO_MASTERS.filter((m) => readable.has(m.menuCode));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ข้อมูลเบื้องต้น ธุรกิจรถจักรยานยนต์</h1>
        <p className="text-sm text-slate-500">
          ค่าเริ่มต้นที่หน้าจอบันทึกอื่น ๆ จะเรียกไปใช้เป็นตัวเลือก — ปิด “ใช้งาน” เพื่อซ่อนจาก dropdown
          โดยไม่ต้องลบของเก่าทิ้ง
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {cards.length === 0 && (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าเมนูใดของโปรแกรมนี้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((spec) => (
          <Link
            key={spec.kind}
            href={`/moto/setup/${spec.slug}`}
            className="card space-y-1 transition hover:border-brand-400 hover:shadow"
          >
            <h2 className="font-semibold text-slate-800">{masterTitle(spec)}</h2>
            <p className="text-xs text-slate-500">{spec.description}</p>
            <p className="pt-1 text-sm text-slate-600">
              {counts[spec.kind].total} รายการ
              <span className="text-slate-400">
                {" "}
                · เปิดใช้งาน {counts[spec.kind].active}
              </span>
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}

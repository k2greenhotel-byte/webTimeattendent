import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getBranchById, getEmployeeById, listFieldTaskTypes, listSites } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { startOwnFieldTaskForm } from "./actions";

export const dynamic = "force-dynamic";

/** พนักงานเริ่มงานนอกสถานที่เอง (ไม่ต้องรอแอดมินมอบหมาย) */
export default async function NewFieldTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);
  const companyId = branch?.company_id ?? null;

  const [types, sites] = await Promise.all([listFieldTaskTypes(companyId), listSites(companyId, true)]);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} links={[{ href: "/punch", label: "ลงเวลา" }]} />

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">เริ่มงานนอกสถานที่</h1>
          <p className="text-sm text-slate-500">
            ใช้เมื่อต้องออกไปทำงานข้างนอกโดยไม่ได้ถูกจัดไว้ล่วงหน้า เช่น ส่งรถให้ลูกค้า — บันทึกแล้วระบบจะพาไปถ่ายรูปเริ่มงานทันที
          </p>
        </div>

        {params.err && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
        )}

        <form action={startOwnFieldTaskForm} className="card space-y-3">
          <div>
            <label className="label" htmlFor="type_id">
              ประเภทงาน
            </label>
            <select id="type_id" name="type_id" className="input" required>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.counts_hours ? "" : " (ไม่นับชั่วโมง)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="site_id">
              สถานที่ (ถ้ามีในรายการ)
            </label>
            <select id="site_id" name="site_id" className="input" defaultValue="">
              <option value="">— ไม่อยู่ในรายการ พิมพ์เองด้านล่าง —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="place_text">
              หรือพิมพ์ชื่อสถานที่ปลายทาง
            </label>
            <input id="place_text" name="place_text" className="input" placeholder="เช่น บ้านลูกค้า ต.ท่าม่วง" />
          </div>

          <div>
            <label className="label" htmlFor="title">
              ชื่องาน (ไม่บังคับ)
            </label>
            <input id="title" name="title" className="input" placeholder="เช่น ส่งรถคุณสมชาย" />
          </div>

          <div>
            <label className="label" htmlFor="note">
              หมายเหตุ
            </label>
            <input id="note" name="note" className="input" />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 py-3">
              บันทึกและถ่ายรูปเริ่มงาน
            </button>
            <Link href="/punch" className="btn-secondary py-3">
              ยกเลิก
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            ระบบบันทึกพิกัดจริงตอนถ่ายรูป · หัวหน้าเห็นงานนี้ในหน้าหลังบ้านและตรวจย้อนหลังได้
          </p>
        </form>
      </main>
    </div>
  );
}

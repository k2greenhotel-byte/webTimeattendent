import Link from "next/link";
import { workScope } from "@/app/salework/scope";
import { addDays, formatThaiDate, workDateOf } from "@/lib/datetime";
import { progressOf } from "@/lib/salework";
import { getLogByOwnerDate, listLogs } from "@/lib/salework-db";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENUS = [
  {
    menuCode: "SW_ENTRY",
    href: "/salework/daily",
    title: "1. บันทึกงานประจำวัน",
    description: "ติ๊กงานที่ทำวันนี้ กรอกจำนวนใบปลิว/ยอดวิว/แชต/สายที่โทร แล้วแนบรูปหรือคลิป",
  },
  {
    menuCode: "SW_SEARCH",
    href: "/salework/search",
    title: "2. ประวัติการทำงาน",
    description: "ค้นใบงานย้อนหลังตามช่วงวัน พนักงาน สาขา และสถานะการส่งงาน",
  },
  {
    menuCode: "SW_DASH",
    href: "/salework/dashboard",
    title: "3. Dashboard สรุปงานพนักงานขาย",
    description: "กระดานเทียบผลงานรายคน รายประเภทงาน และยอดขายจริงจากระบบขาย",
  },
  {
    menuCode: "SW_SETUP",
    href: "/salework/setup",
    title: "4. ตั้งค่าประเภทงาน",
    description: "กำหนดว่ามีงานอะไรบ้าง ให้กรอกตัวเลขอะไร และงานไหนบังคับแนบรูป/คลิป",
  },
  {
    menuCode: "SW_MAP",
    href: "/salework/mapping",
    title: "5. จับคู่พนักงานขายกับระบบขาย (Db2)",
    description: "ผูกบัญชีผู้ใช้ในเว็บกับรหัสพนักงานขายในระบบขาย เพื่อเทียบกับยอดขายจริง",
  },
];

/** หน้าแรกของระบบบันทึกงานประจำวันพนักงานขาย — เมนูตามสิทธิ์ พร้อมสถานะงานวันนี้ */
export default async function SaleWorkHomePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const scope = await workScope("SW_ENTRY");
  const today = workDateOf();

  const [permissions, todayLog, recent] = await Promise.all([
    getMyPermissions(),
    getLogByOwnerDate(scope.user.id, today),
    listLogs({ owner_id: scope.user.id, from: addDays(today, -7), to: today, limit: 10 }),
  ]);

  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = MENUS.filter((m) => readable.has(m.menuCode));
  const progress = progressOf(todayLog?.items ?? []);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึกงานประจำวันพนักงานขาย</h1>
        <p className="text-sm text-slate-500">{formatThaiDate(today)}</p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">งานของคุณวันนี้</h2>
        {todayLog ? (
          <>
            <p className="text-sm text-slate-600">
              ใบงาน <span className="font-mono">{todayLog.log.doc_no}</span> · ทำแล้ว {progress.done}/
              {progress.total} งาน ({progress.pct}%)
            </p>
            <p className="text-sm">
              {todayLog.log.submitted_at ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                  ส่งงานแล้ว
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  ยังเป็นร่าง — อย่าลืมกดส่งงานก่อนเลิกงาน
                </span>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">ยังไม่ได้เปิดใบงานของวันนี้</p>
        )}
        <Link href="/salework/daily" className="btn-primary inline-block">
          {todayLog ? "เปิดใบงานวันนี้" : "เริ่มบันทึกงานวันนี้"}
        </Link>
      </section>

      {recent.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">7 วันล่าสุดของคุณ</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {formatThaiDate(r.work_date)}{" "}
                  <span className="font-mono text-xs text-slate-400">{r.doc_no}</span>
                </span>
                <span className="text-slate-600">
                  {r.done_count}/{r.item_count} งาน
                  {r.submitted_at ? " · ส่งแล้ว" : " · ร่าง"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cards.length === 0 && (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าเมนูใดของโปรแกรมนี้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((m) => (
          <Link
            key={m.menuCode}
            href={m.href}
            className="card space-y-1 transition hover:border-brand-400 hover:shadow"
          >
            <h2 className="font-semibold text-slate-800">{m.title}</h2>
            <p className="text-xs text-slate-500">{m.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

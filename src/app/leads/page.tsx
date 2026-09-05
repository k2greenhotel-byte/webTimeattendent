import Link from "next/link";
import { leadScope, scopedQuery } from "@/app/leads/scope";
import { workDateOf } from "@/lib/datetime";
import { buildOverview } from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";
import { WORK_STATUS_LABEL, WORK_STATUS_ORDER } from "@/lib/lead-types";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENUS = [
  {
    menuCode: "LEAD_ENTRY",
    href: "/leads/leads",
    title: "1. บันทึกข้อมูล Lead",
    description: "บันทึกชื่อ เบอร์โทร รุ่นที่สนใจ ช่องทางที่ติดต่อเข้ามา และระดับโอกาสการขาย",
  },
  {
    menuCode: "LEAD_FOLLOW",
    href: "/leads/follow",
    title: "2. ติดตามการขาย",
    description: "กระดานแยกตามสถานะงานและสีของโอกาส คลิกใบไหนก็บันทึกผลการโทรได้ทันที",
  },
  {
    menuCode: "LEAD_SEARCH",
    href: "/leads/search",
    title: "3. สอบถามข้อมูล Lead",
    description: "ค้นตามพนักงานขาย สาขา ช่องทาง รุ่นรถ ช่วงวันที่ และดาวน์โหลด Excel",
  },
  {
    menuCode: "LEAD_DASH",
    href: "/leads/dashboard",
    title: "4. Dashboard งานขาย",
    description: "อัตราการปิดการขายรายคน/รายสาขา 10 อันดับรุ่นยอดนิยม และรายการที่ต้องเร่งตาม",
  },
];

/** หน้าแรกของระบบข้อมูล Lead — เมนูตามสิทธิ์ พร้อมสรุปงานที่ต้องทำวันนี้ */
export default async function LeadHomePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const scope = await leadScope("LEAD_ENTRY");
  const today = workDateOf();

  const [permissions, rows] = await Promise.all([
    getMyPermissions(),
    listLeads(scopedQuery({}, scope)),
  ]);

  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = MENUS.filter((m) => readable.has(m.menuCode));
  const overview = buildOverview(rows, today);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบข้อมูล Lead</h1>
        <p className="text-sm text-slate-500">
          {scope.canSeeAll
            ? "เห็นข้อมูลของพนักงานขายทุกคน — ใช้ตัวกรองเพื่อดูรายคนหรือรายสาขา"
            : "แสดงเฉพาะ Lead ของคุณเท่านั้น"}
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">สรุป Lead ทั้งหมด {overview.total} ราย</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORK_STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{WORK_STATUS_LABEL[s]}</p>
              <p className="text-lg font-semibold text-slate-800">{overview.byStatus[s]}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Link href="/leads/follow?overdue=1" className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="text-xs text-rose-600">เลยนัดติดตาม</p>
            <p className="text-lg font-semibold text-rose-700">{overview.overdue}</p>
          </Link>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">ยังไม่ได้นัดวันติดตาม</p>
            <p className="text-lg font-semibold text-amber-800">{overview.noPlan}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-xs text-emerald-700">อัตราการปิดการขาย</p>
            <p className="text-lg font-semibold text-emerald-800">{overview.closeRate}%</p>
          </div>
        </div>
      </section>

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

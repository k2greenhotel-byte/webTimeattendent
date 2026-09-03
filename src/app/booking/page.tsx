import Link from "next/link";
import { formatBaht, summarize } from "@/lib/booking";
import { listBookings } from "@/lib/booking-db";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_ORDER } from "@/lib/booking-types";
import { getMyPermissions } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENUS = [
  {
    menuCode: "BOOK_ENTRY",
    href: "/booking/bookings",
    title: "1.1 รับจองรถ",
    description: "บันทึกใบจอง ลูกค้า รถที่จอง เงินมัดจำ และแนบเอกสารรับเงิน/คืนเงิน",
  },
  {
    menuCode: "BOOK_UPDATE",
    href: "/booking/updates",
    title: "1.2 Update สถานะใบจอง",
    description: "บันทึกความคืบหน้า สถานะรถ สถานะสัญญา สถานะการจอง และปิดงานใบจอง",
  },
  {
    menuCode: "BOOK_SEARCH",
    href: "/booking/search",
    title: "1.3 สอบถามใบจอง",
    description: "ค้นตามยี่ห้อ รุ่น แบบ สถานะต่าง ๆ และช่วงวันที่นัดรับรถ",
  },
  {
    menuCode: "BOOK_DASH",
    href: "/booking/dashboard",
    title: "1.4 Dashboard",
    description: "ปฏิทินวันนัดรับรถ/วันจอง และสรุปแยกตามยี่ห้อ รุ่น และสถานะ",
  },
];

/** หน้าแรกของโปรแกรมจองรถ — เมนูตามสิทธิ์ พร้อมสรุปสถานะปัจจุบัน */
export default async function BookingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const [permissions, rows] = await Promise.all([getMyPermissions(), listBookings({ limit: 500 })]);

  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));
  const cards = MENUS.filter((m) => readable.has(m.menuCode));
  const summary = summarize(rows);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบจองรถ</h1>
        <p className="text-sm text-slate-500">
          ลูกค้าและข้อมูลรถดึงมาจากทะเบียนลูกค้าและข้อมูลเบื้องต้น — ใบจองเก็บเฉพาะเงื่อนไขการซื้อและสถานะ
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">สรุปใบจองล่าสุด {summary.total} ใบ</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BOOKING_STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{BOOKING_STATUS_LABEL[s]}</p>
              <p className="text-lg font-semibold text-slate-800">{summary.byBookingStatus[s]}</p>
            </div>
          ))}
          <div className="rounded-xl bg-brand-50 px-3 py-2">
            <p className="text-xs text-slate-500">เงินมัดจำรวม</p>
            <p className="text-lg font-semibold text-brand-700">{formatBaht(summary.deposit)}</p>
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

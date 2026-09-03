import Link from "next/link";
import BookingTable from "@/components/booking/BookingTable";
import { formatBaht, summarize } from "@/lib/booking";
import { listBookings } from "@/lib/booking-db";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  DOC_STATUS_LABEL,
  DOC_STATUS_ORDER,
  type BookingQuery,
} from "@/lib/booking-types";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — รายการใบจองทั้งหมด พร้อมค้นหาแบบเร็ว */
export default async function BookingListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    doc?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  const params = await searchParams;
  const keyword = (params.q ?? "").trim();

  const query: BookingQuery = {
    keyword,
    booking_status: (BOOKING_STATUS_ORDER as string[]).includes(params.status ?? "")
      ? (params.status as BookingQuery["booking_status"])
      : null,
    doc_status: (DOC_STATUS_ORDER as string[]).includes(params.doc ?? "")
      ? (params.doc as BookingQuery["doc_status"])
      : null,
  };

  const [rows, canWrite] = await Promise.all([
    listBookings(query),
    checkPermission("BOOK_ENTRY", "write"),
  ]);
  const summary = summarize(rows);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1.1 รับจองรถ</h1>
          <p className="text-sm text-slate-500">
            เลขที่ใบจองระบบรันให้อัตโนมัติ · เงินมัดจำรวมที่แสดงอยู่ {formatBaht(summary.deposit)}
          </p>
        </div>
        {canWrite && (
          <Link href="/booking/bookings/new" className="btn-primary">
            + รับจองรถใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={keyword}
            className="input w-full sm:w-72"
            placeholder="เลขที่ใบจอง / อ้างอิง / ชื่อลูกค้า / เบอร์โทร"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="status">
            สถานะการจอง
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {BOOKING_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="doc">
            สถานะเอกสาร
          </label>
          <select id="doc" name="doc" defaultValue={params.doc ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {DOC_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {DOC_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href="/booking/bookings" className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <BookingTable
          rows={rows}
          emptyText={
            keyword || params.status || params.doc
              ? "ไม่พบใบจองที่ตรงกับเงื่อนไข"
              : "ยังไม่มีใบจองในระบบ — กด “รับจองรถใหม่” เพื่อเริ่มใบแรก"
          }
        />
      </section>
    </main>
  );
}

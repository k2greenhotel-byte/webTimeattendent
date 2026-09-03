import Link from "next/link";
import UpdateForm from "@/components/booking/UpdateForm";
import { describeVehicle } from "@/lib/booking";
import { getBooking, listBookings } from "@/lib/booking-db";
import {
  BOOKING_STATUS_LABEL,
  CONTRACT_STATUS_LABEL,
  VEHICLE_STATUS_LABEL,
} from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";
import { createUpdateForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.2 — บันทึก update สถานะของใบจองหนึ่งใบ */
export default async function NewUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; err?: string; msg?: string }>;
}) {
  const user = await requirePermission("BOOK_UPDATE", "write");
  const params = await searchParams;

  // ตัวเลือกใบจองแสดงเฉพาะที่ยังไม่ปิดงาน — แต่ถ้าเปิดมาจากใบที่ปิดแล้ว ให้เห็นใบนั้นด้วย
  const [openBookings, selected] = await Promise.all([
    listBookings({ doc_status: "active" }),
    params.booking ? getBooking(params.booking) : Promise.resolve(null),
  ]);

  const bookings =
    selected && !openBookings.some((b) => b.id === selected.id)
      ? [selected, ...openBookings]
      : openBookings;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึก Update สถานะใบจอง</h1>
        <p className="text-sm text-slate-500">
          ช่องสถานะที่เว้นว่างไว้จะไม่ถูกเปลี่ยน — บันทึกเฉพาะสิ่งที่เกิดขึ้นจริงในครั้งนี้
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {selected && (
        <section className="card space-y-1 bg-slate-50 text-sm">
          <h2 className="font-semibold text-slate-800">
            สถานะปัจจุบันของ{" "}
            <Link href={`/booking/bookings/${selected.id}`} className="text-brand-600 hover:underline">
              {selected.doc_no}
            </Link>
          </h2>
          <p className="text-slate-600">
            {selected.customer_name ?? "ไม่ระบุลูกค้า"} · {describeVehicle(selected)} · จองวันที่{" "}
            {formatThaiDate(selected.booking_date)}
          </p>
          <p className="text-slate-600">
            สถานะรถ {VEHICLE_STATUS_LABEL[selected.vehicle_status]} · สถานะสัญญา{" "}
            {CONTRACT_STATUS_LABEL[selected.contract_status]} · สถานะการจอง{" "}
            {BOOKING_STATUS_LABEL[selected.booking_status]}
          </p>
        </section>
      )}

      {bookings.length === 0 ? (
        <p className="card text-sm text-slate-600">
          ยังไม่มีใบจองที่เปิดอยู่ให้ update —{" "}
          <Link href="/booking/bookings/new" className="text-brand-600 hover:underline">
            รับจองรถใบใหม่ก่อน
          </Link>
        </p>
      ) : (
        <UpdateForm
          bookings={bookings}
          selected={selected}
          defaultRecorderName={user.full_name}
          action={createUpdateForm}
        />
      )}
    </main>
  );
}

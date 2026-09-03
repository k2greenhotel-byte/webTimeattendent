import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "@/components/booking/BookingForm";
import { DocStatusBadge } from "@/components/booking/StatusBadges";
import UpdateList, { UpdateFileLinks } from "@/components/booking/UpdateList";
import { formatBaht } from "@/lib/booking";
import { getBooking, listBookingFiles, listUpdateFiles, listUpdates } from "@/lib/booking-db";
import { getCustomer } from "@/lib/customer-db";
import { formatThaiDate } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { listMaster } from "@/lib/moto-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteBookingForm, deleteUpdateForm, updateBookingForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — แก้ไขใบจอง พร้อมประวัติการ update (1.2) ของใบนี้ */
export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("BOOK_ENTRY", "read");
  const { id } = await params;
  const query = await searchParams;

  const booking = await getBooking(id);
  if (!booking) notFound();

  const [
    files,
    updates,
    customer,
    branches,
    brands,
    models,
    variants,
    colors,
    canEdit,
    canDelete,
    canUpdate,
    canDeleteUpdate,
  ] = await Promise.all([
    listBookingFiles(id),
    listUpdates({ booking_id: id }),
    booking.customer_id ? getCustomer(booking.customer_id) : Promise.resolve(null),
    listBranches(true),
    listMaster("brand"),
    listMaster("model"),
    listMaster("variant"),
    listMaster("color"),
    checkPermission("BOOK_ENTRY", "edit"),
    checkPermission("BOOK_ENTRY", "delete"),
    checkPermission("BOOK_UPDATE", "write"),
    checkPermission("BOOK_UPDATE", "delete"),
  ]);

  const updateFiles = await Promise.all(updates.map((u) => listUpdateFiles(u.id)));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            ใบจองเลขที่ {booking.doc_no} <DocStatusBadge status={booking.doc_status} />
          </h1>
          <p className="text-sm text-slate-500">
            จองวันที่ {formatThaiDate(booking.booking_date)} · มัดจำ {formatBaht(booking.deposit_amount)}
            {` · ผู้รับจอง ${booking.taken_by_name ?? booking.taken_by_full_name ?? "ไม่ระบุ"}`}
            {booking.sale_contract_no ? ` · สัญญาขาย ${booking.sale_contract_no}` : ""}
            {booking.sale_date ? ` (${formatThaiDate(booking.sale_date)})` : ""}
            {booking.refunded ? " · คืนเงินลูกค้าแล้ว" : ""}
          </p>
        </div>
        {canUpdate && (
          <Link href={`/booking/updates/new?booking=${booking.id}`} className="btn-primary">
            + บันทึก Update สถานะ
          </Link>
        )}
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <BookingForm
          booking={booking}
          customer={
            customer
              ? {
                  id: customer.id,
                  code: customer.code,
                  full_name: customer.full_name,
                  phone: customer.phone,
                  province_name: customer.province_name ?? null,
                }
              : null
          }
          files={files}
          branches={branches}
          brands={brands}
          models={models}
          variants={variants}
          colors={colors}
          defaultStaffName={user.full_name}
          action={updateBookingForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">เอกสารแนบ</h2>
          <UpdateFileLinks files={files} />
          <p className="text-xs text-slate-500">บัญชีนี้ไม่มีสิทธิ์แก้ไขใบจอง (ดูอย่างเดียว)</p>
        </section>
      )}

      {/* ---------- ประวัติการ update (1.2) ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ประวัติการ Update ({updates.length} ครั้ง)</h2>
        <UpdateList
          rows={updates}
          files={updateFiles}
          deleteAction={canDeleteUpdate ? deleteUpdateForm : undefined}
          emptyText="ยังไม่มีการบันทึก update ของใบจองนี้"
        />
      </section>

      {/* ---------- ลบใบจอง ---------- */}
      {canDelete && (
        <section className="card space-y-2 border-rose-200">
          <h2 className="font-semibold text-rose-700">ลบใบจองนี้</h2>
          <p className="text-sm text-slate-600">
            ลบแล้วใบ update {updates.length} ใบ และเอกสารแนบทั้งหมดจะถูกลบตามไปด้วย ย้อนกลับไม่ได้
          </p>
          <form action={deleteBookingForm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={booking.id} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm" />
              ยืนยันลบใบจอง {booking.doc_no}
            </label>
            <button type="submit" className="btn-danger">
              ลบใบจอง
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

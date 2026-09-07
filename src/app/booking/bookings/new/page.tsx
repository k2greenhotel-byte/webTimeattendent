import BookingForm from "@/components/booking/BookingForm";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { createBookingForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — รับจองรถใบใหม่ */
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("BOOK_ENTRY", "write");
  const params = await searchParams;

  const branches = await listBranches(true);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รับจองรถ</h1>
        <p className="text-sm text-slate-500">
          เลขที่ใบจองระบบออกให้ตอนกดบันทึก · ลูกค้าดึงจากทะเบียนลูกค้า · ยี่ห้อ/รุ่น/แบบ/สี ค้นจากระบบขาย (Db2)
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <BookingForm
        branches={branches}
        defaultBranchId={user.branch_id ?? null}
        defaultStaffName={user.full_name}
        action={createBookingForm}
        submitLabel="บันทึกใบจอง"
      />
    </main>
  );
}

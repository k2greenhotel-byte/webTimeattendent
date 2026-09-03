import BookingForm from "@/components/booking/BookingForm";
import { listBranches } from "@/lib/db";
import { listMaster } from "@/lib/moto-db";
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

  const [branches, brands, models, variants, colors] = await Promise.all([
    listBranches(true),
    listMaster("brand"),
    listMaster("model"),
    listMaster("variant"),
    listMaster("color"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รับจองรถ</h1>
        <p className="text-sm text-slate-500">
          เลขที่ใบจองระบบออกให้ตอนกดบันทึก · ลูกค้าและรถเลือกจากข้อมูลที่มีอยู่แล้ว ไม่ต้องพิมพ์ซ้ำ
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <BookingForm
        branches={branches}
        brands={brands}
        models={models}
        variants={variants}
        colors={colors}
        defaultBranchId={user.branch_id ?? null}
        defaultStaffName={user.full_name}
        action={createBookingForm}
        submitLabel="บันทึกใบจอง"
      />
    </main>
  );
}

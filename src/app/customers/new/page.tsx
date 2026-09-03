import Link from "next/link";
import CustomerForm from "@/components/customers/CustomerForm";
import { suggestCustomerCode } from "@/lib/customer-db";
import { safeReturnPath } from "@/lib/form-draft";
import { requirePermission } from "@/lib/session";
import { createCustomerForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string; return?: string }>;
}) {
  await requirePermission("CUST_FORM", "write");
  const params = await searchParams;
  const suggestedCode = await suggestCustomerCode();
  const returnTo = safeReturnPath(params.return);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">เพิ่มประวัติลูกค้า</h1>
        <p className="text-sm text-slate-500">
          รหัสลูกค้าระบบออกให้อัตโนมัติ (แก้เองได้) · ที่อยู่ส่วนตำบล/อำเภอ/จังหวัด ระบบดึงให้จากรหัสไปรษณีย์
        </p>
      </div>

      {returnTo && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          กำลังเพิ่มลูกค้าเพื่อใช้ต่อในหน้าที่ค้างไว้ — กดบันทึกแล้วระบบจะพากลับไปหน้านั้น
          พร้อมเลือกลูกค้าที่เพิ่งเพิ่มให้อัตโนมัติ{" "}
          <Link href={`${returnTo}?restore=1`} className="font-medium underline">
            กลับโดยไม่เพิ่ม
          </Link>
        </p>
      )}

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <CustomerForm
        suggestedCode={suggestedCode}
        action={createCustomerForm}
        submitLabel="บันทึกประวัติลูกค้า"
        returnTo={returnTo}
      />
    </main>
  );
}

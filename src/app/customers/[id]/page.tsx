import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerForm from "@/components/customers/CustomerForm";
import { getCustomer, getGeo } from "@/lib/customer-db";
import { ageFromBirthDate, formatFullAddress } from "@/lib/customers";
import { formatThaiDate } from "@/lib/datetime";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteCustomerForm, updateCustomerForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("CUST_LIST", "read");
  const { id } = await params;
  const query = await searchParams;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [geo, canEdit, canDelete] = await Promise.all([
    getGeo(customer.geo_code),
    checkPermission("CUST_FORM", "edit"),
    checkPermission("CUST_FORM", "delete"),
  ]);

  const age = ageFromBirthDate(customer.birth_date);
  const address = formatFullAddress({
    address_detail: customer.address_detail,
    subdistrict_name: customer.subdistrict_name,
    district_name: customer.district_name,
    province_name: customer.province_name,
    postal_code: customer.postal_code,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{customer.full_name}</h1>
          <p className="text-sm text-slate-500">
            รหัส {customer.code}
            {customer.birth_date ? ` · เกิด ${formatThaiDate(customer.birth_date)}` : ""}
            {age !== null ? ` (${age} ปี)` : ""}
            {customer.branch_name ? ` · สาขา ${customer.branch_name}` : ""}
          </p>
          {address && <p className="mt-1 text-sm text-slate-500">{address}</p>}
        </div>
        <Link href="/customers" className="btn-secondary">
          ← กลับรายชื่อลูกค้า
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <CustomerForm
          customer={customer}
          geo={geo}
          action={updateCustomerForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <p className="card text-sm text-slate-600">
          บัญชีของคุณมีสิทธิ์ดูอย่างเดียว — แก้ไขไม่ได้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      {canDelete && (
        <form action={deleteCustomerForm} className="card flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={customer.id} />
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-800">ลบประวัติลูกค้า</h2>
            <p className="text-sm text-slate-500">ลบแล้วข้อมูลและรูปถ่ายจะหายถาวร กู้คืนไม่ได้</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="confirm" />
            ยืนยันลบ
          </label>
          <button type="submit" className="btn-danger">
            ลบลูกค้ารายนี้
          </button>
        </form>
      )}
    </main>
  );
}

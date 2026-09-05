import PurchaseForm from "@/components/procurement/PurchaseForm";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listPrTypes } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { createPurchaseForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.3 — ขอจัดซื้อใบใหม่ */
export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("PR_PURCHASE", "write");
  const params = await searchParams;

  const [companies, branches, materialTypes] = await Promise.all([
    listCompanies(true),
    listBranches(true),
    listPrTypes("material"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ขอจัดซื้อ</h1>
        <p className="text-sm text-slate-500">เลขที่ใบขอจัดซื้อระบบออกให้ตอนกดบันทึก</p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <PurchaseForm
        companies={companies}
        branches={branches}
        materialTypes={materialTypes}
        defaultCompanyId={user.company_id ?? null}
        defaultBranchId={user.branch_id ?? null}
        defaultRecorderName={user.full_name}
        action={createPurchaseForm}
        submitLabel="บันทึกใบขอจัดซื้อ"
      />
    </main>
  );
}

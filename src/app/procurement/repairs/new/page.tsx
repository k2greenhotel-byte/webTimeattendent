import RepairForm from "@/components/procurement/RepairForm";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listPrTypes } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { createRepairForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — แจ้งซ่อมใบใหม่ */
export default async function NewRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("PR_REPAIR", "write");
  const params = await searchParams;

  const [companies, branches, assetTypes] = await Promise.all([
    listCompanies(true),
    listBranches(true),
    listPrTypes("asset"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">แจ้งขอซ่อม</h1>
        <p className="text-sm text-slate-500">เลขที่ใบขอซ่อมระบบออกให้ตอนกดบันทึก</p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <RepairForm
        companies={companies}
        branches={branches}
        assetTypes={assetTypes}
        defaultCompanyId={user.company_id ?? null}
        defaultBranchId={user.branch_id ?? null}
        defaultRecorderName={user.full_name}
        action={createRepairForm}
        submitLabel="บันทึกใบขอซ่อม"
      />
    </main>
  );
}

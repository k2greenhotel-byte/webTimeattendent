import ClaimForm from "@/components/claim/ClaimForm";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { createClaimForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.4 — แจ้งเคลมใบใหม่ */
export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("CLM_CLAIM", "write");
  const params = await searchParams;

  const [companies, branches] = await Promise.all([listCompanies(true), listBranches(true)]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">แจ้งขอเคลม</h1>
        <p className="text-sm text-slate-500">
          เลขที่ใบขอเคลมระบบออกให้ตอนกดบันทึก · กด “ค้นจากระบบขาย” เพื่อดึงรถและลูกค้าจากเลขตัวถัง
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <ClaimForm
        companies={companies}
        branches={branches}
        defaultCompanyId={user.company_id ?? null}
        defaultBranchId={user.branch_id ?? null}
        defaultRecorderName={user.full_name}
        action={createClaimForm}
        submitLabel="บันทึกใบขอเคลม"
      />
    </main>
  );
}

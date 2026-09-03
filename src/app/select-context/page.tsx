import CompanyBranchPicker from "@/components/CompanyBranchPicker";
import { getSelectableContext } from "@/lib/core-db";
import { ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { requireUser } from "@/lib/session";
import { selectContextAction } from "./actions";

export const dynamic = "force-dynamic";

/** เลือกบริษัทและสาขาที่จะเข้าทำงาน — ใช้ทั้งตอนล็อกอินและตอนขอเปลี่ยนระหว่างวัน */
export default async function SelectContextPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const { companies, branches } = await getSelectableContext(user.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
            🏢
          </div>
          <h1 className="text-xl font-bold text-slate-800">เลือกบริษัทและสาขา</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.full_name} · {ACCESS_LEVEL_LABEL[user.level]}
          </p>
        </div>

        {params.err && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
        )}

        <CompanyBranchPicker
          companies={companies}
          branches={branches}
          defaultCompanyId={user.company_id}
          defaultBranchId={user.branch_id}
          action={selectContextAction}
          next={params.next}
        />

        <p className="text-center text-sm text-slate-500">
          <a href="/apps" className="text-brand-600 hover:underline">
            ข้ามไปหน้ารวมโปรแกรม →
          </a>
        </p>
      </div>
    </main>
  );
}

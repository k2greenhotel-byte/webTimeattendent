import { createLeadForm } from "@/app/leads/actions";
import { leadOptions, leadScope } from "@/app/leads/scope";
import LeadForm from "@/components/lead/LeadForm";
import { workDateOf } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 — บันทึก Lead ใหม่ */
export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const { user } = await leadScope("LEAD_ENTRY", "write");
  const options = await leadOptions();

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึกข้อมูล Lead ใหม่</h1>
        <p className="text-sm text-slate-500">
          ยังไม่มีลูกค้าในระบบ กด “+ เพิ่มลูกค้าใหม่” ได้เลย — บันทึกเสร็จระบบจะพากลับมาที่ใบนี้พร้อมเติมชื่อให้
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <LeadForm
        branches={options.branches}
        brands={options.brands}
        models={options.models}
        channels={options.channels}
        defaultBranchId={user.branch_id ?? null}
        ownerName={user.full_name}
        today={workDateOf()}
        action={createLeadForm}
        submitLabel="บันทึก Lead"
        cancelHref="/leads/leads"
      />
    </main>
  );
}

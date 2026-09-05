import Link from "next/link";
import DocTable, { docHref } from "@/components/procurement/DocTable";
import DocFilters, { queryFromParams, type PrParams } from "@/components/procurement/DocFilters";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listRepairs } from "@/lib/procurement-db";
import { checkPermission } from "@/lib/session";
import { workDateOf } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — รายการใบขอซ่อมทั้งหมด พร้อมค้นหา */
export default async function RepairListPage({
  searchParams,
}: {
  searchParams: Promise<PrParams>;
}) {
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches, canWrite] = await Promise.all([
    listRepairs(query),
    listCompanies(true),
    listBranches(true),
    checkPermission("PR_REPAIR", "write"),
  ]);

  const today = workDateOf();
  const hasFilter = Object.values(params).some(Boolean);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1.1 บันทึกแจ้งซ่อม</h1>
          <p className="text-sm text-slate-500">เลขที่ใบขอซ่อมระบบรันให้อัตโนมัติ</p>
        </div>
        {canWrite && (
          <Link href="/procurement/repairs/new" className="btn-primary">
            + แจ้งซ่อมใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <DocFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/procurement/repairs"
        showKind={false}
      />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <DocTable
          rows={rows.map((r) => ({
            kind: "repair" as const,
            id: r.id,
            doc_no: r.doc_no,
            doc_date: r.request_date,
            company_id: r.company_id,
            company_name: r.company_name,
            branch_id: r.branch_id,
            branch_name: r.branch_name,
            item_name: r.item_name,
            type_name: r.asset_type_name,
            urgency: r.urgency,
            requested_amount: r.requested_amount,
            approved_amount: r.approved_amount,
            actual_amount: r.actual_amount,
            doc_status: r.doc_status,
            pay_status: r.pay_status,
            approve_status: r.approve_status,
            reject_reason: r.reject_reason,
            reject_note: r.reject_note,
            job_status: r.job_status,
            expected_done_date: r.expected_done_date,
            done_date: r.fixed_date,
            created_by: r.created_by,
            created_by_name: r.created_by_name,
            note: r.note,
            created_at: r.created_at,
          }))}
          today={today}
          hrefOf={docHref}
          emptyText={hasFilter ? "ไม่พบใบขอซ่อมที่ตรงกับเงื่อนไข" : "ยังไม่มีใบขอซ่อมในระบบ — กด “แจ้งซ่อมใหม่” เพื่อเริ่มใบแรก"}
        />
      </section>
    </main>
  );
}

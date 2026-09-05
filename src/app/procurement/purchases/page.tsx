import Link from "next/link";
import DocTable, { docHref } from "@/components/procurement/DocTable";
import DocFilters, { queryFromParams, type PrParams } from "@/components/procurement/DocFilters";
import { workDateOf } from "@/lib/datetime";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listPurchases } from "@/lib/procurement-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 2.1 — รายการใบขอจัดซื้อทั้งหมด พร้อมค้นหา */
export default async function PurchaseListPage({
  searchParams,
}: {
  searchParams: Promise<PrParams>;
}) {
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches, canWrite] = await Promise.all([
    listPurchases(query),
    listCompanies(true),
    listBranches(true),
    checkPermission("PR_PURCHASE", "write"),
  ]);

  const today = workDateOf();
  const hasFilter = Object.values(params).some(Boolean);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">2.1 บันทึกขอจัดซื้อ</h1>
          <p className="text-sm text-slate-500">เลขที่ใบขอจัดซื้อระบบรันให้อัตโนมัติ</p>
        </div>
        {canWrite && (
          <Link href="/procurement/purchases/new" className="btn-primary">
            + ขอจัดซื้อใหม่
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
        resetHref="/procurement/purchases"
        showKind={false}
        showJobStatus={false}
      />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <DocTable
          rows={rows.map((r) => ({
            kind: "purchase" as const,
            id: r.id,
            doc_no: r.doc_no,
            doc_date: r.request_date,
            company_id: r.company_id,
            company_name: r.company_name,
            branch_id: r.branch_id,
            branch_name: r.branch_name,
            item_name: r.item_name,
            type_name: r.material_type_name,
            urgency: r.urgency,
            requested_amount: r.requested_amount,
            approved_amount: r.approved_amount,
            actual_amount: r.actual_amount,
            doc_status: r.doc_status,
            pay_status: r.pay_status,
            approve_status: r.approve_status,
            reject_reason: r.reject_reason,
            reject_note: r.reject_note,
            job_status: null,
            expected_done_date: null,
            done_date: r.received_date,
            created_by: r.created_by,
            created_by_name: r.created_by_name,
            note: r.note,
            created_at: r.created_at,
          }))}
          today={today}
          hrefOf={docHref}
          showJobStatus={false}
          emptyText={
            hasFilter ? "ไม่พบใบขอจัดซื้อที่ตรงกับเงื่อนไข" : "ยังไม่มีใบขอจัดซื้อในระบบ — กด “ขอจัดซื้อใหม่” เพื่อเริ่มใบแรก"
          }
        />
      </section>
    </main>
  );
}

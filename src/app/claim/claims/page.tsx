import Link from "next/link";
import ClaimFilters, { queryFromParams, type ClaimParams } from "@/components/claim/ClaimFilters";
import ClaimTable from "@/components/claim/ClaimTable";
import { listClaims } from "@/lib/claim-db";
import { listCompanies } from "@/lib/core-db";
import { workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.4 — รายการใบขอเคลมทั้งหมด พร้อมค้นหา */
export default async function ClaimListPage({
  searchParams,
}: {
  searchParams: Promise<ClaimParams>;
}) {
  // ต้องมีสิทธิ์อ่านเมนูนี้ ไม่ใช่แค่มีสิทธิ์เข้าโปรแกรม CLM
  await requirePermission("CLM_CLAIM", "read");
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches, canWrite] = await Promise.all([
    listClaims(query),
    listCompanies(true),
    listBranches(true),
    checkPermission("CLM_CLAIM", "write"),
  ]);

  const today = workDateOf();
  const hasFilter = Object.entries(params).some(([key, value]) => value && key !== "msg" && key !== "err");

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1.4 บันทึกแจ้งเคลม</h1>
          <p className="text-sm text-slate-500">เลขที่ใบขอเคลมระบบรันให้อัตโนมัติ</p>
        </div>
        {canWrite && (
          <Link href="/claim/claims/new" className="btn-primary">
            + แจ้งเคลมใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <ClaimFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/claim/claims"
      />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} ใบ)</h2>
        <ClaimTable
          rows={rows}
          today={today}
          emptyText={
            hasFilter
              ? "ไม่พบใบขอเคลมที่ตรงกับเงื่อนไข"
              : "ยังไม่มีใบขอเคลมในระบบ — กด “แจ้งเคลมใหม่” เพื่อเริ่มใบแรก"
          }
        />
      </section>
    </main>
  );
}

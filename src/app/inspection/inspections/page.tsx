import Link from "next/link";
import InspectionFilters, {
  queryFromParams,
  type InspectionParams,
} from "@/components/inspection/InspectionFilters";
import InspectionTable from "@/components/inspection/InspectionTable";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { formatBaht, summarizeInspections } from "@/lib/inspection";
import { listInspections, listTemplates } from "@/lib/inspection-db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 — รายการใบตรวจสอบสาขาที่บันทึกไว้ พร้อมปุ่มเปิดใบใหม่ */
export default async function InspectionListPage({
  searchParams,
}: {
  searchParams: Promise<InspectionParams>;
}) {
  await requirePermission("INSP_ENTRY", "read");
  const params = await searchParams;
  const canWrite = await checkPermission("INSP_ENTRY", "write");

  const [rows, companies, branches, templates] = await Promise.all([
    listInspections(queryFromParams(params)),
    listCompanies(true),
    listBranches(true),
    listTemplates(),
  ]);

  const summary = summarizeInspections(rows);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1. บันทึกตรวจสอบสาขา</h1>
          <p className="text-sm text-slate-500">
            ใบตรวจทั้งหมด {summary.count} ใบ · ส่งผลแล้ว {summary.submitted} · ฉบับร่าง {summary.draft}{" "}
            · ค่าปรับรวม {formatBaht(summary.totalFine)} บาท
          </p>
        </div>

        {canWrite && (
          <Link href="/inspection/inspections/new" className="btn-primary">
            + เปิดใบตรวจใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <InspectionFilters
        params={params}
        companies={companies}
        branches={branches}
        templates={templates}
        resetHref="/inspection/inspections"
      />

      <div className="card">
        <InspectionTable rows={rows} empty="ยังไม่มีใบตรวจ — กด “เปิดใบตรวจใหม่” เพื่อเริ่มตรวจสาขาแรก" />
      </div>
    </main>
  );
}

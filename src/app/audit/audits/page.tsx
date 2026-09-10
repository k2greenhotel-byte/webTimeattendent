import Link from "next/link";
import AuditFilters from "@/components/audit/AuditFilters";
import AuditTable from "@/components/audit/AuditTable";
import { auditQueryFromParams, summarizeAudits, type AudParams } from "@/lib/audit";
import { listAudits } from "@/lib/audit-db";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees } from "@/lib/db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 — รายการใบคุมงานที่บันทึกไว้ พร้อมปุ่มเปิดใบใหม่ */
export default async function AuditListPage({
  searchParams,
}: {
  searchParams: Promise<AudParams>;
}) {
  await requirePermission("AUD_ENTRY", "read");
  const params = await searchParams;
  const canWrite = await checkPermission("AUD_ENTRY", "write");

  const [rows, companies, branches, employees] = await Promise.all([
    listAudits(auditQueryFromParams(params)),
    listCompanies(true),
    listBranches(true),
    listEmployees(true),
  ]);

  const summary = summarizeAudits(rows);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1. บันทึกผลการตรวจสอบประจำวัน</h1>
          <p className="text-sm text-slate-500">
            ใบคุมงาน {summary.count} ใบ · กำลังตรวจ {summary.draft} · ส่งผลแล้ว {summary.submitted} ·
            ตรวจไปแล้ว {summary.checks} รายการ · พบไม่ถูกต้อง {summary.wrong}
          </p>
        </div>

        {canWrite && (
          <Link href="/audit/audits/new" className="btn-primary">
            + เปิดใบคุมงานใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>}

      <AuditFilters
        params={params}
        companies={companies}
        branches={branches}
        auditors={employees}
        resetHref="/audit/audits"
      />

      <div className="card">
        <AuditTable
          rows={rows}
          empty="ยังไม่มีใบคุมงาน — กด “เปิดใบคุมงานใหม่” เพื่อเริ่มงานตรวจของวันนี้"
        />
      </div>
    </main>
  );
}

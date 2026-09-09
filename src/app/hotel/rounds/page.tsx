import Link from "next/link";
import HotelFilters, {
  roundQueryFromParams,
  type HotelParams,
} from "@/components/hotel/HotelFilters";
import RoundTable from "@/components/hotel/RoundTable";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { summarizeRounds } from "@/lib/hotel";
import { listRounds } from "@/lib/hotel-db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 — รายการใบตรวจเช็คประจำวันที่บันทึกไว้ พร้อมปุ่มเปิดใบใหม่ */
export default async function RoundListPage({
  searchParams,
}: {
  searchParams: Promise<HotelParams>;
}) {
  await requirePermission("HTL_ENTRY", "read");
  const params = await searchParams;
  const canWrite = await checkPermission("HTL_ENTRY", "write");

  const [rows, companies, branches] = await Promise.all([
    listRounds(roundQueryFromParams(params)),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const summary = summarizeRounds(rows);
  const todayBranches = new Set(
    rows.filter((r) => r.check_date === today && r.status === "submitted").map((r) => r.branch_id),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1. บันทึกตรวจเช็คประจำวัน</h1>
          <p className="text-sm text-slate-500">
            วันนี้ {formatThaiDate(today)} · ส่งผลแล้ว {todayBranches.size} สาขา · ในเงื่อนไขนี้มี{" "}
            {summary.rounds} ใบ (ฉบับร่าง {summary.draft}) · ค้างแก้ไข {summary.openFixCount} ข้อ
          </p>
        </div>

        {canWrite && (
          <Link href="/hotel/rounds/new" className="btn-primary">
            + เปิดใบตรวจเช็ควันนี้
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <HotelFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/hotel/rounds"
      />

      <div className="card">
        <RoundTable
          rows={rows}
          empty="ยังไม่มีใบตรวจเช็ค — กด “เปิดใบตรวจเช็ควันนี้” เพื่อเริ่มตรวจสาขาแรก"
        />
      </div>
    </main>
  );
}

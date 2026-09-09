import HotelFilters, {
  roundQueryFromParams,
  type HotelParams,
} from "@/components/hotel/HotelFilters";
import RoundTable from "@/components/hotel/RoundTable";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { summarizeRounds } from "@/lib/hotel";
import { listRounds } from "@/lib/hotel-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 3 — สอบถามผลการตรวจเช็คย้อนหลัง
 * เปิดใบจากตารางเพื่อดูผลรายข้อพร้อมรูป และแก้ไขต่อได้ถ้ามีสิทธิ์
 */
export default async function HotelSearchPage({
  searchParams,
}: {
  searchParams: Promise<HotelParams>;
}) {
  await requirePermission("HTL_SEARCH", "read");
  const params = await searchParams;

  const [rows, companies, branches] = await Promise.all([
    listRounds(roundQueryFromParams(params)),
    listCompanies(true),
    listBranches(true),
  ]);

  const summary = summarizeRounds(rows);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">3. สอบถามผลการตรวจเช็ค</h1>
        <p className="text-sm text-slate-500">
          พบ {summary.rounds} ใบ · ส่งผลแล้ว {summary.submitted} · ข้อไม่ปกติรวม {summary.failCount}{" "}
          ข้อ (ค้างแก้ไข {summary.openFixCount})
        </p>
      </div>

      <HotelFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/hotel/search"
      />

      <div className="card">
        <RoundTable rows={rows} empty="ไม่พบใบตรวจเช็คตามเงื่อนไขที่ค้นหา" />
      </div>
    </main>
  );
}

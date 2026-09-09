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
import { listRooms, listRounds } from "@/lib/hotel-db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 2 — รายการใบตรวจเช็คห้องพักรายห้อง */
export default async function RoomRoundListPage({
  searchParams,
}: {
  searchParams: Promise<HotelParams>;
}) {
  await requirePermission("HTL_ROOM", "read");
  const params = await searchParams;
  const canWrite = await checkPermission("HTL_ROOM", "write");

  const query = roundQueryFromParams(params);
  query.scope = "room";

  const [rows, companies, branches, rooms] = await Promise.all([
    listRounds(query),
    listCompanies(true),
    listBranches(true),
    listRooms(query.branch_id ?? null),
  ]);

  const today = workDateOf();
  const summary = summarizeRounds(rows);
  const checkedTodayRoomIds = new Set(
    rows.filter((r) => r.check_date === today && r.status === "submitted").map((r) => r.room_id),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">2. บันทึกตรวจเช็คห้องพัก</h1>
          <p className="text-sm text-slate-500">
            วันนี้ {formatThaiDate(today)} · ตรวจแล้ว {checkedTodayRoomIds.size} จาก {rooms.length}{" "}
            ห้อง · ในเงื่อนไขนี้มี {summary.rounds} ใบ (ฉบับร่าง {summary.draft}) · ค้างแก้ไข{" "}
            {summary.openFixCount} ข้อ
          </p>
        </div>

        {canWrite && (
          <Link href="/hotel/rooms/new" className="btn-primary">
            + เปิดใบตรวจห้องพัก
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
        resetHref="/hotel/rooms"
      />

      <div className="card">
        <RoundTable
          rows={rows}
          showRoom
          empty="ยังไม่มีใบตรวจห้องพัก — กด “เปิดใบตรวจห้องพัก” เพื่อเริ่มตรวจห้องแรก"
        />
      </div>
    </main>
  );
}

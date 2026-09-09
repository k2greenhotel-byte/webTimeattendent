import Link from "next/link";
import { redirect } from "next/navigation";
import HotelCheckForm from "@/components/hotel/HotelCheckForm";
import { getSelectableContext } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { findRoundByRoomDate, getChecklist, listRooms, listRounds } from "@/lib/hotel-db";
import { requirePermission } from "@/lib/session";
import { saveRoundForm } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * เปิดใบตรวจเช็คห้องพักใหม่ — สองขั้น
 *   1. เลือกสาขา วันที่ และห้อง (เติมสาขาให้จากบัญชีที่ล็อกอินอยู่)
 *   2. ประกอบรายการตรวจห้องของสาขานั้นแล้วให้ช่างกดผลทีละข้อ
 *
 * ขั้นที่ 1 แสดงห้องเป็นปุ่มพร้อมสถานะว่าวันนี้ตรวจไปหรือยัง
 * ช่างจะได้ไล่ตรวจทีละห้องจนครบโดยไม่ต้องจำเอง
 */
export default async function NewRoomRoundPage({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    room?: string;
    date?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  const user = await requirePermission("HTL_ROOM", "write");
  const params = await searchParams;

  const { companies, branches } = await getSelectableContext(user.id);
  const today = workDateOf();
  const checkDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // ยังไม่เลือกสาขา → ใช้สาขาของบัญชีที่ล็อกอินอยู่เป็นค่าตั้งต้น
  const branchId =
    params.branch ?? (branches.some((b) => b.id === user.branch_id) ? (user.branch_id ?? "") : "");
  const branch = branches.find((b) => b.id === branchId) ?? null;

  const rooms = branch ? await listRooms(branch.id) : [];
  const room = params.room ? rooms.find((r) => r.id === params.room) : null;

  // เลือกห้องแล้วแต่มีใบของวันนั้นอยู่ก่อน — พาไปแก้ใบเดิม ไม่ให้เปิดใบซ้ำ
  if (room) {
    const existing = await findRoundByRoomDate(room.id, checkDate);
    if (existing) {
      redirect(
        `/hotel/rounds/${existing.id}?msg=${encodeURIComponent(
          `ห้อง ${room.code} มีใบตรวจของ ${formatThaiDate(checkDate)} อยู่แล้ว (${existing.doc_no}) เปิดใบเดิมให้แก้ไขต่อ`,
        )}`,
      );
    }
  }

  const messages = (
    <>
      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}
    </>
  );

  // ---------- ขั้นที่ 1: เลือกสาขา วันที่ และห้อง ----------
  if (!room) {
    // ห้องไหนตรวจไปแล้วในวันนั้น — ใช้ทำป้ายบนปุ่มห้อง
    const doneRounds = branch
      ? await listRounds({ branch_id: branch.id, scope: "room", from: checkDate, to: checkDate })
      : [];
    const doneByRoom = new Map(doneRounds.map((r) => [r.room_id, r]));

    return (
      <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-800">เปิดใบตรวจเช็คห้องพัก</h1>
          <Link href="/hotel/rooms" className="btn-secondary">
            ← กลับรายการ
          </Link>
        </div>

        {messages}

        <form className="card space-y-3" method="get">
          <p className="text-sm text-slate-500">
            ผู้ตรวจเช็ค: <span className="font-medium text-slate-700">{user.full_name}</span>
            {user.company_name ? ` · ${user.company_name}` : ""}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="date">
                วันที่ตรวจเช็ค *
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={checkDate}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="branch">
                สาขา / โรงแรม *
              </label>
              <select id="branch" name="branch" defaultValue={branchId} className="input" required>
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="btn-secondary w-full sm:w-auto">
            แสดงห้องของสาขานี้
          </button>
        </form>

        {branch && (
          <section className="card space-y-3">
            <div>
              <h2 className="font-semibold text-slate-800">
                เลือกห้องที่จะตรวจ — {branch.name}
              </h2>
              <p className="text-sm text-slate-500">
                {formatThaiDate(checkDate)} · ตรวจแล้ว {doneByRoom.size} จาก {rooms.length} ห้อง
              </p>
            </div>

            {rooms.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                สาขานี้ยังไม่มีห้องพักในระบบ — ให้ผู้ดูแลระบบเพิ่มเบอร์ห้องที่หน้า{" "}
                <Link href="/hotel/setup/rooms" className="underline">
                  ตั้งค่าห้องพัก
                </Link>{" "}
                ก่อน
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {rooms.map((r) => {
                  const done = doneByRoom.get(r.id);
                  return (
                    <Link
                      key={r.id}
                      href={
                        done
                          ? `/hotel/rounds/${done.id}`
                          : `/hotel/rooms/new?branch=${branch.id}&room=${r.id}&date=${checkDate}`
                      }
                      className={`rounded-xl border p-3 text-center hover:border-brand-300 ${
                        done ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                      }`}
                    >
                      <p className="text-lg font-bold text-slate-800">{r.code}</p>
                      {r.name && <p className="text-xs text-slate-500">{r.name}</p>}
                      <p
                        className={`mt-1 text-xs ${
                          done ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {done
                          ? done.status === "submitted"
                            ? `ตรวจแล้ว · ไม่ปกติ ${done.fail_count}`
                            : "ฉบับร่าง — ตรวจต่อ"
                          : "ยังไม่ได้ตรวจ"}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    );
  }

  // ---------- ขั้นที่ 2: ลงผลรายข้อของห้องนั้น ----------
  const checklist = await getChecklist(branch!.id, false, "room");
  const company = companies.find((c) => c.id === branch!.company_id) ?? null;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            ตรวจเช็คห้อง {room.code} · {branch!.name}
          </h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(checkDate)} · เลขที่ใบระบบออกให้ตอนกดบันทึก
          </p>
        </div>
        <Link href={`/hotel/rooms/new?branch=${branch!.id}&date=${checkDate}`} className="btn-secondary">
          ← เลือกห้องอื่น
        </Link>
      </div>

      {messages}

      <HotelCheckForm
        checklist={checklist}
        header={{
          check_date: checkDate,
          company_id: company?.id ?? "",
          company_name: company?.name ?? "",
          branch_id: branch!.id,
          branch_name: branch!.name,
          room_id: room.id,
          room_code: room.code,
          room_name: room.name ?? "",
          inspector_name: user.full_name,
          note: "",
        }}
        changeHeaderHref={`/hotel/rooms/new?branch=${branch!.id}&date=${checkDate}`}
        action={saveRoundForm}
      />
    </main>
  );
}

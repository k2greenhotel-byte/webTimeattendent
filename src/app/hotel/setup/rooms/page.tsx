import Link from "next/link";
import { listBranches } from "@/lib/db";
import { listRooms } from "@/lib/hotel-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { addRoomsForm, deleteRoomForm, saveRoomForm } from "../actions";

export const dynamic = "force-dynamic";

const BACK = "/hotel/setup/rooms";

type Params = { branch?: string; msg?: string; err?: string };

/**
 * หน้าจอ 6.2 — ตั้งค่าห้องพัก (อยู่ใต้เมนู "6. ตั้งค่ารายการและห้องพัก")
 *
 * เบอร์ห้องผูกกับสาขา เพราะ V1 มีได้ทุกโรงแรม
 * มีช่องเพิ่มหลายห้องรวดเดียว เพราะตอนเปิดโรงแรมใหม่ต้องใส่ทีละสิบห้อง
 */
export default async function HotelRoomSetupPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requirePermission("HTL_SETUP", "read");
  const params = await searchParams;
  const branchId = params.branch || "";

  const [branches, rooms, canWrite, canDelete] = await Promise.all([
    listBranches(true),
    listRooms(branchId || null, true),
    checkPermission("HTL_SETUP", "write"),
    checkPermission("HTL_SETUP", "delete"),
  ]);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  // จัดกลุ่มตามสาขา เพื่อให้มุมมอง "ทุกสาขา" อ่านออกว่าโรงแรมไหนมีกี่ห้อง
  const byBranch = branches
    .map((b) => ({ branch: b, rooms: rooms.filter((r) => r.branch_id === b.id) }))
    .filter((g) => g.rooms.length > 0 || g.branch.id === branchId);

  const hidden = <input type="hidden" name="branch" value={branchId} />;
  const backField = <input type="hidden" name="back" value={BACK} />;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่าห้องพัก</h1>
          <p className="text-sm text-slate-500">
            เพิ่ม/ลด/แก้เบอร์ห้องของแต่ละสาขาได้เอง — ปิด “ใช้งาน” เพื่อซ่อนห้องออกจากใบตรวจใหม่
            โดยที่ใบเก่ายังอ่านผลได้เหมือนเดิม · ตอนนี้มี {rooms.filter((r) => r.is_active).length}{" "}
            ห้องที่เปิดใช้งาน
          </p>
        </div>
        <Link href="/hotel/setup" className="btn-secondary">
          ← กลับตั้งค่ารายการตรวจ
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {!canWrite && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีนี้ดูค่าที่ตั้งไว้ได้อย่างเดียว การแก้ไขเปิดให้เฉพาะผู้ดูแลระบบและผู้ช่วยผู้ดูแลระบบ
        </p>
      )}

      {/* ---------- เลือกสาขา ---------- */}
      <form method="get" className="card grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="branch">
            ดูห้องพักของสาขา
          </label>
          <select id="branch" name="branch" defaultValue={branchId} className="input">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          แสดง
        </button>
      </form>

      {/* ---------- เพิ่มหลายห้องพร้อมกัน ---------- */}
      {canWrite && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่มห้องพัก</h2>

          <form action={addRoomsForm} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            {hidden}
            {backField}
            <div>
              <label className="label" htmlFor="add_branch">
                สาขา *
              </label>
              <select
                id="add_branch"
                name="branch_id"
                defaultValue={branchId}
                className="input"
                required
              >
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="codes">
                เบอร์ห้อง (พิมพ์หลายห้องได้ คั่นด้วยจุลภาคหรือเว้นวรรค) *
              </label>
              <input
                id="codes"
                name="codes"
                className="input"
                placeholder="V1, V2, V3, 801, 802"
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              เพิ่มห้อง
            </button>
          </form>

          <p className="text-xs text-slate-500">
            ห้องที่มีอยู่แล้วในสาขานั้นจะถูกข้ามให้ กดซ้ำได้โดยไม่เกิดห้องซ้ำ ·
            ตั้งชื่อ/ประเภทห้องเพิ่มทีหลังได้ที่รายการด้านล่าง
          </p>
        </section>
      )}

      {/* ---------- รายการห้องพัก ---------- */}
      {byBranch.length === 0 && (
        <p className="card text-sm text-slate-600">
          {branchId
            ? `${branchName} ยังไม่มีห้องพักในระบบ — เพิ่มเบอร์ห้องด้านบนได้เลย`
            : "ยังไม่มีห้องพักในระบบเลย — เลือกสาขาแล้วเพิ่มเบอร์ห้องด้านบน"}
        </p>
      )}

      {byBranch.map(({ branch, rooms: branchRooms }) => (
        <section key={branch.id} className="space-y-3">
          <h2 className="font-semibold text-slate-800">
            {branch.name}{" "}
            <span className="text-sm font-normal text-slate-400">
              ({branchRooms.length} ห้อง)
            </span>
          </h2>

          {branchRooms.length === 0 && (
            <p className="card text-sm text-slate-600">สาขานี้ยังไม่มีห้องพัก</p>
          )}

          {branchRooms.map((room) => (
            <details key={room.id} className="card">
              <summary className="cursor-pointer">
                <span className="font-medium text-slate-800">ห้อง {room.code}</span>
                {room.name && <span className="ml-2 text-sm text-slate-500">{room.name}</span>}
                {!room.is_active && (
                  <span className="badge ml-2 bg-slate-200 text-slate-600">ปิดใช้งาน</span>
                )}
              </summary>

              <form action={saveRoomForm} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={room.id} />
                {hidden}
                {backField}

                <div>
                  <label className="label">สาขา *</label>
                  <select
                    name="branch_id"
                    defaultValue={room.branch_id}
                    className="input"
                    disabled={!canWrite}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">เบอร์ห้อง *</label>
                  <input
                    name="code"
                    defaultValue={room.code}
                    className="input"
                    disabled={!canWrite}
                    required
                  />
                </div>

                <div>
                  <label className="label">ชื่อ / ประเภทห้อง</label>
                  <input
                    name="name"
                    defaultValue={room.name ?? ""}
                    className="input"
                    placeholder="พูลวิลล่า 2 ห้องนอน"
                    disabled={!canWrite}
                  />
                </div>

                <div>
                  <label className="label">ลำดับการแสดง</label>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={room.sort_order}
                    className="input"
                    disabled={!canWrite}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">หมายเหตุ</label>
                  <input
                    name="note"
                    defaultValue={room.note ?? ""}
                    className="input"
                    disabled={!canWrite}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={room.is_active}
                    className="h-4 w-4"
                    disabled={!canWrite}
                  />
                  เปิดใช้งาน
                </label>

                {canWrite && (
                  <div className="sm:col-span-2">
                    <button type="submit" className="btn-primary">
                      บันทึกห้องพัก
                    </button>
                  </div>
                )}
              </form>

              {canDelete && (
                <form
                  action={deleteRoomForm}
                  className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
                >
                  <input type="hidden" name="id" value={room.id} />
                  {hidden}
                  {backField}
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" name="confirm" className="h-4 w-4" />
                    ยืนยันลบห้องนี้ (ใบตรวจเก่ายังอ่านผลได้เหมือนเดิม)
                  </label>
                  <button type="submit" className="btn-danger">
                    ลบห้อง
                  </button>
                </form>
              )}
            </details>
          ))}
        </section>
      ))}
    </main>
  );
}

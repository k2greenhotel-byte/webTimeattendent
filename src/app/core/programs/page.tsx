import { listMenus, listPrograms } from "@/lib/core-db";
import { MENU_KIND_LABEL, type MenuKind } from "@/lib/core-types";
import {
  createMenuForm,
  createProgramForm,
  deleteMenuForm,
  deleteProgramForm,
  updateMenuForm,
  updateProgramForm,
} from "./actions";

export const dynamic = "force-dynamic";

const KINDS: MenuKind[] = ["entry", "inquiry", "report", "dashboard", "setting"];

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const [programs, menus] = await Promise.all([listPrograms(), listMenus()]);

  const kindOptions = KINDS.map((k) => (
    <option key={k} value={k}>
      {MENU_KIND_LABEL[k]}
    </option>
  ));

  const programOptions = programs.map((p) => (
    <option key={p.id} value={p.id}>
      {p.code} · {p.name}
    </option>
  ));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ทะเบียนโปรแกรมในองค์กร</h1>
        <p className="text-sm text-slate-500">
          รหัสโปรแกรม ชื่อโปรแกรม สถานะ และเมนู/หน้าจอของแต่ละโปรแกรม —
          เมนูที่เพิ่มตรงนี้จะไปปรากฏในหน้ากำหนดสิทธิ์ทันที
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={createProgramForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มโปรแกรมใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-6">
          <div>
            <label className="label">รหัสโปรแกรม *</label>
            <input name="code" className="input" placeholder="POS" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อโปรแกรม *</label>
            <input name="name" className="input" placeholder="ระบบขายหน้าร้าน" required />
          </div>
          <div>
            <label className="label">เส้นทางหลัก</label>
            <input name="path" className="input" placeholder="/pos" />
          </div>
          <div>
            <label className="label">ไอคอน</label>
            <input name="icon" className="input" placeholder="🧾" maxLength={4} />
          </div>
          <div>
            <label className="label">ลำดับ</label>
            <input name="sort_order" type="number" className="input" defaultValue={0} />
          </div>
          <div className="sm:col-span-6">
            <label className="label">คำอธิบาย</label>
            <input name="description" className="input" />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          เพิ่มโปรแกรม
        </button>
      </form>

      <section className="space-y-4">
        {programs.map((p) => {
          const own = menus.filter((m) => m.program_id === p.id);

          return (
            <div key={p.id} className="card space-y-3">
              <form action={updateProgramForm} className="grid items-end gap-3 sm:grid-cols-6">
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label className="label">รหัสโปรแกรม</label>
                  <input name="code" defaultValue={p.code} className="input" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">ชื่อโปรแกรม</label>
                  <input name="name" defaultValue={p.name} className="input" required />
                </div>
                <div>
                  <label className="label">เส้นทางหลัก</label>
                  <input name="path" defaultValue={p.path ?? ""} className="input" />
                </div>
                <div>
                  <label className="label">ไอคอน</label>
                  <input name="icon" defaultValue={p.icon ?? ""} className="input" maxLength={4} />
                </div>
                <div>
                  <label className="label">ลำดับ</label>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={p.sort_order}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="label">คำอธิบาย</label>
                  <input name="description" defaultValue={p.description ?? ""} className="input" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                  <input type="checkbox" name="is_active" defaultChecked={p.is_active} />
                  สถานะ: เปิดใช้งาน
                </label>
                <button type="submit" className="btn-secondary">
                  บันทึกโปรแกรม
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="table-report">
                  <thead>
                    <tr>
                      <th className="text-left">เมนู/หน้าจอ ({own.length})</th>
                      <th>รหัสเมนู</th>
                      <th>ประเภท</th>
                      <th>เส้นทาง</th>
                      <th>ลำดับ</th>
                      <th>เปิดใช้</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {own.map((m) => (
                      <tr key={m.id}>
                        <td colSpan={7} className="p-0 text-left">
                          <div className="flex flex-wrap items-end gap-2 p-2">
                            <form action={updateMenuForm} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={m.id} />
                              <input type="hidden" name="program_id" value={p.id} />
                              <input
                                name="name"
                                defaultValue={m.name}
                                className="input w-52"
                                required
                              />
                              <input
                                name="code"
                                defaultValue={m.code}
                                className="input w-40"
                                required
                              />
                              <select name="kind" defaultValue={m.kind} className="input w-36">
                                {kindOptions}
                              </select>
                              <input
                                name="path"
                                defaultValue={m.path ?? ""}
                                className="input w-52"
                                placeholder="/path"
                              />
                              <input
                                name="sort_order"
                                type="number"
                                defaultValue={m.sort_order}
                                className="input w-20"
                              />
                              <label className="flex items-center gap-1 pb-2 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  name="is_active"
                                  defaultChecked={m.is_active}
                                />
                                เปิดใช้
                              </label>
                              <button type="submit" className="btn-secondary py-1.5 text-xs">
                                บันทึก
                              </button>
                            </form>

                            <form action={deleteMenuForm} className="flex items-center gap-1 pb-2">
                              <input type="hidden" name="id" value={m.id} />
                              <label className="flex items-center gap-1 text-xs text-slate-400">
                                <input type="checkbox" name="confirm" />
                                ยืนยัน
                              </label>
                              <button type="submit" className="text-xs text-rose-600 hover:underline">
                                ลบเมนู
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form action={createMenuForm} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="program_id" value={p.id} />
                <div>
                  <label className="label">ชื่อเมนูใหม่</label>
                  <input name="name" className="input w-52" placeholder="บันทึกใบเสร็จ" required />
                </div>
                <div>
                  <label className="label">รหัสเมนู</label>
                  <input name="code" className="input w-40" placeholder="POS_RECEIPT" required />
                </div>
                <div>
                  <label className="label">ประเภท</label>
                  <select name="kind" defaultValue="entry" className="input w-36">
                    {kindOptions}
                  </select>
                </div>
                <div>
                  <label className="label">เส้นทาง</label>
                  <input name="path" className="input w-52" placeholder="/pos/receipts" />
                </div>
                <div>
                  <label className="label">ลำดับ</label>
                  <input name="sort_order" type="number" className="input w-20" defaultValue={0} />
                </div>
                <button type="submit" className="btn-primary py-2 text-sm">
                  เพิ่มเมนู
                </button>
              </form>

              <form
                action={deleteProgramForm}
                className="flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-2"
              >
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบโปรแกรมนี้
                </button>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="force" />
                  ยืนยันลบทั้งเมนู {own.length} เมนูและสิทธิ์ที่ผูกอยู่ทั้งหมด
                </label>
              </form>
            </div>
          );
        })}
      </section>

      <form action={createMenuForm} className="card flex flex-wrap items-end gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">เพิ่มเมนูให้โปรแกรมใดก็ได้</h2>
          <p className="text-sm text-slate-500">ใช้เมื่ออยากเพิ่มเมนูโดยไม่ต้องเลื่อนหาโปรแกรม</p>
        </div>
        <div>
          <label className="label">โปรแกรม</label>
          <select name="program_id" className="input w-52" required>
            {programOptions}
          </select>
        </div>
        <div>
          <label className="label">ชื่อเมนู</label>
          <input name="name" className="input w-52" required />
        </div>
        <div>
          <label className="label">รหัสเมนู</label>
          <input name="code" className="input w-40" required />
        </div>
        <div>
          <label className="label">ประเภท</label>
          <select name="kind" defaultValue="entry" className="input w-36">
            {kindOptions}
          </select>
        </div>
        <div>
          <label className="label">เส้นทาง</label>
          <input name="path" className="input w-52" />
        </div>
        <button type="submit" className="btn-primary py-2 text-sm">
          เพิ่มเมนู
        </button>
      </form>
    </main>
  );
}

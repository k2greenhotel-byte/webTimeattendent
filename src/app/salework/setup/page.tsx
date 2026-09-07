import Link from "next/link";
import { deleteTaskTypeForm, saveTaskTypeForm } from "@/app/salework/setup/actions";
import { groupTaskTypes } from "@/lib/salework";
import { countTaskUsage, listTaskTypes } from "@/lib/salework-db";
import type { TaskType } from "@/lib/salework-types";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const PATH = "/salework/setup";

/** ป้ายบอกเงื่อนไขของแต่ละงาน — อ่านแล้วรู้ทันทีว่าฟอร์มบันทึกจะบังคับอะไร */
function badges(t: TaskType): string[] {
  const out: string[] = [];
  if (t.metric_label) out.push(`${t.metric_label}${t.metric_unit ? ` (${t.metric_unit})` : ""}`);
  if (t.require_metric) out.push("บังคับกรอกตัวเลข");
  if (t.require_media) out.push("บังคับแนบรูป/คลิป");
  if (t.allow_link) out.push("มีช่องลิงก์");
  if (t.daily_target !== null) out.push(`เป้าวันละ ${t.daily_target}`);
  return out;
}

/** หน้าจอ 4 — แอดมินตั้งค่าว่ามีประเภทงานอะไรบ้าง และแต่ละงานให้กรอกอะไร */
export default async function SaleWorkSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; parent?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  await requirePermission("SW_SETUP", "read");

  const [types, canWrite, canEdit, canDelete] = await Promise.all([
    listTaskTypes(false),
    checkPermission("SW_SETUP", "write"),
    checkPermission("SW_SETUP", "edit"),
    checkPermission("SW_SETUP", "delete"),
  ]);

  const groups = groupTaskTypes(types);
  const heads = types.filter((t) => !t.parent_id);
  const editing = params.edit ? (types.find((t) => t.id === params.edit) ?? null) : null;
  const usage = new Map(
    await Promise.all(types.map(async (t) => [t.id, await countTaskUsage(t.id)] as const)),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">4. ตั้งค่าประเภทงาน</h1>
        <p className="text-sm text-slate-500">
          กำหนดว่าพนักงานขายต้องทำงานอะไรบ้างในแต่ละวัน และแต่ละงานให้กรอกตัวเลขอะไร ต้องแนบรูป/คลิปไหม
          — ที่ตั้งไว้ที่นี่จะไปโผล่ในหน้าจอบันทึกงานประจำวันทันที
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {!canWrite && !canEdit && (
        <p className="card text-sm text-slate-600">
          บัญชีนี้เปิดดูได้อย่างเดียว ไม่มีสิทธิ์แก้ไขประเภทงาน
        </p>
      )}

      <section className="space-y-3">
        {groups.map((group) => (
          <div key={group.head.id} className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800">
                  {group.head.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">{group.head.code}</span>
                  {!group.head.is_active && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      ปิดใช้งาน
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {group.children.length > 0
                    ? `หัวข้อรวม ${group.children.length} งานย่อย`
                    : badges(group.head).join(" · ") || "ไม่มีเงื่อนไขพิเศษ"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canEdit && (
                  <Link href={`${PATH}?edit=${group.head.id}`} className="btn-secondary">
                    แก้ไข
                  </Link>
                )}
                {canWrite && (
                  <Link href={`${PATH}?parent=${group.head.id}`} className="btn-secondary">
                    + งานย่อย
                  </Link>
                )}
              </div>
            </div>

            {group.children.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                {group.children.map((child) => (
                  <li key={child.id} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-0 grow">
                      <p className="text-sm font-medium text-slate-800">
                        {child.name}
                        <span className="ml-2 text-xs font-normal text-slate-400">{child.code}</span>
                        {!child.is_active && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            ปิดใช้งาน
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {badges(child).join(" · ") || "ไม่มีเงื่อนไขพิเศษ"}
                        {usage.get(child.id) ? ` · ใช้ในใบงานแล้ว ${usage.get(child.id)} บรรทัด` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <Link href={`${PATH}?edit=${child.id}`} className="btn-secondary">
                        แก้ไข
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {(canWrite || canEdit) && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">
            {editing ? `แก้ไขประเภทงาน ${editing.code}` : "เพิ่มประเภทงานใหม่"}
          </h2>

          <form action={saveTaskTypeForm} className="grid gap-3 sm:grid-cols-2">
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div>
              <label className="label" htmlFor="parent_id">
                อยู่ใต้หัวข้อ
              </label>
              <select
                id="parent_id"
                name="parent_id"
                defaultValue={editing?.parent_id ?? params.parent ?? ""}
                className="input w-full"
              >
                <option value="">— เป็นหัวข้อหลัก/งานเดี่ยว —</option>
                {heads
                  .filter((h) => h.id !== editing?.id)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                เช่น &quot;การโพสต์ Facebook&quot; อยู่ใต้ &quot;งานการตลาดออนไลน์&quot;
              </p>
            </div>

            <div>
              <label className="label" htmlFor="code">
                รหัส *
              </label>
              <input
                id="code"
                name="code"
                required
                maxLength={20}
                defaultValue={editing?.code ?? ""}
                placeholder="SW06"
                className="input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                ชื่องาน *
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={editing?.name ?? ""}
                placeholder="เช่น งานแจกใบปลิว"
                className="input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">
                คำอธิบาย (แสดงใต้ชื่องานในหน้าบันทึก)
              </label>
              <input
                id="description"
                name="description"
                defaultValue={editing?.description ?? ""}
                className="input w-full"
              />
            </div>

            <div>
              <label className="label" htmlFor="metric_label">
                ชื่อช่องตัวเลขที่ให้กรอก
              </label>
              <input
                id="metric_label"
                name="metric_label"
                defaultValue={editing?.metric_label ?? ""}
                placeholder="เช่น จำนวนใบปลิวที่แจก"
                className="input w-full"
              />
              <p className="mt-1 text-xs text-slate-500">เว้นว่าง = งานนี้ไม่ต้องกรอกตัวเลข</p>
            </div>

            <div>
              <label className="label" htmlFor="metric_unit">
                หน่วย
              </label>
              <input
                id="metric_unit"
                name="metric_unit"
                defaultValue={editing?.metric_unit ?? ""}
                placeholder="ใบ / คน / แชต / ราย"
                className="input w-full"
              />
            </div>

            <div>
              <label className="label" htmlFor="daily_target">
                เป้าหมายต่อวัน
              </label>
              <input
                id="daily_target"
                name="daily_target"
                type="number"
                min={0}
                step="1"
                defaultValue={editing?.daily_target ?? ""}
                className="input w-full"
              />
            </div>

            <div>
              <label className="label" htmlFor="sort_order">
                ลำดับการแสดงผล
              </label>
              <input
                id="sort_order"
                name="sort_order"
                type="number"
                min={0}
                step="1"
                defaultValue={editing?.sort_order ?? 100}
                className="input w-full"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="require_metric"
                  defaultChecked={editing?.require_metric ?? false}
                  className="h-4 w-4 rounded border-slate-300"
                />
                ติ๊กว่าทำแล้วต้องกรอกตัวเลขมากกว่า 0
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="require_media"
                  defaultChecked={editing?.require_media ?? false}
                  className="h-4 w-4 rounded border-slate-300"
                />
                ติ๊กว่าทำแล้วต้องแนบรูปหรือคลิปอย่างน้อย 1 ไฟล์
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="allow_link"
                  defaultChecked={editing?.allow_link ?? false}
                  className="h-4 w-4 rounded border-slate-300"
                />
                มีช่องให้วางลิงก์โพสต์/คลิป (ใช้กับงานการตลาดออนไลน์)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={editing?.is_active ?? true}
                  className="h-4 w-4 rounded border-slate-300"
                />
                เปิดใช้งาน (ปิดแล้วจะไม่ขึ้นในใบงานใหม่ แต่ใบเก่ายังอ่านได้)
              </label>
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="btn-primary">
                {editing ? "บันทึกการแก้ไข" : "เพิ่มประเภทงาน"}
              </button>
              {editing && (
                <Link href={PATH} className="btn-secondary">
                  ยกเลิก
                </Link>
              )}
            </div>
          </form>

          {editing && canDelete && (
            <form action={deleteTaskTypeForm} className="border-t border-slate-100 pt-3">
              <input type="hidden" name="id" value={editing.id} />
              <p className="mb-2 text-sm text-slate-600">
                ประเภทงานนี้ถูกใช้ในใบงานแล้ว {usage.get(editing.id) ?? 0} บรรทัด — ถ้าเคยถูกใช้
                ระบบจะไม่ให้ลบ ให้ปิดใช้งานแทนเพื่อไม่ให้ใบเก่าเสียหาย
              </p>
              <button type="submit" className="btn-danger">
                ลบประเภทงานนี้
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

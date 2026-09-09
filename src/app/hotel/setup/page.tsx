import Link from "next/link";
import { listBranches } from "@/lib/db";
import { getChecklist } from "@/lib/hotel-db";
import {
  HTL_PRIORITY_LABEL,
  HTL_PRIORITY_ORDER,
  HTL_SCOPE_LABEL,
  HTL_SCOPE_ORDER,
  HTL_SCOPE_SHORT,
  type HtlGroup,
  type HtlItem,
  type HtlScope,
} from "@/lib/hotel-types";
import { checkPermission, requirePermission } from "@/lib/session";
import type { Branch } from "@/lib/types";
import {
  copyItemsForm,
  deleteGroupForm,
  deleteItemForm,
  saveGroupForm,
  saveItemForm,
} from "./actions";

export const dynamic = "force-dynamic";

type Params = { scope?: string; branch?: string; tab?: string; msg?: string; err?: string };

/**
 * หน้าจอ 6 — ตั้งค่ารายการที่ตรวจเช็ค
 *
 * โครงเป็น 2 ชั้น: ประเภทงาน → รายการตรวจ และแยกเป็น 2 มิติ
 *   ขอบเขตงาน  ตรวจอาคาร / ตรวจห้องพัก — คนละชุดรายการกัน
 *   สาขา       แต่ละสาขาตรวจไม่เหมือนกัน จึงตั้งรายการเฉพาะสาขาได้
 *              รายการที่ไม่ผูกสาขา (ทุกสาขา) ใช้ร่วมกันทุกที่
 *
 * เลือกสาขาแล้วหน้านี้จะแสดง "สิ่งที่สาขานั้นตรวจจริง" = รายการกลาง + รายการเฉพาะสาขานั้น
 * ตรงกับที่ช่างจะเห็นตอนเปิดใบตรวจ จึงตรวจทานได้ทันทีว่าตั้งครบหรือยัง
 */
export default async function HotelSetupPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requirePermission("HTL_SETUP", "read");
  const params = await searchParams;

  const scope: HtlScope = (HTL_SCOPE_ORDER as string[]).includes(params.scope ?? "")
    ? (params.scope as HtlScope)
    : "building";
  const branchId = params.branch || "";

  const [branches, canWrite, canDelete] = await Promise.all([
    listBranches(true),
    checkPermission("HTL_SETUP", "write"),
    checkPermission("HTL_SETUP", "delete"),
  ]);

  // includeInactive = true เพื่อให้เห็นของที่ปิดใช้งานและหมวดว่างด้วย
  const all = await getChecklist(branchId || null, true, scope);

  /**
   * เลือกสาขาแล้ว = แสดงสิ่งที่สาขานั้นเห็นจริงตอนเปิดใบตรวจ (รายการกลาง + รายการของสาขานั้น)
   * ยังไม่เลือกสาขา = แสดงเฉพาะรายการกลางที่ทุกสาขาใช้ร่วมกัน
   * (ไม่เอารายการของสาขาอื่นมาปนในมุมมองนี้ ไม่งั้นจะอ่านไม่ออกว่าสาขาไหนตรวจอะไร)
   */
  const groups = all.groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => (branchId ? !i.branch_id || i.branch_id === branchId : !i.branch_id)),
  }));

  const active = groups.find((g) => g.code === params.tab) ?? groups[0] ?? null;
  const activeCount = groups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.is_active).length,
    0,
  );

  /** ลิงก์เปลี่ยนมุมมอง โดยคงค่าอื่นไว้ */
  function viewHref(next: Partial<{ scope: string; branch: string; tab: string }>): string {
    const q = new URLSearchParams();
    const merged = { scope, branch: branchId, tab: active?.code ?? "", ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value) q.set(key, String(value));
    }
    return `/hotel/setup?${q}`;
  }

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
  const hidden = { scope, branch: branchId, tab: active?.code ?? "" };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">6. ตั้งค่ารายการและห้องพัก</h1>
          <p className="text-sm text-slate-500">
            ตั้งรายการที่ต้องตรวจแยกได้ทั้งตามขอบเขตงานและตามสาขา — ปิด “ใช้งาน”
            เพื่อซ่อนออกจากใบตรวจใหม่ โดยที่ใบเก่ายังอ่านผลได้เหมือนเดิม
          </p>
        </div>
        <Link href="/hotel/setup/rooms" className="btn-secondary">
          ตั้งค่าห้องพัก →
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

      {/* ---------- เลือกมุมมอง: ขอบเขตงาน + สาขา ---------- */}
      <section className="card space-y-3">
        <div>
          <p className="label">ขอบเขตงานที่ตั้งค่า</p>
          <div className="flex flex-wrap gap-2">
            {HTL_SCOPE_ORDER.map((s) => (
              <Link
                key={s}
                href={viewHref({ scope: s, tab: "" })}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  s === scope
                    ? "bg-brand-600 font-medium text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {HTL_SCOPE_LABEL[s]}
              </Link>
            ))}
          </div>
        </div>

        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="scope" value={scope} />
          <div>
            <label className="label" htmlFor="branch">
              ดูรายการของสาขา
            </label>
            <select id="branch" name="branch" defaultValue={branchId} className="input">
              <option value="">ทุกสาขา (เฉพาะรายการกลาง)</option>
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

        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {branchId ? (
            <>
              กำลังดูสิ่งที่ <span className="font-medium text-slate-800">{branchName}</span>{" "}
              ตรวจจริงในงาน{HTL_SCOPE_SHORT[scope]} — รวมรายการกลางที่ทุกสาขาใช้ร่วมกัน ({activeCount}{" "}
              รายการที่เปิดใช้งาน) · รายการที่เพิ่มใหม่จากหน้านี้จะเป็นของสาขานี้เท่านั้น
            </>
          ) : (
            <>
              กำลังดูเฉพาะ <span className="font-medium text-slate-800">รายการกลาง</span>{" "}
              ที่ทุกสาขาใช้ร่วมกันในงาน{HTL_SCOPE_SHORT[scope]} ({activeCount} รายการที่เปิดใช้งาน) ·
              เลือกสาขาด้านบนเพื่อตั้งรายการเฉพาะของสาขานั้น
            </>
          )}
        </p>
      </section>

      {/* ---------- คัดลอกชุดรายการไปสาขาอื่น ---------- */}
      {canWrite && branches.length > 1 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-800">
            คัดลอกชุดรายการนี้ไปสาขาอื่น
          </summary>
          <form action={copyItemsForm} className="mt-3 space-y-3">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="branch" value={branchId} />
            <input type="hidden" name="tab" value={active?.code ?? ""} />
            <input type="hidden" name="source_branch_id" value={branchId} />

            <p className="text-sm text-slate-600">
              คัดลอกรายการงาน{HTL_SCOPE_SHORT[scope]}ของ{" "}
              <span className="font-medium text-slate-800">
                {branchId ? branchName : "รายการกลาง (ทุกสาขา)"}
              </span>{" "}
              ไปเป็นรายการเฉพาะของสาขาที่เลือก แล้วค่อยไปลบข้อที่สาขานั้นไม่ได้ตรวจทีหลัง —
              ข้อที่ปลายทางมีชื่อซ้ำอยู่แล้วจะถูกข้ามให้
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {branches
                .filter((b) => b.id !== branchId)
                .map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="target_branch_ids"
                      value={b.id}
                      className="h-4 w-4"
                    />
                    {b.name}
                  </label>
                ))}
            </div>

            <button type="submit" className="btn-primary">
              คัดลอกไปสาขาที่เลือก
            </button>
          </form>
        </details>
      )}

      {/* ---------- แถบเลือกประเภทงาน ---------- */}
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={viewHref({ tab: g.code })}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active?.id === g.id
                ? "bg-brand-600 font-medium text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {g.name} ({g.items.length})
            {!g.is_active && " · ปิดใช้งาน"}
          </Link>
        ))}
      </div>

      {/* ---------- เพิ่มประเภทงานใหม่ ---------- */}
      {canWrite && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-800">
            + เพิ่มประเภทงานใหม่ (งาน{HTL_SCOPE_SHORT[scope]})
          </summary>
          <form action={saveGroupForm} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Hidden values={hidden} />
            <div>
              <label className="label">รหัสประเภทงาน *</label>
              <input name="code" className="input" placeholder="HG-AIR" required />
            </div>
            <div>
              <label className="label">ชื่อประเภทงาน *</label>
              <input name="name" className="input" placeholder="ระบบปรับอากาศ" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">คำอธิบาย</label>
              <input name="note" className="input" placeholder="แอร์ห้องพัก แอร์ส่วนกลาง" />
            </div>
            <div>
              <label className="label">ลำดับการแสดง</label>
              <input name="sort_order" type="number" className="input" placeholder="70" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
              เปิดใช้งาน
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">
                เพิ่มประเภทงาน
              </button>
            </div>
          </form>
        </details>
      )}

      {!active && (
        <p className="card text-sm text-slate-600">
          งาน{HTL_SCOPE_SHORT[scope]}ยังไม่มีประเภทงานเลย — เพิ่มประเภทงานแรกก่อน
          แล้วจึงเพิ่มรายการตรวจในประเภทงานนั้น
        </p>
      )}

      {active && (
        <>
          {/* ---------- แก้ไขประเภทงานที่เปิดอยู่ ---------- */}
          <section className="card space-y-3">
            <h2 className="font-semibold text-slate-800">แก้ไขประเภทงาน: {active.name}</h2>

            <form action={saveGroupForm} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={active.id} />
              <Hidden values={hidden} />
              <div>
                <label className="label">รหัสประเภทงาน *</label>
                <input
                  name="code"
                  defaultValue={active.code}
                  className="input"
                  disabled={!canWrite}
                  required
                />
              </div>
              <div>
                <label className="label">ชื่อประเภทงาน *</label>
                <input
                  name="name"
                  defaultValue={active.name}
                  className="input"
                  disabled={!canWrite}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">คำอธิบาย</label>
                <input
                  name="note"
                  defaultValue={active.note ?? ""}
                  className="input"
                  disabled={!canWrite}
                />
              </div>
              <div>
                <label className="label">ลำดับการแสดง</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={active.sort_order}
                  className="input"
                  disabled={!canWrite}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={active.is_active}
                  className="h-4 w-4"
                  disabled={!canWrite}
                />
                เปิดใช้งาน
              </label>

              {canWrite && (
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary">
                    บันทึกประเภทงาน
                  </button>
                </div>
              )}
            </form>

            {canDelete && (
              <form
                action={deleteGroupForm}
                className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
              >
                <input type="hidden" name="id" value={active.id} />
                <Hidden values={hidden} />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" name="confirm" className="h-4 w-4" />
                  ยืนยันลบประเภทงานนี้ พร้อมรายการตรวจทุกสาขาที่อยู่ข้างใน
                </label>
                <button type="submit" className="btn-danger">
                  ลบประเภทงาน
                </button>
              </form>
            )}
          </section>

          {/* ---------- เพิ่มรายการตรวจใหม่ ---------- */}
          {canWrite && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-slate-800">
                + เพิ่มรายการตรวจใน “{active.name}”
                {branchId ? ` (เฉพาะ ${branchName})` : " (ใช้ทุกสาขา)"}
              </summary>
              <ItemFields
                group={active}
                groups={groups}
                branches={branches}
                canWrite={canWrite}
                hidden={hidden}
                defaultBranchId={branchId}
                submitLabel="เพิ่มรายการตรวจ"
              />
            </details>
          )}

          {/* ---------- รายการตรวจในประเภทงานนี้ ---------- */}
          <section className="space-y-3">
            <h2 className="font-semibold text-slate-800">
              รายการตรวจใน “{active.name}” ({active.items.length} รายการ)
            </h2>

            {active.items.length === 0 && (
              <p className="card text-sm text-slate-600">
                ประเภทงานนี้ยังไม่มีรายการตรวจ{branchId ? `สำหรับ ${branchName}` : ""} — กด
                “เพิ่มรายการตรวจ” ด้านบน
              </p>
            )}

            {active.items.map((item) => (
              <details key={item.id} className="card">
                <summary className="cursor-pointer">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{item.code}</span>
                  {!item.is_active && (
                    <span className="badge ml-2 bg-slate-200 text-slate-600">ปิดใช้งาน</span>
                  )}
                  {item.branch_id ? (
                    <span className="badge ml-2 bg-sky-100 text-sky-700">
                      เฉพาะ{" "}
                      {branches.find((b) => b.id === item.branch_id)?.name ?? "สาขาที่ถูกลบไปแล้ว"}
                    </span>
                  ) : (
                    <span className="badge ml-2 bg-slate-100 text-slate-500">ใช้ทุกสาขา</span>
                  )}
                </summary>

                <ItemFields
                  item={item}
                  group={active}
                  groups={groups}
                  branches={branches}
                  canWrite={canWrite}
                  hidden={hidden}
                  submitLabel="บันทึกรายการตรวจ"
                />

                {canDelete && (
                  <form
                    action={deleteItemForm}
                    className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Hidden values={hidden} />
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" name="confirm" className="h-4 w-4" />
                      ยืนยันลบรายการนี้ (ใบตรวจเก่ายังอ่านผลได้เหมือนเดิม)
                    </label>
                    <button type="submit" className="btn-danger">
                      ลบรายการ
                    </button>
                  </form>
                )}
              </details>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

/** ค่าที่ต้องส่งกลับไปทุกฟอร์ม เพื่อให้กลับมาที่มุมมองเดิมหลังบันทึก */
function Hidden({ values }: { values: { scope: string; branch: string; tab: string } }) {
  return (
    <>
      <input type="hidden" name="scope" value={values.scope} />
      <input type="hidden" name="branch" value={values.branch} />
      <input type="hidden" name="tab" value={values.tab} />
    </>
  );
}

/** ช่องกรอกของรายการตรวจ ใช้ร่วมกันทั้งตอนเพิ่มใหม่และตอนแก้ไข */
function ItemFields({
  item,
  group,
  groups,
  branches,
  canWrite,
  hidden,
  defaultBranchId = "",
  submitLabel,
}: {
  item?: HtlItem;
  group: HtlGroup;
  groups: HtlGroup[];
  branches: Branch[];
  canWrite: boolean;
  hidden: { scope: string; branch: string; tab: string };
  defaultBranchId?: string;
  submitLabel: string;
}) {
  return (
    <form action={saveItemForm} className="mt-3 grid gap-3 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <Hidden values={hidden} />

      <div>
        <label className="label">รหัสรายการ *</label>
        <input
          name="code"
          defaultValue={item?.code ?? ""}
          className="input"
          placeholder="HC-19"
          disabled={!canWrite}
          required
        />
      </div>
      <div>
        <label className="label">ชื่อรายการที่ต้องตรวจ *</label>
        <input
          name="name"
          defaultValue={item?.name ?? ""}
          className="input"
          placeholder="เช่น ตรวจเช็คระบบปั๊มน้ำ"
          disabled={!canWrite}
          required
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label">คำอธิบาย / วิธีตรวจ</label>
        <input
          name="note"
          defaultValue={item?.note ?? ""}
          className="input"
          placeholder="สิ่งที่ต้องดูตอนตรวจ เช่น ฟังเสียง ดูแรงดัน"
          disabled={!canWrite}
        />
      </div>

      <div>
        <label className="label">ประเภทงาน</label>
        <select
          name="group_id"
          defaultValue={item?.group_id ?? group.id}
          className="input"
          disabled={!canWrite}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">ใช้กับสาขา</label>
        <select
          name="branch_id"
          defaultValue={item?.branch_id ?? defaultBranchId}
          className="input"
          disabled={!canWrite}
        >
          <option value="">ทุกสาขา (รายการกลาง)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              เฉพาะสาขา {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">ความเร่งด่วนตั้งต้นเมื่อไม่ปกติ</label>
        <select
          name="default_priority"
          defaultValue={item?.default_priority ?? "soon"}
          className="input"
          disabled={!canWrite}
        >
          {HTL_PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {HTL_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">ลำดับการแสดง</label>
        <input
          name="sort_order"
          type="number"
          defaultValue={item?.sort_order ?? 100}
          className="input"
          disabled={!canWrite}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="require_photo"
          defaultChecked={item?.require_photo ?? false}
          className="h-4 w-4"
          disabled={!canWrite}
        />
        บังคับแนบรูปทุกครั้งที่ตรวจ
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="require_photo_on_fail"
          defaultChecked={item?.require_photo_on_fail ?? true}
          className="h-4 w-4"
          disabled={!canWrite}
        />
        บังคับแนบรูปเมื่อผลไม่ปกติ
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={item?.is_active ?? true}
          className="h-4 w-4"
          disabled={!canWrite}
        />
        เปิดใช้งาน
      </label>

      {canWrite && (
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary">
            {submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

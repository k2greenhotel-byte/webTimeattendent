import Link from "next/link";
import { redirect } from "next/navigation";
import { filterOptions, masterTitle, parentNameOf, specOfSlug } from "@/lib/moto";
import { listMaster, listParentOptions } from "@/lib/moto-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { createMasterForm, deleteMasterForm, updateMasterForm } from "./actions";

export const dynamic = "force-dynamic";

/** หน้าจอจัดการข้อมูลหลักหนึ่งชุด — ใช้โครงเดียวกันทั้ง 10 ชุด ต่างกันที่นิยามใน MOTO_MASTERS */
export default async function MotoMasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; msg?: string; err?: string }>;
}) {
  const { slug } = await params;
  const spec = specOfSlug(slug);
  if (!spec) {
    redirect(`/moto?err=${encodeURIComponent("ไม่พบหน้าข้อมูลหลักที่ต้องการ")}`);
  }

  await requirePermission(spec.menuCode, "read");
  const query = await searchParams;
  const keyword = query.q?.trim() ?? "";

  const [canWrite, canEdit, canDelete, allRows, parents] = await Promise.all([
    checkPermission(spec.menuCode, "write"),
    checkPermission(spec.menuCode, "edit"),
    checkPermission(spec.menuCode, "delete"),
    listMaster(spec.kind, { includeInactive: true }),
    listParentOptions(spec),
  ]);

  const rows = filterOptions(allRows, keyword);
  const activeCount = allRows.filter((r) => r.is_active).length;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-800">{masterTitle(spec)}</h1>
          <p className="text-sm text-slate-500">{spec.description}</p>
        </div>
        <Link href="/moto" className="btn-secondary">
          ← กลับหน้ารวม
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canWrite ? (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่ม{spec.title}ใหม่</h2>
          <form
            action={createMasterForm}
            className={`grid gap-3 ${
              spec.parent ? "sm:grid-cols-[10rem_1fr_14rem_auto]" : "sm:grid-cols-[10rem_1fr_auto]"
            }`}
          >
            <input type="hidden" name="kind" value={spec.kind} />
            <div>
              <label className="label">{spec.codeLabel} *</label>
              <input
                name="code"
                className="input"
                placeholder={spec.codePlaceholder}
                maxLength={20}
                required
              />
            </div>
            <div>
              <label className="label">{spec.nameLabel} *</label>
              <input
                name="name"
                className="input"
                placeholder={spec.namePlaceholder}
                maxLength={120}
                required
              />
            </div>
            {spec.parent && (
              <div>
                <label className="label">{spec.parent.label}</label>
                <select name="parent_id" defaultValue="" className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่ม
              </button>
            </div>
          </form>
          {spec.parent && parents.length === 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ยังไม่มีข้อมูล{spec.parent.label} — เพิ่ม{spec.parent.label}ก่อนจะเลือกได้ที่นี่
              (บันทึกโดยไม่เลือกก็ได้ แล้วค่อยกลับมาแก้ทีหลัง)
            </p>
          )}
        </section>
      ) : (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่มีสิทธิ์เพิ่มหรือแก้ไข{spec.title}
        </p>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-semibold text-slate-800">
            รายการทั้งหมด{" "}
            <span className="text-sm font-normal text-slate-400">
              ({allRows.length} รายการ · เปิดใช้งาน {activeCount})
            </span>
          </h2>
          <form className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={keyword}
              className="input w-56"
              placeholder="ค้นหารหัสหรือชื่อ"
            />
            <button type="submit" className="btn-secondary">
              ค้นหา
            </button>
            {keyword && (
              <Link href={`/moto/setup/${spec.slug}`} className="text-sm text-slate-500 hover:underline">
                ล้าง
              </Link>
            )}
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="table-report">
            <thead>
              <tr>
                <th className="w-36">{spec.codeLabel}</th>
                <th>{spec.nameLabel}</th>
                {spec.parent && <th className="w-56">{spec.parent.label}</th>}
                <th className="w-24">ใช้งาน</th>
                <th className="w-56">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={spec.parent ? 5 : 4} className="py-4 text-slate-500">
                    {allRows.length === 0
                      ? `ยังไม่มีข้อมูล${spec.title} — เพิ่มรายการแรกได้จากฟอร์มด้านบน`
                      : `ไม่พบรายการที่ตรงกับ “${keyword}”`}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td colSpan={spec.parent ? 5 : 4} className="!p-0">
                      <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                        {canEdit ? (
                          <form
                            action={updateMasterForm}
                            className="flex flex-1 flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="kind" value={spec.kind} />
                            <input type="hidden" name="id" value={row.id} />
                            <input
                              name="code"
                              defaultValue={row.code}
                              className="input w-32"
                              maxLength={20}
                              required
                            />
                            <input
                              name="name"
                              defaultValue={row.name}
                              className="input min-w-48 flex-1"
                              maxLength={120}
                              required
                            />
                            {spec.parent && (
                              <select
                                name="parent_id"
                                defaultValue={(row.brand_id ?? row.model_id) ?? ""}
                                className="input w-56"
                                title={spec.parent.label}
                              >
                                <option value="">— ไม่ระบุ —</option>
                                {parents.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} · {p.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <label className="flex items-center gap-1 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                name="is_active"
                                defaultChecked={row.is_active}
                                className="h-4 w-4"
                              />
                              ใช้งาน
                            </label>
                            <button type="submit" className="btn-secondary">
                              บันทึก
                            </button>
                          </form>
                        ) : (
                          <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-slate-700">
                            <span className="w-32 text-left font-medium">{row.code}</span>
                            <span className="min-w-48 flex-1 text-left">{row.name}</span>
                            {spec.parent && (
                              <span className="w-56 text-left text-slate-500">
                                {parentNameOf(row, parents)}
                              </span>
                            )}
                            <span className={row.is_active ? "text-emerald-600" : "text-slate-400"}>
                              {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                            </span>
                          </div>
                        )}

                        {canDelete && (
                          <form action={deleteMasterForm} className="flex items-center gap-1">
                            <input type="hidden" name="kind" value={spec.kind} />
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="name" value={row.name} />
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              <input type="checkbox" name="confirm" className="h-4 w-4" />
                              ยืนยัน
                            </label>
                            <button type="submit" className="btn-danger">
                              ลบ
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canDelete && (
          <p className="text-xs text-slate-500">
            ลบแล้วกู้คืนไม่ได้ และข้อมูลลูกที่อ้างถึงจะกลายเป็น “ไม่ระบุ” —
            ถ้าแค่ต้องการซ่อนจาก dropdown ให้ติ๊ก “ใช้งาน” ออกแล้วกดบันทึกแทน
          </p>
        )}
      </section>
    </main>
  );
}

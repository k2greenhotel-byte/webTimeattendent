import Link from "next/link";
import { createPrTypeForm, deletePrTypeForm, updatePrTypeForm } from "@/app/procurement/setup/actions";
import { checkPermission } from "@/lib/session";
import { listPrTypes } from "@/lib/procurement-db";
import type { PrTypeKind } from "@/lib/procurement-types";

const MENU_OF: Record<PrTypeKind, string> = {
  asset: "PR_ASSET_TYPE",
  material: "PR_MATERIAL_TYPE",
};

const TITLE_OF: Record<PrTypeKind, string> = {
  asset: "ประเภททรัพย์สิน",
  material: "ประเภทวัสดุ",
};

/**
 * หน้าจอจัดการข้อมูลหลัก ประเภททรัพย์สิน (1.1.6) และประเภทวัสดุ (1.3.8)
 * ใช้โครงเดียวกันทั้งสองชุด ต่างกันแค่ kind ที่ส่งเข้ามา (ลอกแพตเทิร์นจากหน้าตั้งค่าข้อมูลหลักรถจักรยานยนต์)
 */
export default async function PrTypeSetup({
  kind,
  params,
}: {
  kind: PrTypeKind;
  params: { msg?: string; err?: string };
}) {
  const menuCode = MENU_OF[kind];
  const title = TITLE_OF[kind];

  const [canWrite, canEdit, canDelete, rows] = await Promise.all([
    checkPermission(menuCode, "write"),
    checkPermission(menuCode, "edit"),
    checkPermission(menuCode, "delete"),
    listPrTypes(kind, { includeInactive: true }),
  ]);

  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่า {title}</h1>
          <p className="text-sm text-slate-500">
            {rows.length} รายการ · เปิดใช้งาน {activeCount}
          </p>
        </div>
        <Link href="/procurement" className="btn-secondary">
          ← กลับหน้าแรก
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {canWrite ? (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่ม{title}ใหม่</h2>
          <form action={createPrTypeForm} className="grid gap-3 sm:grid-cols-[8rem_1fr_6rem_auto]">
            <input type="hidden" name="kind" value={kind} />
            <div>
              <label className="label">รหัส *</label>
              <input name="code" className="input" placeholder="AS13" maxLength={20} required />
            </div>
            <div>
              <label className="label">ชื่อ{title} *</label>
              <input name="name" className="input" placeholder="ชื่อประเภท" maxLength={120} required />
            </div>
            <div>
              <label className="label">ลำดับ</label>
              <input name="sort_order" className="input" inputMode="numeric" placeholder="0" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่ม
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="card text-sm text-slate-600">บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่มีสิทธิ์เพิ่มหรือแก้ไข{title}</p>
      )}

      <section className="card space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูล{title}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 p-3">
                {canEdit ? (
                  <form action={updatePrTypeForm} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="id" value={row.id} />
                    <input name="code" defaultValue={row.code} className="input w-28" maxLength={20} required />
                    <input
                      name="name"
                      defaultValue={row.name}
                      className="input min-w-40 flex-1"
                      maxLength={120}
                      required
                    />
                    <input
                      name="sort_order"
                      defaultValue={String(row.sort_order)}
                      className="input w-20"
                      inputMode="numeric"
                    />
                    <label className="flex items-center gap-1 text-sm text-slate-600">
                      <input type="checkbox" name="is_active" defaultChecked={row.is_active} className="h-4 w-4" />
                      ใช้งาน
                    </label>
                    <button type="submit" className="btn-secondary">
                      บันทึก
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <span className="w-28 font-medium">{row.code}</span>
                    <span className="min-w-40 flex-1">{row.name}</span>
                    <span className={row.is_active ? "text-emerald-600" : "text-slate-400"}>
                      {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </div>
                )}

                {canDelete && (
                  <form action={deletePrTypeForm} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="kind" value={kind} />
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDelete && (
        <p className="text-xs text-slate-500">
          ลบแล้วกู้คืนไม่ได้ และเอกสารที่เคยอ้างถึงจะกลายเป็น "ไม่ระบุ" — ถ้าแค่ต้องการซ่อนจาก dropdown
          ให้ติ๊ก "ใช้งาน" ออกแล้วกดบันทึกแทน
        </p>
      )}
    </main>
  );
}

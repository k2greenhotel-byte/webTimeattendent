import Link from "next/link";
import { formatBaht } from "@/lib/procurement";
import { listVendors } from "@/lib/procurement-db";
import { formatPhone } from "@/lib/phone";
import { checkPermission, requirePermission } from "@/lib/session";
import { createVendorForm, deleteVendorForm, updateVendorForm } from "./actions";

export const dynamic = "force-dynamic";

/**
 * ตั้งค่า เจ้าหนี้ / ผู้ขาย ที่จ่ายเป็นประจำ
 * ใบเบิกจ่ายเลือกจากทะเบียนนี้แล้วระบบเติมชื่อ ที่อยู่ เบอร์โทรให้
 * ส่วนผู้ขายที่ไม่ประจำยังพิมพ์เองในใบเบิกได้ ไม่ต้องมาเพิ่มที่นี่
 */
export default async function VendorSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; q?: string }>;
}) {
  await requirePermission("PR_VENDOR", "read");
  const params = await searchParams;
  const keyword = (params.q ?? "").trim().toLowerCase();

  const [canWrite, canEdit, canDelete, all] = await Promise.all([
    checkPermission("PR_VENDOR", "write"),
    checkPermission("PR_VENDOR", "edit"),
    checkPermission("PR_VENDOR", "delete"),
    listVendors({ includeInactive: true }),
  ]);

  const rows = keyword
    ? all.filter((v) =>
        [v.code, v.name, v.phone, v.address].join(" ").toLowerCase().includes(keyword),
      )
    : all;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่า เจ้าหนี้ / ผู้ขาย</h1>
          <p className="text-sm text-slate-500">
            {all.length} ราย · ใช้เลือกในใบเบิกเงินสดย่อยและใบเบิกจ่ายส่วนกลาง
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href="/procurement/setup/accounts" className="btn-secondary flex-1 sm:flex-none">
            ผังบัญชี
          </Link>
          <Link href="/procurement" className="btn-secondary flex-1 sm:flex-none">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {canWrite && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่มเจ้าหนี้ / ผู้ขายใหม่</h2>
          <form action={createVendorForm} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">รหัส *</label>
              <input name="code" className="input" placeholder="V001" maxLength={20} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อเจ้าหนี้ / ผู้ขาย *</label>
              <input name="name" className="input" placeholder="บริษัท ทดสอบวัสดุ จำกัด" maxLength={200} required />
            </div>
            <div>
              <label className="label">เบอร์โทร</label>
              <input name="phone" className="input" inputMode="tel" placeholder="0812345678" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">ที่อยู่</label>
              <textarea name="address" className="input min-h-20" rows={2} maxLength={500} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่มเจ้าหนี้
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-semibold text-slate-800">
            ทะเบียนเจ้าหนี้{" "}
            <span className="text-sm font-normal text-slate-400">({rows.length} ราย)</span>
          </h2>
          <form method="get" className="flex w-full items-center gap-2 sm:w-auto">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              className="input w-full sm:w-64"
              placeholder="ค้นหารหัส ชื่อ เบอร์โทร"
            />
            <button type="submit" className="btn-secondary">
              ค้นหา
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            {all.length === 0
              ? "ยังไม่มีเจ้าหนี้ในทะเบียน — เพิ่มรายแรกได้จากฟอร์มด้านบน"
              : `ไม่พบเจ้าหนี้ที่ตรงกับ “${params.q}”`}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((v) => (
              <li key={v.id} className="rounded-xl border border-slate-200 p-3">
                {canEdit ? (
                  <form action={updateVendorForm} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="id" value={v.id} />
                    <input
                      name="code"
                      defaultValue={v.code}
                      className="input"
                      maxLength={20}
                      required
                      aria-label="รหัสเจ้าหนี้"
                    />
                    <input
                      name="name"
                      defaultValue={v.name}
                      className="input lg:col-span-2"
                      maxLength={200}
                      required
                      aria-label="ชื่อเจ้าหนี้"
                    />
                    <input
                      name="phone"
                      defaultValue={v.phone ?? ""}
                      className="input"
                      inputMode="tel"
                      aria-label="เบอร์โทร"
                    />
                    <textarea
                      name="address"
                      defaultValue={v.address ?? ""}
                      className="input min-h-16 sm:col-span-2 lg:col-span-3"
                      rows={2}
                      maxLength={500}
                      aria-label="ที่อยู่"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        name="sort_order"
                        defaultValue={String(v.sort_order)}
                        className="input w-20"
                        inputMode="numeric"
                        aria-label="ลำดับ"
                      />
                      <label className="flex items-center gap-1 text-sm text-slate-600">
                        <input type="checkbox" name="is_active" defaultChecked={v.is_active} className="h-4 w-4" />
                        ใช้งาน
                      </label>
                      <button type="submit" className="btn-secondary">
                        บันทึก
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1 text-sm text-slate-700">
                    <p className="font-medium">
                      {v.code} · {v.name}
                      {!v.is_active && <span className="ml-2 text-xs text-slate-400">(ปิดใช้งาน)</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatPhone(v.phone)} {v.address ? `· ${v.address}` : ""}
                    </p>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    จ่ายแล้ว {v.payment_count} ใบ · รวม {formatBaht(v.paid_total)}
                  </span>

                  {canDelete && (
                    <form action={deleteVendorForm} className="ml-auto flex items-center gap-2">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="name" value={`${v.code} ${v.name}`} />
                      <label className="flex items-center gap-1">
                        <input type="checkbox" name="confirm" className="h-4 w-4" />
                        ยืนยัน
                      </label>
                      <button type="submit" className="btn-danger">
                        ลบ
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canDelete && (
          <p className="text-xs text-slate-500">
            ลบเจ้าหนี้แล้ว ใบเบิกเก่ายังอยู่ครบ เพราะเก็บชื่อและที่อยู่ ณ วันที่จ่ายไว้บนใบเบิกแล้ว ·
            ถ้าแค่ต้องการซ่อนจากรายการเลือก ให้ติ๊ก “ใช้งาน” ออกแล้วกดบันทึกแทน
          </p>
        )}
      </section>
    </main>
  );
}

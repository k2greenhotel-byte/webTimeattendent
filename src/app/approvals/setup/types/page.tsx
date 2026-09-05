import { listRejectReasons, listTypes } from "@/lib/approval-db";
import { listPrograms } from "@/lib/core-db";
import { requirePermission } from "@/lib/session";
import {
  createReasonForm,
  createTypeForm,
  deleteTypeForm,
  updateReasonForm,
  updateTypeForm,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovalTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("APV_TYPES", "read");
  const params = await searchParams;

  const [types, reasons, programs] = await Promise.all([
    listTypes(),
    listRejectReasons(false),
    listPrograms(true),
  ]);

  const programOptions = (
    <>
      <option value="">ไม่ผูกกับโปรแกรมไหน (เรื่องทั่วไป)</option>
      {programs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon} {p.name}
        </option>
      ))}
    </>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าประเภทเรื่องและเหตุผล</h1>
        <p className="text-sm text-slate-500">
          เพิ่มเรื่องที่ต้องขออนุมัติได้เองโดยไม่ต้องแก้ระบบ · เรื่องที่ติ๊ก
          &quot;ยื่นจากฟอร์มกลางได้&quot; พนักงานจะเลือกได้ที่เมนูยื่นเรื่อง ·
          เรื่องที่ไม่ติ๊กจะรับเฉพาะเรื่องที่โปรแกรมอื่นส่งเข้ามา
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- เพิ่มประเภทเรื่อง ---------- */}
      <form action={createTypeForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มประเภทเรื่องใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-6">
          <div>
            <label className="label">รหัส *</label>
            <input name="code" className="input" placeholder="OT_REQ" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อเรื่อง *</label>
            <input name="name" className="input" placeholder="ขออนุมัติทำงานล่วงเวลา" required />
          </div>
          <div>
            <label className="label">ไอคอน</label>
            <input name="icon" className="input" placeholder="⏰" maxLength={4} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">โปรแกรมต้นทาง</label>
            <select name="program_id" defaultValue="" className="input">
              {programOptions}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">คำอธิบาย</label>
            <input name="description" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ป้ายช่องจำนวน</label>
            <input name="amount_label" className="input" placeholder="จำนวนเงิน (บาท)" />
          </div>
          <div>
            <label className="label">ลำดับ</label>
            <input name="sort_order" type="number" className="input" defaultValue={0} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="has_amount" defaultChecked />
            มีจำนวนเงิน/จำนวนหน่วยให้อนุมัติ
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allow_partial" defaultChecked />
            อนุมัติบางส่วนได้
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="form_enabled" defaultChecked />
            ยื่นจากฟอร์มกลางได้
          </label>
        </div>
        <button type="submit" className="btn-primary">
          เพิ่มประเภทเรื่อง
        </button>
      </form>

      {/* ---------- ประเภทเรื่องทั้งหมด ---------- */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">ประเภทเรื่องทั้งหมด ({types.length})</h2>

        {types.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 p-3">
            <form action={updateTypeForm} className="grid items-end gap-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={t.id} />
              <div>
                <label className="label">รหัส</label>
                <input name="code" defaultValue={t.code} className="input" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">ชื่อเรื่อง</label>
                <input name="name" defaultValue={t.name} className="input" required />
              </div>
              <div>
                <label className="label">ไอคอน</label>
                <input name="icon" defaultValue={t.icon ?? ""} className="input" maxLength={4} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">โปรแกรมต้นทาง</label>
                <select name="program_id" defaultValue={t.program_id ?? ""} className="input">
                  {programOptions}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label">คำอธิบาย</label>
                <input name="description" defaultValue={t.description ?? ""} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">ป้ายช่องจำนวน</label>
                <input name="amount_label" defaultValue={t.amount_label} className="input" />
              </div>
              <div>
                <label className="label">ลำดับ</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={t.sort_order}
                  className="input"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="label">วงเงินไม่ต้องขออนุมัติ (บาท · ว่าง = ต้องขออนุมัติทุกใบ)</label>
                <input
                  name="auto_approve_limit"
                  className="input"
                  inputMode="decimal"
                  defaultValue={t.auto_approve_limit ?? ""}
                  placeholder="เช่น 3000 — ยอดไม่เกินนี้ระบบอนุมัติให้ทันที"
                />
              </div>

              <div className="flex flex-wrap gap-4 pb-2 text-sm text-slate-600 sm:col-span-5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="has_amount" defaultChecked={t.has_amount} />
                  มีจำนวน
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allow_partial" defaultChecked={t.allow_partial} />
                  อนุมัติบางส่วนได้
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="form_enabled" defaultChecked={t.form_enabled} />
                  ยื่นจากฟอร์มกลางได้
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_active" defaultChecked={t.is_active} />
                  เปิดใช้งาน
                </label>
              </div>
              <button type="submit" className="btn-secondary">
                บันทึก
              </button>
            </form>

            <form
              action={deleteTypeForm}
              className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-2"
            >
              <input type="hidden" name="id" value={t.id} />
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" name="confirm" />
                ยืนยันลบประเภทเรื่องนี้ (ลบได้เฉพาะเรื่องที่ยังไม่มีใบขอ)
              </label>
              <button type="submit" className="text-xs text-rose-600 hover:underline">
                ลบ
              </button>
            </form>
          </div>
        ))}
      </section>

      {/* ---------- เหตุผลการไม่อนุมัติ ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เหตุผลการไม่อนุมัติ ({reasons.length})</h2>
        <p className="text-sm text-slate-500">ผู้อนุมัติจะเลือกจากรายการนี้ตอนกดไม่อนุมัติ</p>

        <form action={createReasonForm} className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="sm:w-32">
            <label className="label">รหัส</label>
            <input name="code" className="input" placeholder="NO_BUDGET" required />
          </div>
          <div className="sm:w-72">
            <label className="label">ข้อความเหตุผล</label>
            <input name="name" className="input" placeholder="งบประมาณไม่พอ" required />
          </div>
          <div className="sm:w-20">
            <label className="label">ลำดับ</label>
            <input name="sort_order" type="number" className="input" defaultValue={0} />
          </div>
          <button type="submit" className="btn-primary sm:py-2 sm:text-sm">
            เพิ่มเหตุผล
          </button>
        </form>

        <div className="space-y-2">
          {reasons.map((r) => (
            <form
              key={r.id}
              action={updateReasonForm}
              className="space-y-2 rounded-xl border border-slate-100 p-2 sm:flex sm:flex-wrap sm:items-end sm:gap-2 sm:space-y-0 sm:border-0 sm:p-0"
            >
              <input type="hidden" name="id" value={r.id} />
              <p className="text-xs text-slate-400 sm:w-28 sm:pb-2">{r.code}</p>
              <input name="name" defaultValue={r.name} className="input sm:w-72" required />
              <div className="flex flex-wrap items-center gap-3 sm:gap-2">
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={r.sort_order}
                  className="input w-20"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 sm:pb-2">
                  <input type="checkbox" name="is_active" defaultChecked={r.is_active} />
                  เปิดใช้
                </label>
                <button type="submit" className="btn-secondary flex-1 sm:flex-none sm:py-1.5 sm:text-xs">
                  บันทึก
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}

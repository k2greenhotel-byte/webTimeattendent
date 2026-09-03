import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { createCompanyForm, deleteCompanyForm, updateCompanyForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const [companies, branches] = await Promise.all([listCompanies(), listBranches()]);

  const branchCount = new Map<string, number>();
  for (const b of branches) {
    if (b.company_id) branchCount.set(b.company_id, (branchCount.get(b.company_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าบริษัท</h1>
        <p className="text-sm text-slate-500">
          รหัสบริษัท ชื่อบริษัท ที่อยู่ และเลขผู้เสียภาษี — หนึ่งองค์กรมีได้หลายบริษัท
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={createCompanyForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มบริษัทใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">รหัสบริษัท *</label>
            <input name="code" className="input" placeholder="C01" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อบริษัท *</label>
            <input name="name" className="input" placeholder="บริษัท ตัวอย่าง จำกัด" required />
          </div>
          <div>
            <label className="label">เลขผู้เสียภาษี</label>
            <input name="tax_id" className="input" placeholder="0105500000000" inputMode="numeric" />
          </div>
          <div className="sm:col-span-4">
            <label className="label">ที่อยู่</label>
            <input name="address" className="input" placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          เพิ่มบริษัท
        </button>
      </form>

      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">บริษัททั้งหมด ({companies.length})</h2>

        {companies.length === 0 && (
          <p className="text-sm text-slate-500">ยังไม่มีบริษัท — เพิ่มบริษัทแรกจากแบบฟอร์มด้านบน</p>
        )}

        {companies.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-3">
            <form action={updateCompanyForm} className="grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={c.id} />
              <div>
                <label className="label">รหัสบริษัท</label>
                <input name="code" defaultValue={c.code} className="input" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">ชื่อบริษัท</label>
                <input name="name" defaultValue={c.name} className="input" required />
              </div>
              <div>
                <label className="label">เลขผู้เสียภาษี</label>
                <input name="tax_id" defaultValue={c.tax_id ?? ""} className="input" inputMode="numeric" />
              </div>
              <div className="sm:col-span-4">
                <label className="label">ที่อยู่</label>
                <input name="address" defaultValue={c.address ?? ""} className="input" />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked={c.is_active} />
                เปิดใช้งาน
              </label>
              <p className="pb-2 text-sm text-slate-500">สาขา {branchCount.get(c.id) ?? 0} สาขา</p>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-secondary">
                  บันทึก
                </button>
              </div>
            </form>

            <form
              action={deleteCompanyForm}
              className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-2"
            >
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="text-xs text-rose-600 hover:underline">
                ลบบริษัทนี้
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" name="force" />
                ยืนยันลบทั้งที่ยังมีสาขาอยู่ ({branchCount.get(c.id) ?? 0} สาขา จะกลายเป็นไม่ระบุบริษัท)
              </label>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}

import Link from "next/link";
import { createBranchForm, deleteBranchForm, updateBranchForm } from "@/app/core/branches/actions";
import { listCompanies } from "@/lib/core-db";
import { listBranches, listEmployees, listSchedules } from "@/lib/db";
import { formatLatLng, googleMapsUrl } from "@/lib/geo";

/**
 * หน้าจอจัดการสาขา ใช้ร่วมกันทั้งระบบส่วนกลางและหลังบ้านลงเวลา
 * (โค้ดชุดเดียว กันข้อมูลสองหน้าจอไม่ตรงกันเมื่อแก้ทีหลัง)
 */
export default async function BranchManager({
  basePath,
  message,
  error,
}: {
  basePath: "/core/branches" | "/admin/branches";
  message?: string;
  error?: string;
}) {
  const [companies, branches, employees, schedules] = await Promise.all([
    listCompanies(),
    listBranches(),
    listEmployees(),
    listSchedules(),
  ]);
  const defaultSchedule = schedules.find((s) => s.is_default);

  const countByBranch = new Map<string, number>();
  for (const e of employees) {
    if (e.branch_id) countByBranch.set(e.branch_id, (countByBranch.get(e.branch_id) ?? 0) + 1);
  }

  const companyOptions = (
    <>
      <option value="">— ไม่ระบุบริษัท —</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} · {c.name}
        </option>
      ))}
    </>
  );

  const scheduleOptions = (
    <>
      <option value="">— ใช้กะเริ่มต้น{defaultSchedule ? ` (${defaultSchedule.name})` : ""} —</option>
      {schedules.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} ({s.work_start}-{s.work_end})
        </option>
      ))}
    </>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าสาขา</h1>
        <p className="text-sm text-slate-500">
          รหัสสาขา ชื่อสาขา ที่อยู่ เบอร์โทร พิกัดสาขา และบริษัทที่สังกัด — เวลาเข้า-ออกงานแก้ที่{" "}
          <Link href="/admin/setup" className="text-brand-600 hover:underline">
            ตั้งค่าข้อมูลหลัก → กะทำงาน
          </Link>
        </p>
      </div>

      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {companies.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ยังไม่มีบริษัทในระบบ — เพิ่มบริษัทก่อนที่{" "}
          <Link href="/core/companies" className="underline">
            ระบบส่วนกลาง → ตั้งค่าบริษัท
          </Link>
        </p>
      )}

      <form action={createBranchForm} className="card space-y-3">
        <input type="hidden" name="from" value={basePath} />
        <h2 className="font-semibold text-slate-800">เพิ่มสาขาใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">รหัสสาขา *</label>
            <input name="code" className="input" placeholder="BKK01" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อสาขา *</label>
            <input name="name" className="input" placeholder="สาขาสยาม" required />
          </div>
          <div>
            <label className="label">เบอร์โทร</label>
            <input name="phone" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">บริษัทที่สังกัด</label>
            <select name="company_id" defaultValue={companies[0]?.id ?? ""} className="input">
              {companyOptions}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">กะทำงาน (เว้นว่าง = ใช้กะเริ่มต้น)</label>
            <select name="schedule_id" defaultValue="" className="input">
              {scheduleOptions}
            </select>
          </div>
          <div className="sm:col-span-4">
            <label className="label">ที่อยู่</label>
            <input name="address" className="input" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">พิกัดสาขา (วางจาก Google Maps)</label>
            <input
              name="coords"
              className="input"
              placeholder="13.7563, 100.5018 หรือวางลิงก์ Google Maps (รวมลิงก์ย่อ)"
            />
          </div>
          <div>
            <label className="label">รัศมี (เมตร)</label>
            <input name="radius_m" type="number" className="input" placeholder="200" />
          </div>
        </div>
        <button type="submit" className="btn-primary">
          เพิ่มสาขา
        </button>
      </form>

      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">สาขาทั้งหมด ({branches.length})</h2>

        {branches.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 p-3">
            <form action={updateBranchForm} className="grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="from" value={basePath} />
              <div>
                <label className="label">รหัสสาขา</label>
                <input name="code" defaultValue={b.code} className="input" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">ชื่อสาขา</label>
                <input name="name" defaultValue={b.name} className="input" required />
              </div>
              <div>
                <label className="label">เบอร์โทร</label>
                <input name="phone" defaultValue={b.phone ?? ""} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">บริษัทที่สังกัด</label>
                <select name="company_id" defaultValue={b.company_id ?? ""} className="input">
                  {companyOptions}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">กะทำงาน</label>
                <select name="schedule_id" defaultValue={b.schedule_id ?? ""} className="input">
                  {scheduleOptions}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="label">ที่อยู่</label>
                <input name="address" defaultValue={b.address ?? ""} className="input" />
              </div>
              <div className="sm:col-span-3">
                <label className="label">
                  พิกัดสาขา (วางจาก Google Maps){" "}
                  {b.site_lat !== null && b.site_lng !== null && (
                    <a
                      href={googleMapsUrl(b.site_lat, b.site_lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-xs text-brand-600 hover:underline"
                    >
                      📍 เปิดแผนที่
                    </a>
                  )}
                </label>
                <input
                  name="coords"
                  defaultValue={formatLatLng(b.site_lat, b.site_lng)}
                  className="input"
                  placeholder="13.7563, 100.5018 หรือวางลิงก์ Google Maps (รวมลิงก์ย่อ)"
                />
              </div>
              <div>
                <label className="label">รัศมี (เมตร)</label>
                <input
                  name="radius_m"
                  type="number"
                  defaultValue={b.radius_m ?? ""}
                  className="input"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked={b.is_active} />
                เปิดใช้งาน
              </label>
              <p className="pb-2 text-sm text-slate-500">
                พนักงาน {countByBranch.get(b.id) ?? 0} คน
              </p>
              <button type="submit" className="btn-secondary">
                บันทึก
              </button>
            </form>

            <form
              action={deleteBranchForm}
              className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-2"
            >
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="from" value={basePath} />
              <button type="submit" className="text-xs text-rose-600 hover:underline">
                ลบสาขานี้
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" name="force" />
                ยืนยันลบทั้งที่ยังมีพนักงานอยู่ ({countByBranch.get(b.id) ?? 0} คน จะกลายเป็นไม่ระบุสาขา)
              </label>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}

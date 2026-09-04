import Link from "next/link";
import CompanyFilter from "@/components/CompanyFilter";
import { getCompanyScope } from "@/lib/att-scope";
import { getOrgSettings, listSchedules } from "@/lib/db";
import { saveSettingsForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; company?: string }>;
}) {
  const params = await searchParams;
  const scope = await getCompanyScope(params.company);

  const [org, schedules] = await Promise.all([
    getOrgSettings(scope.companyId),
    listSchedules(scope.companyId),
  ]);
  const current = schedules.find((s) => s.is_default) ?? schedules[0];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่าระบบลงเวลา</h1>
          <p className="text-sm text-slate-500">
            ค่าของ <strong>{scope.companyName ?? "บริษัท"}</strong> · ใช้กับทุกสาขาของบริษัทนี้ ·
            เวลาเข้า-ออกงานตั้งที่{" "}
            <Link
              href={`/admin/setup${scope.companyId ? `?company=${scope.companyId}` : ""}`}
              className="text-brand-600 hover:underline"
            >
              ตั้งค่าข้อมูลหลัก → กะทำงาน
            </Link>
          </p>
        </div>

        {scope.companies.length > 1 && (
          <form method="get" className="flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={scope.companyId} />
            <button type="submit" className="btn-secondary">
              เปลี่ยนบริษัท
            </button>
          </form>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={saveSettingsForm} className="space-y-4">
        <input type="hidden" name="company" value={scope.companyId ?? ""} />

        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">ข้อมูลทั่วไป</h2>
          <div>
            <label className="label" htmlFor="org_name">
              ชื่อที่แสดงในรายงาน
            </label>
            <input id="org_name" name="org_name" defaultValue={org.org_name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="default_schedule_id">
              กะทำงานเริ่มต้น (ใช้กับสาขาที่ไม่ได้เลือกกะเอง)
            </label>
            <select
              id="default_schedule_id"
              name="default_schedule_id"
              defaultValue={current?.id ?? ""}
              className="input"
            >
              {schedules.length === 0 && <option value="">— ยังไม่มีกะทำงาน —</option>}
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.work_start}-{s.break_start} · {s.break_end}-{s.work_end})
                  {s.company_id ? "" : " · ของกลาง"}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            เขตเวลา: {org.timezone} (ระบบบันทึกและแสดงผลตามเวลาไทยเสมอ)
          </p>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">การตรวจตำแหน่ง (GPS)</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="require_gps" defaultChecked={org.require_gps} />
            บังคับให้อยู่ในรัศมีของสาขาจึงลงเวลาได้
          </label>
          <div className="max-w-xs">
            <label className="label" htmlFor="radius_m">
              รัศมีเริ่มต้น (เมตร)
            </label>
            <input
              id="radius_m"
              name="radius_m"
              type="number"
              min={20}
              defaultValue={org.radius_m}
              className="input"
            />
          </div>
          <p className="text-xs text-slate-500">
            พิกัดของแต่ละสาขาตั้งที่{" "}
            <Link
              href={`/admin/branches${scope.companyId ? `?company=${scope.companyId}` : ""}`}
              className="text-brand-600 hover:underline"
            >
              หน้าสาขา
            </Link>{" "}
            — สาขาที่กำหนดรัศมีเองจะใช้ค่าของตัวเองแทนค่านี้ ·
            รัศมีแคบเกินไป (ต่ำกว่า 50 เมตร) พนักงานอาจลงเวลาไม่ผ่านเพราะความคลาดเคลื่อนของ GPS
          </p>
        </section>

        <button type="submit" className="btn-primary w-full sm:w-auto">
          บันทึกการตั้งค่า
        </button>
      </form>
    </main>
  );
}

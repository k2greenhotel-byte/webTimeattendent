import { getWorkSettings } from "@/lib/db";
import { saveSettingsForm } from "./actions";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const s = await getWorkSettings();

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าเวลาทำงาน</h1>
        <p className="text-sm text-slate-500">
          ค่าเหล่านี้ใช้คำนวณ สาย / กลับก่อนเวลา / ชั่วโมงทำงาน ในทุกรายงาน
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={saveSettingsForm} className="space-y-4">
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">ข้อมูลทั่วไป</h2>
          <div>
            <label className="label" htmlFor="org_name">
              ชื่อร้าน / บริษัท
            </label>
            <input id="org_name" name="org_name" defaultValue={s.org_name} className="input" />
          </div>

          <div>
            <span className="label">วันทำงาน</span>
            <div className="flex flex-wrap gap-3">
              {DAY_LABELS.map((label, day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name={`workday_${day}`}
                    defaultChecked={s.workdays.includes(day)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เวลามาตรฐาน</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="work_start">
                เข้างาน
              </label>
              <input id="work_start" name="work_start" type="time" defaultValue={s.work_start} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="break_start">
                เริ่มพักเที่ยง
              </label>
              <input id="break_start" name="break_start" type="time" defaultValue={s.break_start} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="break_end">
                กลับเข้างานบ่าย
              </label>
              <input id="break_end" name="break_end" type="time" defaultValue={s.break_end} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="work_end">
                เลิกงาน
              </label>
              <input id="work_end" name="work_end" type="time" defaultValue={s.work_end} className="input" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            เวลาพักเที่ยงใช้เป็นค่าอ้างอิงเท่านั้น พนักงานออก-เข้าพักเวลาใดก็ได้ ระบบดูจากโควตาพักด้านล่าง
          </p>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">กฎการคำนวณ</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="late_grace_min">
                ผ่อนผันสาย (นาที)
              </label>
              <input
                id="late_grace_min"
                name="late_grace_min"
                type="number"
                min={0}
                defaultValue={s.late_grace_min}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="early_leave_grace_min">
                ผ่อนผันกลับก่อน (นาที)
              </label>
              <input
                id="early_leave_grace_min"
                name="early_leave_grace_min"
                type="number"
                min={0}
                defaultValue={s.early_leave_grace_min}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="break_allow_minutes">
                โควตาพักกลางวัน (นาที)
              </label>
              <input
                id="break_allow_minutes"
                name="break_allow_minutes"
                type="number"
                min={0}
                defaultValue={s.break_allow_minutes}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="break_policy">
                วิธีหักเวลาพักออกจากชั่วโมงทำงาน
              </label>
              <select id="break_policy" name="break_policy" defaultValue={s.break_policy} className="input">
                <option value="actual">หักตามเวลาพักจริง (แนะนำ)</option>
                <option value="fixed">หักคงที่ตามโควตา</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ot_grace_min">
                เริ่มนับ OT หลังเลิกงาน (นาที)
              </label>
              <input
                id="ot_grace_min"
                name="ot_grace_min"
                type="number"
                min={0}
                defaultValue={s.ot_grace_min}
                className="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="count_ot" defaultChecked={s.count_ot} />
            คำนวณ OT
          </label>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">ตำแหน่งที่ทำงาน (GPS)</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="require_gps" defaultChecked={s.require_gps} />
            บังคับให้อยู่ในรัศมีที่กำหนดจึงลงเวลาได้
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="site_lat">
                ละติจูด
              </label>
              <input id="site_lat" name="site_lat" defaultValue={s.site_lat ?? ""} className="input" placeholder="13.7563" />
            </div>
            <div>
              <label className="label" htmlFor="site_lng">
                ลองจิจูด
              </label>
              <input id="site_lng" name="site_lng" defaultValue={s.site_lng ?? ""} className="input" placeholder="100.5018" />
            </div>
            <div>
              <label className="label" htmlFor="radius_m">
                รัศมี (เมตร)
              </label>
              <input id="radius_m" name="radius_m" type="number" min={20} defaultValue={s.radius_m} className="input" />
            </div>
          </div>
        </section>

        <button type="submit" className="btn-primary">
          บันทึกการตั้งค่า
        </button>
      </form>
    </main>
  );
}

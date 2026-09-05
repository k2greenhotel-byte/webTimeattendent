import Link from "next/link";
import CompanyFilter from "@/components/CompanyFilter";
import { getCompanyScope } from "@/lib/att-scope";
import {
  listBranches,
  listDepartments,
  listEmployees,
  listFieldTaskTypes,
  listPositions,
  listSchedules,
  listSites,
} from "@/lib/db";
import { googleMapsUrl } from "@/lib/geo";
import type { Department, Position } from "@/lib/types";
import {
  createLookupForm,
  createScheduleForm,
  deleteFieldTaskTypeForm,
  deleteLookupForm,
  deleteScheduleForm,
  deleteSiteForm,
  saveFieldTaskTypeForm,
  saveSiteForm,
  setDefaultScheduleForm,
  updateLookupForm,
  updateScheduleForm,
} from "./actions";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function LookupSection({
  table,
  title,
  hint,
  items,
  usage,
  companyId,
}: {
  table: "departments" | "positions";
  title: string;
  hint: string;
  items: (Department | Position)[];
  usage: Map<string, number>;
  companyId: string | null;
}) {
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>

      <form action={createLookupForm} className="flex items-end gap-2">
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="company" value={companyId ?? ""} />
        <div className="flex-1">
          <input name="name" className="input" placeholder={`เพิ่ม${title}ใหม่`} required />
        </div>
        <button type="submit" className="btn-primary">
          เพิ่ม
        </button>
      </form>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="py-3 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2">
            <form action={updateLookupForm} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="company" value={companyId ?? ""} />
              <input type="hidden" name="id" value={item.id} />
              <input name="name" defaultValue={item.name} className="input flex-1" required />
              <button type="submit" className="btn-secondary">
                บันทึก
              </button>
            </form>
            <span className="w-16 text-xs text-slate-500">{usage.get(item.id) ?? 0} คน</span>
            <form action={deleteLookupForm} className="flex items-center gap-2">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="company" value={companyId ?? ""} />
              <input type="hidden" name="id" value={item.id} />
              <label className="flex items-center gap-1 text-xs text-slate-400" title="ลบแม้ยังมีคนใช้อยู่">
                <input type="checkbox" name="force" />
                บังคับ
              </label>
              <button type="submit" className="text-xs text-rose-600 hover:underline">
                ลบ
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; company?: string }>;
}) {
  const params = await searchParams;
  const scope = await getCompanyScope(params.company);
  const companyId = scope.companyId;

  const [departments, positions, schedules, employees, branches, sites, taskTypes] = await Promise.all([
    listDepartments(companyId),
    listPositions(companyId),
    listSchedules(companyId),
    listEmployees({ companyId }),
    listBranches(false, companyId),
    listSites(companyId),
    listFieldTaskTypes(companyId),
  ]);

  const deptUsage = new Map<string, number>();
  const posUsage = new Map<string, number>();
  for (const e of employees) {
    if (e.department_id) deptUsage.set(e.department_id, (deptUsage.get(e.department_id) ?? 0) + 1);
    if (e.position_id) posUsage.set(e.position_id, (posUsage.get(e.position_id) ?? 0) + 1);
  }

  const branchesBySchedule = new Map<string, string[]>();
  for (const b of branches) {
    if (!b.schedule_id) continue;
    branchesBySchedule.set(b.schedule_id, [...(branchesBySchedule.get(b.schedule_id) ?? []), b.code]);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่าข้อมูลหลัก (Setup)</h1>
          <p className="text-sm text-slate-500">
            ข้อมูลของ <strong>{scope.companyName ?? "บริษัท"}</strong> — แก้ที่นี่ที่เดียว
            มีผลกับทุกสาขาของบริษัทนี้ · รายการที่ขึ้นว่า &quot;ของกลาง&quot; ใช้ร่วมกันทุกบริษัท
          </p>
        </div>

        {scope.companies.length > 1 && (
          <form method="get" className="flex flex-wrap items-end gap-2">
            <CompanyFilter companies={scope.companies} value={companyId} />
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

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">ตารางข้อมูลหลักของระบบ</h2>
        <div className="table-wrap">
          <table className="table-report">
            <thead>
              <tr>
                <th>ตาราง</th>
                <th>เก็บอะไร</th>
                <th>จำนวน</th>
                <th className="no-print">จัดการที่</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-left">พนักงาน (employees)</td>
                <td className="text-left">รหัสพนักงาน, ชื่อ, เบอร์โทร, PIN, สาขา, แผนก, ตำแหน่ง</td>
                <td>{employees.length}</td>
                <td className="no-print">
                  <Link href="/admin/employees" className="text-brand-600 hover:underline">
                    หน้าพนักงาน
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="text-left">สาขา (branches)</td>
                <td className="text-left">รหัสสาขา, ชื่อสาขา, พิกัด, รัศมี, กะที่ใช้</td>
                <td>{branches.length}</td>
                <td className="no-print">
                  <Link href="/admin/branches" className="text-brand-600 hover:underline">
                    หน้าสาขา
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="text-left">กะทำงาน (work_schedules)</td>
                <td className="text-left">เวลาเข้างาน, ออกพักเที่ยง, เข้าบ่าย, เลิกงาน + กฎคำนวณ</td>
                <td>{schedules.length}</td>
                <td className="no-print">ด้านล่างหน้านี้</td>
              </tr>
              <tr>
                <td className="text-left">แผนก (departments)</td>
                <td className="text-left">ชื่อแผนก</td>
                <td>{departments.length}</td>
                <td className="no-print">ด้านล่างหน้านี้</td>
              </tr>
              <tr>
                <td className="text-left">ตำแหน่ง (positions)</td>
                <td className="text-left">ชื่อตำแหน่ง</td>
                <td>{positions.length}</td>
                <td className="no-print">ด้านล่างหน้านี้</td>
              </tr>
              <tr>
                <td className="text-left">สถานที่ปฏิบัติงานนอกสถานที่ (work_sites)</td>
                <td className="text-left">บูธห้าง ลานจัดงาน ฯลฯ — ชื่อ, พิกัด, รัศมี (ใช้ในตารางเวรและภารกิจ)</td>
                <td>{sites.length}</td>
                <td className="no-print">ด้านล่างหน้านี้</td>
              </tr>
              <tr>
                <td className="text-left">ประเภทงานนอกสถานที่ (field_task_types)</td>
                <td className="text-left">ออกบูธ, ส่งรถ … และนับเป็นชั่วโมงงานพิเศษหรือไม่</td>
                <td>{taskTypes.length}</td>
                <td className="no-print">ด้านล่างหน้านี้</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- กะทำงาน ---------- */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">กะทำงาน — เวลาเข้า/ออกงาน</h2>
          <p className="text-xs text-slate-500">
            เวลาทั้ง 4 ช่วงเก็บที่ตารางนี้ที่เดียว สาขาแต่ละแห่งเลือกใช้กะที่ต้องการ
            (สาขาที่ไม่ได้เลือกจะใช้กะเริ่มต้น)
          </p>
        </div>

        {schedules.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 p-3">
            <form action={updateScheduleForm} className="grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="company" value={companyId ?? ""} />

              <div className="sm:col-span-2">
                <label className="label">
                  ชื่อกะ{" "}
                  {s.is_default && (
                    <span className="badge bg-emerald-50 text-emerald-700">กะเริ่มต้น</span>
                  )}
                </label>
                <input name="name" defaultValue={s.name} className="input" required />
              </div>
              <div className="sm:col-span-2 flex items-end text-xs text-slate-500">
                ใช้ที่สาขา: {branchesBySchedule.get(s.id)?.join(", ") || "— (สาขาที่ไม่ได้เลือกกะ)"}
              </div>

              <div>
                <label className="label">เวลาเข้างาน</label>
                <input name="work_start" type="time" defaultValue={s.work_start} className="input" />
              </div>
              <div>
                <label className="label">ออกพักเที่ยง</label>
                <input name="break_start" type="time" defaultValue={s.break_start} className="input" />
              </div>
              <div>
                <label className="label">เข้างานบ่าย</label>
                <input name="break_end" type="time" defaultValue={s.break_end} className="input" />
              </div>
              <div>
                <label className="label">เวลาออกงาน</label>
                <input name="work_end" type="time" defaultValue={s.work_end} className="input" />
              </div>

              <div>
                <label className="label">ผ่อนผันสาย (นาที)</label>
                <input
                  name="late_grace_min"
                  type="number"
                  min={0}
                  defaultValue={s.late_grace_min}
                  className="input"
                />
              </div>
              <div>
                <label className="label">ผ่อนผันกลับก่อน (นาที)</label>
                <input
                  name="early_leave_grace_min"
                  type="number"
                  min={0}
                  defaultValue={s.early_leave_grace_min}
                  className="input"
                />
              </div>
              <div>
                <label className="label">โควตาพักกลางวัน (นาที)</label>
                <input
                  name="break_allow_minutes"
                  type="number"
                  min={0}
                  defaultValue={s.break_allow_minutes}
                  className="input"
                />
              </div>
              <div>
                <label className="label">เริ่มนับ OT หลัง (นาที)</label>
                <input
                  name="ot_grace_min"
                  type="number"
                  min={0}
                  defaultValue={s.ot_grace_min}
                  className="input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">วิธีหักเวลาพัก</label>
                <select name="break_policy" defaultValue={s.break_policy} className="input">
                  <option value="actual">หักตามเวลาพักจริง</option>
                  <option value="fixed">หักคงที่ตามโควตา</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <span className="label">วันทำงาน</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAY_LABELS.map((label, day) => (
                    <label key={day} className="flex items-center gap-1 text-sm">
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

              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="count_ot" defaultChecked={s.count_ot} />
                คำนวณ OT
              </label>

              <button type="submit" className="btn-secondary">
                บันทึกกะนี้
              </button>
            </form>

            <div className="mt-2 flex gap-4 border-t border-dashed border-slate-200 pt-2">
              {!s.is_default && (
                <>
                  <form action={setDefaultScheduleForm}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="company" value={companyId ?? ""} />
                    <button type="submit" className="text-xs text-brand-600 hover:underline">
                      ตั้งเป็นกะเริ่มต้น
                    </button>
                  </form>
                  <form action={deleteScheduleForm} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="company" value={companyId ?? ""} />
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input type="checkbox" name="force" />
                      บังคับ (สาขาที่ใช้อยู่จะกลับไปใช้กะเริ่มต้น)
                    </label>
                    <button type="submit" className="text-xs text-rose-600 hover:underline">
                      ลบกะนี้
                    </button>
                  </form>
                </>
              )}
              {s.is_default && (
                <span className="text-xs text-slate-400">
                  กะเริ่มต้นลบไม่ได้ — ตั้งกะอื่นเป็นค่าเริ่มต้นก่อน
                </span>
              )}
            </div>
          </div>
        ))}

        <form action={createScheduleForm} className="rounded-xl border border-dashed border-slate-300 p-3">
          <input type="hidden" name="company" value={companyId ?? ""} />
          <h3 className="mb-2 text-sm font-semibold text-slate-700">เพิ่มกะทำงานใหม่</h3>
          <div className="grid items-end gap-3 sm:grid-cols-5">
            <div>
              <label className="label">ชื่อกะ *</label>
              <input name="name" className="input" placeholder="กะบ่าย" required />
            </div>
            <div>
              <label className="label">เข้างาน</label>
              <input name="work_start" type="time" defaultValue="08:00" className="input" />
            </div>
            <div>
              <label className="label">ออกพักเที่ยง</label>
              <input name="break_start" type="time" defaultValue="12:00" className="input" />
            </div>
            <div>
              <label className="label">เข้างานบ่าย</label>
              <input name="break_end" type="time" defaultValue="13:00" className="input" />
            </div>
            <div>
              <label className="label">ออกงาน</label>
              <input name="work_end" type="time" defaultValue="17:00" className="input" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {DAY_LABELS.map((label, day) => (
              <label key={day} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name={`workday_${day}`} defaultChecked={day >= 1 && day <= 6} />
                {label}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="count_ot" defaultChecked />
              คำนวณ OT
            </label>
            <button type="submit" className="btn-primary">
              เพิ่มกะทำงาน
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <LookupSection
          table="departments"
          title="แผนก"
          hint="ใช้จัดกลุ่มพนักงานและแสดงในรายงาน"
          items={departments}
          usage={deptUsage}
          companyId={companyId}
        />
        <LookupSection
          table="positions"
          title="ตำแหน่ง"
          hint="ตำแหน่งงานของพนักงาน"
          items={positions}
          usage={posUsage}
          companyId={companyId}
        />
      </div>

      {/* ---------- สถานที่ปฏิบัติงานนอกสถานที่ ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">สถานที่ปฏิบัติงานนอกสถานที่</h2>
          <p className="text-xs text-slate-500">
            บูธห้าง ลานจัดงาน ฯลฯ — ใช้ในตารางเวร (ไปประจำทั้งวัน GPS ตรวจที่นั่น) และภารกิจงานนอกสถานที่ ·
            พิกัดวางลิงก์ Google Maps หรือ &quot;lat, lng&quot; ได้เลย
          </p>
        </div>

        <form action={saveSiteForm} className="grid gap-2 md:grid-cols-[8rem_1fr_1fr_1fr_6rem_auto] md:items-end">
          <input type="hidden" name="company" value={companyId ?? ""} />
          <div>
            <label className="label">รหัส</label>
            <input name="code" className="input" placeholder="BOOTH1" />
          </div>
          <div>
            <label className="label">ชื่อสถานที่</label>
            <input name="name" className="input" placeholder="บูธบิ๊กซี กาญจนบุรี" required />
          </div>
          <div>
            <label className="label">ที่อยู่</label>
            <input name="address" className="input" />
          </div>
          <div>
            <label className="label">พิกัด / ลิงก์ Google Maps</label>
            <input name="coords" className="input" placeholder="14.02, 99.53 หรือลิงก์" />
          </div>
          <div>
            <label className="label">รัศมี (ม.)</label>
            <input name="radius_m" type="number" className="input" placeholder="ค่าองค์กร" />
          </div>
          <button type="submit" className="btn-primary">
            เพิ่ม
          </button>
        </form>

        <div className="space-y-2">
          {sites.length === 0 && <p className="py-3 text-center text-sm text-slate-500">ยังไม่มีสถานที่</p>}
          {sites.map((s) => (
            <div key={s.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2">
              <form action={saveSiteForm} className="grid flex-1 gap-2 md:grid-cols-[6rem_1fr_1fr_1fr_5rem_auto] md:items-end">
                <input type="hidden" name="company" value={companyId ?? ""} />
                <input type="hidden" name="id" value={s.id} />
                <input name="code" defaultValue={s.code ?? ""} className="input" placeholder="รหัส" />
                <input name="name" defaultValue={s.name} className="input" required />
                <input name="address" defaultValue={s.address ?? ""} className="input" placeholder="ที่อยู่" />
                <input
                  name="coords"
                  defaultValue={s.lat != null && s.lng != null ? `${s.lat}, ${s.lng}` : ""}
                  className="input"
                  placeholder="พิกัด / ลิงก์"
                />
                <input name="radius_m" type="number" defaultValue={s.radius_m ?? ""} className="input" placeholder="รัศมี" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-500" title="ปิดใช้งาน = ไม่แสดงในตัวเลือก">
                    <input type="checkbox" name="is_active" value="off" defaultChecked={!s.is_active} />
                    ปิด
                  </label>
                  <button type="submit" className="btn-secondary">
                    บันทึก
                  </button>
                </div>
              </form>
              {s.lat != null && s.lng != null ? (
                <a
                  href={googleMapsUrl(s.lat, s.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-600 hover:underline"
                >
                  📍 เปิดแผนที่
                </a>
              ) : (
                <span className="text-xs text-amber-600">ยังไม่มีพิกัด (ลงเวลาได้แต่ไม่ตรวจระยะ)</span>
              )}
              {s.company_id === null && <span className="badge bg-slate-100 text-slate-500">ของกลาง</span>}
              <form action={deleteSiteForm} className="flex items-center gap-2">
                <input type="hidden" name="company" value={companyId ?? ""} />
                <input type="hidden" name="id" value={s.id} />
                <label className="flex items-center gap-1 text-xs text-slate-400" title="ลบแม้ยังถูกใช้ในตารางเวร/ภารกิจ">
                  <input type="checkbox" name="force" />
                  บังคับ
                </label>
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบ
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- ประเภทงานนอกสถานที่ ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">ประเภทงานนอกสถานที่</h2>
          <p className="text-xs text-slate-500">
            ประเภทที่ &quot;นับชั่วโมง&quot; จะรวมเป็นชั่วโมงงานพิเศษในรายงาน (เช่น ออกบูธหลังเลิกงาน) ·
            ประเภทที่ไม่นับใช้บันทึกหลักฐานอย่างเดียว (เช่น ส่งรถระหว่างเวลางาน)
          </p>
        </div>

        <form action={saveFieldTaskTypeForm} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="company" value={companyId ?? ""} />
          <div className="min-w-48 flex-1">
            <input name="name" className="input" placeholder="เพิ่มประเภทงานใหม่" required />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
            <input type="checkbox" name="counts_hours" defaultChecked /> นับชั่วโมงพิเศษ
          </label>
          <button type="submit" className="btn-primary">
            เพิ่ม
          </button>
        </form>

        <div className="space-y-2">
          {taskTypes.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <form action={saveFieldTaskTypeForm} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="company" value={companyId ?? ""} />
                <input type="hidden" name="id" value={t.id} />
                <input name="name" defaultValue={t.name} className="input flex-1" required />
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="counts_hours" defaultChecked={t.counts_hours} /> นับชั่วโมง
                </label>
                <button type="submit" className="btn-secondary">
                  บันทึก
                </button>
              </form>
              {t.company_id === null && <span className="badge bg-slate-100 text-slate-500">ของกลาง</span>}
              <form action={deleteFieldTaskTypeForm}>
                <input type="hidden" name="company" value={companyId ?? ""} />
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบ
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

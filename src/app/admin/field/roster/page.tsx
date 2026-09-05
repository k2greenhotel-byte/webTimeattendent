import Link from "next/link";
import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
import { computeFieldSession } from "@/lib/attendance";
import {
  addDays,
  dateRange,
  dayOfWeek,
  formatThaiDate,
  monthBounds,
  thaiMonthShort,
  workDateOf,
} from "@/lib/datetime";
import {
  listBranches,
  listEmployees,
  listFieldTaskTypes,
  listFieldTasks,
  listPositions,
  listSites,
} from "@/lib/db";
import type { FieldTask } from "@/lib/types";
import {
  addCellForm,
  assignFieldRosterForm,
  clearFieldRosterForm,
  copyPreviousFieldRosterForm,
  removeCellForm,
} from "./actions";

export const dynamic = "force-dynamic";

const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** สีประจำสถานที่ (วนตามลำดับ) ให้แยกบูธแต่ละแห่งด้วยตาได้ */
const SITE_COLORS = [
  "bg-violet-100 text-violet-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-pink-100 text-pink-800",
  "bg-lime-100 text-lime-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
];

/** ตัวย่อชื่อสถานที่/งาน ให้พอใส่ช่องแคบ: ตัดคำนำหน้าที่ซ้ำ ๆ ออกแล้วเอา 5 ตัวแรก */
function shortName(name: string): string {
  const stripped = name.replace(/^(บูธ|สาขา|ห้าง)\s*/, "").trim();
  return (stripped || name).slice(0, 5);
}

function mondayOf(dateStr: string): string {
  const dow = dayOfWeek(dateStr);
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

type SearchParams = {
  company?: string;
  branch?: string;
  position?: string;
  site?: string;
  from?: string;
  view?: string;
  cell?: string;
  msg?: string;
  err?: string;
};

export default async function FieldRosterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "read");
  const scope = await getCompanyScope(params.company);
  const today = workDateOf();

  // ---- ช่วงที่ดู ----
  const view = params.view === "month" ? "month" : "week";
  let from: string;
  let to: string;
  if (view === "month") {
    const base = /^\d{4}-\d{2}/.test(params.from ?? "") ? params.from! : today;
    const [y, m] = base.split("-").map(Number);
    ({ from, to } = monthBounds(y, m));
  } else {
    from = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : today);
    to = addDays(from, 6);
  }
  const dates = dateRange(from, to);
  const days = dates.length;

  const branchId = params.branch || undefined;
  const positionId = params.position || undefined;
  const siteFilter = params.site || undefined;

  const [allBranches, positions, sites, types, allEmployees, tasks] = await Promise.all([
    listBranches(true, scope.companyId),
    listPositions(scope.companyId),
    listSites(scope.companyId, true),
    listFieldTaskTypes(scope.companyId),
    listEmployees({ activeOnly: true, branchId, companyId: scope.companyId }),
    listFieldTasks({ from, to, companyId: scope.companyId }),
  ]);
  // ผู้ใช้ที่เข้าด้วยสิทธิ์รายเมนู เห็นเฉพาะสาขาในขอบเขตของตัวเอง
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const employees = allEmployees.filter(
    (e) =>
      (!positionId || e.position_id === positionId) &&
      (!access.branchIds || (e.branch_id !== null && access.branchIds.has(e.branch_id))),
  );
  const { can_write: canWrite, can_edit: canEdit, can_delete: canDelete } = access.rights;
  const employeeIds = employees.map((e) => e.id);
  const visibleTasks = siteFilter ? tasks.filter((t) => t.site_id === siteFilter) : tasks;

  // ช่อง = งานทั้งหมดของคนนั้นวันนั้น
  const cell = new Map<string, FieldTask[]>();
  for (const t of visibleTasks) {
    for (const m of t.members) {
      const key = `${m.employee_id}|${t.work_date}`;
      cell.set(key, [...(cell.get(key) ?? []), t]);
    }
  }
  const colorOf = new Map(sites.map((s, i) => [s.id, SITE_COLORS[i % SITE_COLORS.length]]));

  // ---- ช่องที่กำลังแก้ ----
  const [editEmp, editDate] = (params.cell ?? "").split("_");
  const editing =
    editEmp && editDate && employees.some((e) => e.id === editEmp) && dates.includes(editDate)
      ? {
          employee: employees.find((e) => e.id === editEmp)!,
          date: editDate,
          mine: cell.get(`${editEmp}|${editDate}`) ?? [],
          others: tasks.filter((t) => t.work_date === editDate && !t.members.some((m) => m.employee_id === editEmp)),
        }
      : null;

  const baseQuery = (overrides: Partial<SearchParams>) => {
    const q = new URLSearchParams();
    const merged: SearchParams = {
      company: scope.companyId ?? "",
      branch: params.branch ?? "",
      position: params.position ?? "",
      site: params.site ?? "",
      from,
      view,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/field/roster?${q.toString()}`;
  };
  const prevHref = baseQuery({ from: view === "month" ? addDays(from, -1).slice(0, 7) + "-01" : addDays(from, -7) });
  const nextHref = baseQuery({ from: view === "month" ? addDays(to, 1) : addDays(from, 7) });

  const viewHidden = (
    <>
      <input type="hidden" name="view_company" value={scope.companyId ?? ""} />
      <input type="hidden" name="view_branch" value={params.branch ?? ""} />
      <input type="hidden" name="view_position" value={params.position ?? ""} />
      <input type="hidden" name="view_site" value={params.site ?? ""} />
      <input type="hidden" name="view_from" value={from} />
      <input type="hidden" name="view_view" value={view} />
    </>
  );

  const rangeLabel =
    view === "month"
      ? `${thaiMonthShort(Number(from.slice(5, 7)))} ${Number(from.slice(0, 4)) + 543}`
      : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;

  /** ฟิลด์ "งานที่จะจัด" ใช้ทั้งฟอร์มจัดเป็นชุดและเพิ่มทีละช่อง */
  const TaskSpecFields = ({ prefix }: { prefix: string }) => (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor={`${prefix}_type`}>
          ประเภทงาน
        </label>
        <select id={`${prefix}_type`} name="type_id" className="input" defaultValue={types[0]?.id ?? ""} required>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.counts_hours ? "" : " (ไม่นับชั่วโมง)"}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-40 flex-1">
        <label className="label" htmlFor={`${prefix}_site`}>
          สถานที่
        </label>
        <select id={`${prefix}_site`} name="site_id" className="input" defaultValue={siteFilter ?? sites[0]?.id ?? ""}>
          <option value="">— พิมพ์เอง —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              📍 {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor={`${prefix}_place`}>
          หรือพิมพ์ชื่อสถานที่
        </label>
        <input id={`${prefix}_place`} name="place_text" className="input" placeholder="เช่น งานวัด" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}_start`}>
          เริ่ม (แผน)
        </label>
        <input id={`${prefix}_start`} name="planned_start" type="time" className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}_end`}>
          จบ (แผน)
        </label>
        <input id={`${prefix}_end`} name="planned_end" type="time" className="input" />
      </div>
    </div>
  );

  return (
    <>
    {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตารางงานนอกสถานที่</h1>
          <p className="text-sm text-slate-500">
            จัดว่าใครประจำบูธไหนวันไหน แบบเดียวกับตารางเวร · คนที่อยู่บูธเดียวกันวันเดียวกันถูกรวมเป็นงานเดียว
            {scope.companyName ? ` · ${scope.companyName}` : ""}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="btn-primary pointer-events-none">ตารางรายวัน</span>
          <Link href={`/admin/field?company=${scope.companyId ?? ""}`} className="btn-secondary">
            รายการงาน / บันทึกเวลาให้
          </Link>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {sites.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ยังไม่มีสถานที่ปฏิบัติงาน — เพิ่มบูธที่{" "}
          <Link href="/admin/setup" className="underline">
            ตั้งค่าข้อมูลหลัก
          </Link>{" "}
          ก่อน (หรือพิมพ์ชื่อสถานที่เองในฟอร์มก็ได้)
        </p>
      )}

      {/* ---------- ตัวกรอง ---------- */}
      <form method="get" className="card flex flex-wrap items-end gap-3">
        <CompanyFilter companies={scope.companies} value={scope.companyId} />
        <BranchFilter branches={branches} value={params.branch} />
        <div>
          <label className="label" htmlFor="position">
            ตำแหน่ง
          </label>
          <select id="position" name="position" defaultValue={params.position ?? ""} className="input">
            <option value="">ทุกตำแหน่ง</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="site">
            สถานที่
          </label>
          <select id="site" name="site" defaultValue={params.site ?? ""} className="input">
            <option value="">ทุกสถานที่</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">
            {view === "month" ? "เดือน" : "วันที่ในสัปดาห์"}
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="view">
            มุมมอง
          </label>
          <select id="view" name="view" defaultValue={view} className="input">
            <option value="week">รายสัปดาห์</option>
            <option value="month">รายเดือน</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          แสดง
        </button>
      </form>

      {/* ---------- จัดเป็นชุด ---------- */}
      {canWrite && (
      <details className="card" open={!editing}>
        <summary className="cursor-pointer font-semibold text-slate-800">จัดเป็นชุด (หลายคน หลายวัน ครั้งเดียว)</summary>
        <form action={assignFieldRosterForm} className="mt-3 grid gap-3 md:grid-cols-[minmax(14rem,1fr)_2fr]">
          {viewHidden}
          <div>
            <label className="label" htmlFor="employee_ids">
              พนักงาน (กด Ctrl/⌘ เพื่อเลือกหลายคน)
            </label>
            <select
              id="employee_ids"
              name="employee_ids"
              multiple
              size={Math.min(10, Math.max(4, employees.length))}
              className="input h-auto"
              required
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emp_code} · {e.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <TaskSpecFields prefix="bulk" />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="bulk_from">
                  ตั้งแต่
                </label>
                <input id="bulk_from" name="from" type="date" defaultValue={from} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="bulk_to">
                  ถึง
                </label>
                <input id="bulk_to" name="to" type="date" defaultValue={to} className="input" required />
              </div>
              <div>
                <span className="label">เฉพาะวัน</span>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <label
                      key={d}
                      className="flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm sm:min-h-0 sm:py-1"
                    >
                      <input type="checkbox" name="weekdays" value={d} defaultChecked />
                      {THAI_DOW[d]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="bulk_note">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input id="bulk_note" name="note" className="input" />
              </div>
              <button type="submit" className="btn-primary" disabled={employees.length === 0 || types.length === 0}>
                บันทึกตาราง
              </button>
            </div>
          </div>
        </form>
      </details>
      )}

      {/* ---------- แก้ทีละช่อง ---------- */}
      {canEdit && editing && (
        <section className="card space-y-3 border-brand-500 ring-2 ring-brand-100">
          <p className="font-semibold text-slate-800">
            {editing.employee.full_name} · {formatThaiDate(editing.date)}
          </p>

          {editing.mine.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {editing.mine.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <span className="badge bg-violet-100 text-violet-800">{t.type_name}</span>
                  <span>
                    {t.title} · 📍 {t.site_name ?? t.place_text}
                    {t.planned_start ? ` · ${t.planned_start}–${t.planned_end ?? "?"}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">({t.members.length} คน)</span>
                  <form action={removeCellForm} className="ml-auto">
                    {viewHidden}
                    <input type="hidden" name="employee_id" value={editing.employee.id} />
                    <input type="hidden" name="task_id" value={t.id} />
                    <button type="submit" className="text-xs text-rose-600 hover:underline">
                      เอาออกจากงานนี้
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">วันนี้ยังไม่มีงานนอกสถานที่</p>
          )}

          <form action={addCellForm} className="space-y-3 border-t border-slate-100 pt-3">
            {viewHidden}
            <input type="hidden" name="employee_id" value={editing.employee.id} />
            <input type="hidden" name="work_date" value={editing.date} />
            <div className="min-w-48">
              <label className="label" htmlFor="cell_task">
                เพิ่มเข้างานที่มีอยู่แล้ววันนี้
              </label>
              <select id="cell_task" name="task_id" className="input" defaultValue="">
                <option value="">— สร้าง/หางานตามรายละเอียดด้านล่าง —</option>
                {editing.others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.type_name} · {t.site_name ?? t.place_text} {t.planned_start ? `${t.planned_start}–${t.planned_end ?? "?"}` : ""} ({t.members.length} คน)
                  </option>
                ))}
              </select>
            </div>
            <TaskSpecFields prefix="cell" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                เพิ่มงาน
              </button>
              <Link href={baseQuery({ cell: "" })} className="btn-secondary">
                ปิด
              </Link>
            </div>
          </form>
        </section>
      )}

      {/* ---------- ตาราง ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href={prevHref} className="btn-secondary" aria-label="ช่วงก่อนหน้า">
              ‹
            </Link>
            <h2 className="font-semibold text-slate-800">{rangeLabel}</h2>
            <Link href={nextHref} className="btn-secondary" aria-label="ช่วงถัดไป">
              ›
            </Link>
          </div>
          <p className="text-xs text-slate-500">{employees.length} คน · คลิกช่องเพื่อเพิ่ม/เอาออกทีละวัน</p>
        </div>

        {employees.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">ไม่มีพนักงานตามตัวกรองที่เลือก</p>
        ) : (
          <div className="table-wrap">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 text-left">พนักงาน</th>
                  {dates.map((d) => {
                    const dow = dayOfWeek(d);
                    const weekend = dow === 0 || dow === 6;
                    const count = visibleTasks
                      .filter((t) => t.work_date === d)
                      .reduce((n, t) => n + t.members.filter((m) => employeeIds.includes(m.employee_id)).length, 0);
                    return (
                      <th
                        key={d}
                        className={`${weekend ? "bg-rose-50 text-rose-700" : ""} ${d === today ? "ring-2 ring-inset ring-brand-500" : ""}`}
                      >
                        <div className="text-[11px] font-normal">{THAI_DOW[dow]}</div>
                        <div>{Number(d.slice(8, 10))}</div>
                        <div className="text-[10px] font-normal text-slate-400">{count > 0 ? `${count} คน` : ""}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 bg-white text-left">
                      <div className="font-medium text-slate-800">{e.full_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {e.emp_code}
                        {e.position_name ? ` · ${e.position_name}` : ""}
                      </div>
                    </td>
                    {dates.map((d) => {
                      const mine = cell.get(`${e.id}|${d}`) ?? [];
                      const isEditing = editing?.employee.id === e.id && editing.date === d;
                      return (
                        <td key={d} className={`p-0.5 align-top ${isEditing ? "ring-2 ring-inset ring-brand-500" : ""}`}>
                          <Link
                            href={baseQuery({ cell: `${e.id}_${d}` })}
                            className="block min-w-14 space-y-0.5 rounded-md px-0.5 py-1 hover:ring-2 hover:ring-brand-300"
                          >
                            {mine.length === 0 && <span className="text-xs text-slate-300">–</span>}
                            {mine.map((t) => {
                              const me = t.members.find((m) => m.employee_id === e.id);
                              const s = computeFieldSession({
                                workDate: t.work_date,
                                startAt: me?.start?.punched_at,
                                endAt: me?.end?.punched_at,
                                plannedStart: t.planned_start,
                                countsHours: t.counts_hours,
                              });
                              const mark = s.status === "done" ? " ✓" : s.status === "in_progress" ? " ●" : s.status === "missing_end" ? " !" : "";
                              const cls = t.site_id ? (colorOf.get(t.site_id) ?? "bg-slate-100 text-slate-700") : "bg-slate-100 text-slate-700";
                              return (
                                <span
                                  key={t.id}
                                  className={`block truncate rounded px-1 text-[11px] font-medium ${cls}`}
                                  title={`${t.type_name} · ${t.title} · ${t.site_name ?? t.place_text ?? ""}${t.planned_start ? ` ${t.planned_start}–${t.planned_end ?? "?"}` : ""}`}
                                >
                                  {shortName(t.site_name ?? t.place_text ?? t.type_name)}
                                  {mark}
                                </span>
                              );
                            })}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          {sites.map((s) => (
            <span key={s.id} className={`badge ${colorOf.get(s.id)}`}>
              {shortName(s.name)} = {s.name}
            </span>
          ))}
          <span className="badge bg-slate-100 text-slate-700">✓ เสร็จ · ● กำลังทำ · ! ไม่ได้กดจบ</span>
        </div>
      </section>

      {/* ---------- เครื่องมือช่วยจัด ---------- */}
      {employees.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {canWrite && (
          <form action={copyPreviousFieldRosterForm} className="card space-y-2">
            {viewHidden}
            {employeeIds.map((id) => (
              <input key={id} type="hidden" name="employee_ids" value={id} />
            ))}
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="days" value={days} />
            <p className="font-semibold text-slate-800">คัดลอกจาก{view === "month" ? "ช่วงก่อนหน้า" : "สัปดาห์ก่อน"}</p>
            <p className="text-xs text-slate-500">
              นำตาราง {formatThaiDate(addDays(from, -days))} – {formatThaiDate(addDays(from, -1))} ของ {employees.length} คนในมุมมองนี้
              {siteFilter ? " (เฉพาะสถานที่ที่กรอง)" : ""} มาใส่ช่วง {rangeLabel} — งานเดิม สมาชิกเดิม วันต่อวัน
            </p>
            <button type="submit" className="btn-secondary">
              คัดลอก
            </button>
          </form>

          )}
          {canDelete && (
          <form action={clearFieldRosterForm} className="card space-y-2">
            {viewHidden}
            {employeeIds.map((id) => (
              <input key={id} type="hidden" name="employee_ids" value={id} />
            ))}
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <p className="font-semibold text-slate-800">ล้างตารางช่วงนี้</p>
            <p className="text-xs text-slate-500">
              เอา {employees.length} คนในมุมมองนี้ออกจากงานนอกสถานที่ทั้งหมดในช่วง {rangeLabel}
              {siteFilter ? " (เฉพาะสถานที่ที่กรอง)" : ""} — งานที่ไม่เหลือใครจะถูกลบ พร้อมการลงเวลาและรูปของงานนั้น
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" /> ยืนยันว่าต้องการล้าง
            </label>
            <button type="submit" className="btn-danger">
              ล้างตาราง
            </button>
          </form>
          )}
        </section>
      )}
    </main>
    </>
  );
}

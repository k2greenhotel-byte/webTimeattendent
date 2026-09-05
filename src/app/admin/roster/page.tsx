import Link from "next/link";
import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import { requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
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
  listAssignments,
  listBranches,
  listEmployees,
  listPositions,
  listSchedules,
  listSites,
} from "@/lib/db";
import type { ShiftAssignment, WorkSchedule } from "@/lib/types";
import { assignShiftsForm, clearRangeForm, copyPreviousForm, saveCellForm } from "./actions";

export const dynamic = "force-dynamic";

const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** สีประจำกะ วนตามลำดับกะของบริษัท (พอให้แยกกันด้วยตาได้ในตาราง) */
const SHIFT_COLORS = [
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-pink-100 text-pink-800",
  "bg-lime-100 text-lime-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
];

/** ตัวย่อกะที่พอใส่ในช่องแคบ ๆ: ตัด "กะ" นำหน้าออกแล้วเอา 4 ตัวแรก */
function shortName(name: string): string {
  const stripped = name.replace(/^กะ\s*/, "").trim();
  return (stripped || name).slice(0, 4);
}

/** จันทร์ของสัปดาห์ที่วันที่นี้อยู่ */
function mondayOf(dateStr: string): string {
  const dow = dayOfWeek(dateStr);
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

type SearchParams = {
  company?: string;
  branch?: string;
  position?: string;
  from?: string;
  view?: string;
  edit?: string;
  msg?: string;
  err?: string;
};

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const access = await requireMenuAccess("ATT_ROSTER", "read");
  const scope = await getCompanyScope(params.company);
  const today = workDateOf();

  // ---- ช่วงที่ดู: สัปดาห์ (จันทร์–อาทิตย์) หรือทั้งเดือน ----
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

  const [allBranches, positions, schedules, allEmployees, sites] = await Promise.all([
    listBranches(true, scope.companyId),
    listPositions(scope.companyId),
    listSchedules(scope.companyId),
    listEmployees({ activeOnly: true, branchId, companyId: scope.companyId }),
    listSites(scope.companyId, true),
  ]);
  // ผู้ใช้ที่เข้าด้วยสิทธิ์รายเมนู เห็นเฉพาะสาขาในขอบเขตของตัวเอง
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const { can_write: canWrite, can_edit: canEdit, can_delete: canDelete } = access.rights;

  /** ช่องเลือกสถานที่ (ว่าง = สาขาตัวเอง) ใช้ทั้งฟอร์มจัดเป็นชุดและแก้ทีละช่อง */
  const SiteSelect = ({ id, value }: { id: string; value?: string | null }) => (
    <div className="min-w-40 flex-1">
      <label className="label" htmlFor={id}>
        สถานที่ (ถ้าไปประจำที่อื่น)
      </label>
      <select id={id} name="site_id" className="input" defaultValue={value ?? ""}>
        <option value="">สาขาตัวเอง</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            📍 {s.name}
          </option>
        ))}
      </select>
    </div>
  );
  const employees = allEmployees.filter(
    (e) =>
      (!positionId || e.position_id === positionId) &&
      (!access.branchIds || (e.branch_id !== null && access.branchIds.has(e.branch_id))),
  );
  const employeeIds = employees.map((e) => e.id);

  const assignments =
    employeeIds.length > 0 ? await listAssignments({ from, to, employeeIds }) : [];
  const cell = new Map<string, ShiftAssignment>(
    assignments.map((a) => [`${a.employee_id}|${a.work_date}`, a]),
  );

  const colorOf = new Map<string, string>(
    schedules.map((s, i) => [s.id, SHIFT_COLORS[i % SHIFT_COLORS.length]]),
  );
  const scheduleById = new Map<string, WorkSchedule>(schedules.map((s) => [s.id, s]));

  // ---- ช่องที่กำลังแก้ (?edit=<employeeId>_<date>) ----
  const [editEmp, editDate] = (params.edit ?? "").split("_");
  const editing =
    editEmp && editDate && employees.some((e) => e.id === editEmp) && dates.includes(editDate)
      ? { employee: employees.find((e) => e.id === editEmp)!, date: editDate, current: cell.get(`${editEmp}|${editDate}`) ?? null }
      : null;

  // ---- ลิงก์นำทางที่คงตัวกรองไว้ ----
  const baseQuery = (overrides: Partial<SearchParams>) => {
    const q = new URLSearchParams();
    const merged: SearchParams = {
      company: scope.companyId ?? "",
      branch: params.branch ?? "",
      position: params.position ?? "",
      from,
      view,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/roster?${q.toString()}`;
  };
  const prevHref = baseQuery({
    from: view === "month" ? addDays(from, -1).slice(0, 7) + "-01" : addDays(from, -7),
  });
  const nextHref = baseQuery({
    from: view === "month" ? addDays(to, 1) : addDays(from, 7),
  });

  const viewHidden = (
    <>
      <input type="hidden" name="view_company" value={scope.companyId ?? ""} />
      <input type="hidden" name="view_branch" value={params.branch ?? ""} />
      <input type="hidden" name="view_position" value={params.position ?? ""} />
      <input type="hidden" name="view_from" value={from} />
      <input type="hidden" name="view_view" value={view} />
    </>
  );

  const rangeLabel =
    view === "month"
      ? `${thaiMonthShort(Number(from.slice(5, 7)))} ${Number(from.slice(0, 4)) + 543}`
      : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;

  return (
    <>
    {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตารางเวร</h1>
        <p className="text-sm text-slate-500">
          กำหนดว่าพนักงานคนไหนอยู่กะไหนในแต่ละวัน · คนที่ไม่ได้จัดเวร (ช่องว่าง) ใช้กะของสาขาตามเดิม
          {scope.companyName ? ` · ${scope.companyName}` : ""}
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
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

      {schedules.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          บริษัทนี้ยังไม่มีกะทำงาน — ไปสร้างกะ (เช่น กะเช้า/กะบ่าย/กะดึก) ที่{" "}
          <Link href="/admin/setup" className="underline">
            ตั้งค่าข้อมูลหลัก
          </Link>{" "}
          ก่อน
        </p>
      )}

      {/* ---------- จัดเวรเป็นชุด ---------- */}
      {canWrite && (
      <details className="card" open={!editing}>
        <summary className="cursor-pointer font-semibold text-slate-800">
          จัดเวรเป็นชุด (หลายคน หลายวัน ครั้งเดียว)
        </summary>
        <form action={assignShiftsForm} className="mt-3 grid gap-3 md:grid-cols-[minmax(14rem,1fr)_2fr]">
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
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <label className="label" htmlFor="shift">
                  กะ
                </label>
                <select id="shift" name="shift" className="input">
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.work_start}–{s.work_end})
                    </option>
                  ))}
                  <option value="branch">ใช้กะสาขา (ระบุแค่สถานที่)</option>
                  <option value="off">หยุดเวร (OFF)</option>
                  <option value="">ล้าง (กลับไปใช้กะสาขา)</option>
                </select>
              </div>
              <SiteSelect id="bulk_site" />
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

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="bulk_note">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input id="bulk_note" name="note" className="input" placeholder="เช่น ตารางเวรเดือนนี้" />
              </div>
              <button type="submit" className="btn-primary" disabled={employees.length === 0}>
                บันทึกตารางเวร
              </button>
            </div>
          </div>
        </form>
      </details>
      )}

      {/* ---------- แก้ทีละช่อง ---------- */}
      {canEdit && editing && (
        <form action={saveCellForm} className="card space-y-3 border-brand-500 ring-2 ring-brand-100">
          {viewHidden}
          <input type="hidden" name="employee_id" value={editing.employee.id} />
          <input type="hidden" name="work_date" value={editing.date} />
          <p className="font-semibold text-slate-800">
            แก้เวร: {editing.employee.full_name} · {formatThaiDate(editing.date)}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor="cell_shift">
                กะ
              </label>
              <select
                id="cell_shift"
                name="shift"
                className="input"
                defaultValue={
                  editing.current
                    ? editing.current.is_day_off
                      ? "off"
                      : (editing.current.schedule_id ?? (editing.current.site_id ? "branch" : ""))
                    : ""
                }
              >
                <option value="">ใช้กะสาขา (ไม่จัดเวร)</option>
                <option value="branch">ใช้กะสาขา (ระบุแค่สถานที่)</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.work_start}–{s.work_end})
                  </option>
                ))}
                <option value="off">หยุดเวร (OFF)</option>
              </select>
            </div>
            <SiteSelect id="cell_site" value={editing.current?.site_id} />
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="cell_note">
                หมายเหตุ
              </label>
              <input
                id="cell_note"
                name="note"
                className="input"
                defaultValue={editing.current?.note ?? ""}
                placeholder="เช่น แลกเวรกับ..."
              />
            </div>
            <button type="submit" className="btn-primary">
              บันทึก
            </button>
            <Link href={baseQuery({ edit: "" })} className="btn-secondary">
              ยกเลิก
            </Link>
          </div>
        </form>
      )}

      {/* ---------- ตารางเวร ---------- */}
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
          <p className="text-xs text-slate-500">
            {employees.length} คน · คลิกช่องเพื่อแก้ทีละวัน
          </p>
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
                    return (
                      <th
                        key={d}
                        className={`${weekend ? "bg-rose-50 text-rose-700" : ""} ${d === today ? "ring-2 ring-inset ring-brand-500" : ""}`}
                      >
                        <div className="text-[11px] font-normal">{THAI_DOW[dow]}</div>
                        <div>{Number(d.slice(8, 10))}</div>
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
                      const a = cell.get(`${e.id}|${d}`);
                      const isEditing = editing?.employee.id === e.id && editing.date === d;
                      let label = "";
                      let cls = "text-slate-300";
                      if (a?.is_day_off) {
                        label = "OFF";
                        cls = "bg-slate-200 text-slate-700";
                      } else if (a?.schedule_id) {
                        const s = scheduleById.get(a.schedule_id);
                        label = shortName(s?.name ?? a.schedule_name ?? "?");
                        cls = colorOf.get(a.schedule_id) ?? "bg-slate-100 text-slate-700";
                      } else if (a?.site_id) {
                        cls = "bg-violet-100 text-violet-800";
                      }
                      if (a?.site_id && !a.is_day_off) label = `📍${label}`;
                      const title = [a?.site_name ? `ประจำที่ ${a.site_name}` : "", a?.note ?? ""]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <td key={d} className={`p-0.5 ${isEditing ? "ring-2 ring-inset ring-brand-500" : ""}`}>
                          <Link
                            href={baseQuery({ edit: `${e.id}_${d}` })}
                            title={title || (a ? "" : "ใช้กะสาขา")}
                            className={`block min-w-11 rounded-md px-1 py-1.5 text-xs font-medium hover:ring-2 hover:ring-brand-300 ${cls}`}
                          >
                            {label || "–"}
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

        {schedules.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {schedules.map((s) => (
              <span key={s.id} className={`badge ${colorOf.get(s.id)}`}>
                {shortName(s.name)} = {s.name} {s.work_start}–{s.work_end}
              </span>
            ))}
            <span className="badge bg-slate-200 text-slate-700">OFF = หยุดเวร</span>
            <span className="badge bg-violet-100 text-violet-800">📍 = ไปประจำนอกสถานที่ (GPS ตรวจที่นั่น)</span>
            <span className="badge bg-slate-50 text-slate-500">– = ใช้กะสาขา</span>
          </div>
        )}
      </section>

      {/* ---------- เครื่องมือช่วยจัด ---------- */}
      {employees.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {canWrite && (
          <form action={copyPreviousForm} className="card space-y-2">
            {viewHidden}
            {employeeIds.map((id) => (
              <input key={id} type="hidden" name="employee_ids" value={id} />
            ))}
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="days" value={days} />
            <p className="font-semibold text-slate-800">คัดลอกจาก{view === "month" ? "ช่วงก่อนหน้า" : "สัปดาห์ก่อน"}</p>
            <p className="text-xs text-slate-500">
              นำตารางเวรของ {formatThaiDate(addDays(from, -days))} – {formatThaiDate(addDays(from, -1))}{" "}
              ของ {employees.length} คนในมุมมองนี้ มาใส่ช่วง {rangeLabel} (ทับช่องที่มีอยู่)
            </p>
            <button type="submit" className="btn-secondary">
              คัดลอก
            </button>
          </form>

          )}
          {canDelete && (
          <form action={clearRangeForm} className="card space-y-2">
            {viewHidden}
            {employeeIds.map((id) => (
              <input key={id} type="hidden" name="employee_ids" value={id} />
            ))}
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <p className="font-semibold text-slate-800">ล้างตารางเวรช่วงนี้</p>
            <p className="text-xs text-slate-500">
              ลบตารางเวรของ {employees.length} คนในมุมมองนี้ ช่วง {rangeLabel} ทั้งหมด — ทุกคนจะกลับไปใช้กะสาขา
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" /> ยืนยันว่าต้องการล้าง
            </label>
            <button type="submit" className="btn-danger">
              ล้างตารางเวร
            </button>
          </form>
          )}
        </section>
      )}
    </main>
    </>
  );
}

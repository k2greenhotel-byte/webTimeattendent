import Link from "next/link";
import AttStaffNav from "@/components/AttStaffNav";
import BranchFilter from "@/components/BranchFilter";
import CompanyFilter from "@/components/CompanyFilter";
import FieldReportTable from "@/components/FieldReportTable";
import { requireMenuAccess } from "@/lib/att-access";
import { getCompanyScope } from "@/lib/att-scope";
import { addDays, formatDuration, formatThaiDate, workDateOf } from "@/lib/datetime";
import { getFieldTask, listBranches, listEmployees, listFieldTaskTypes, listSites } from "@/lib/db";
import { buildFieldReport } from "@/lib/reports";
import type { FieldTask } from "@/lib/types";
import {
  cancelFieldTaskForm,
  createFieldTaskForm,
  deleteFieldPunchForm,
  deleteFieldTaskForm,
  manualFieldPunchForm,
  updateFieldTaskForm,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  company?: string;
  branch?: string;
  from?: string;
  to?: string;
  type?: string;
  edit?: string;
  punch?: string;
  msg?: string;
  err?: string;
};

export default async function FieldPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const access = await requireMenuAccess("ATT_FIELD", "read");
  const scope = await getCompanyScope(params.company);
  const today = workDateOf();

  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") ? params.from! : addDays(today, -7);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to! : addDays(today, 14);
  const branchId = params.branch || undefined;
  const typeId = params.type || undefined;

  const [allBranches, allEmployees, types, sites, report] = await Promise.all([
    listBranches(true, scope.companyId),
    listEmployees({ activeOnly: true, companyId: scope.companyId }),
    listFieldTaskTypes(scope.companyId),
    listSites(scope.companyId, true),
    buildFieldReport({ from, to, companyId: scope.companyId, branchId, typeId }),
  ]);
  // ผู้ใช้ที่เข้าด้วยสิทธิ์รายเมนู เห็นเฉพาะสาขา/พนักงานในขอบเขตของตัวเอง
  const branches = access.branchIds ? allBranches.filter((b) => access.branchIds!.has(b.id)) : allBranches;
  const employees = access.branchIds
    ? allEmployees.filter((e) => e.branch_id !== null && access.branchIds!.has(e.branch_id))
    : allEmployees;
  const { can_write: canWrite, can_edit: canEdit, can_delete: canDelete } = access.rights;

  // ภารกิจที่กำลังแก้ไข / สมาชิกที่กำลังบันทึกเวลาให้
  const editing: FieldTask | null = params.edit ? await getFieldTask(params.edit) : null;
  const [punchTaskId, punchEmpId] = (params.punch ?? "").split("_");
  const punching = punchTaskId && punchEmpId ? await getFieldTask(punchTaskId) : null;
  const punchMember = punching?.members.find((m) => m.employee_id === punchEmpId) ?? null;

  const viewHidden = (
    <>
      <input type="hidden" name="view_company" value={scope.companyId ?? ""} />
      <input type="hidden" name="view_branch" value={params.branch ?? ""} />
      <input type="hidden" name="view_from" value={from} />
      <input type="hidden" name="view_to" value={to} />
      <input type="hidden" name="view_type" value={params.type ?? ""} />
    </>
  );

  const baseQuery = (overrides: Partial<SearchParams>) => {
    const q = new URLSearchParams();
    const merged: SearchParams = {
      company: scope.companyId ?? "",
      branch: params.branch ?? "",
      from,
      to,
      type: params.type ?? "",
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/field?${q.toString()}`;
  };

  /** ฟอร์มภารกิจ ใช้ทั้งสร้างและแก้ไข */
  const TaskForm = ({ task }: { task: FieldTask | null }) => (
    <form
      action={task ? updateFieldTaskForm : createFieldTaskForm}
      className={`card space-y-3 ${task ? "border-brand-500 ring-2 ring-brand-100" : ""}`}
    >
      {viewHidden}
      {task && <input type="hidden" name="id" value={task.id} />}
      <p className="font-semibold text-slate-800">{task ? `แก้ไขภารกิจ: ${task.title}` : "สร้างภารกิจใหม่"}</p>

      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_2fr]">
        <div>
          <label className="label" htmlFor={`${task ? "e" : "c"}_employee_ids`}>
            พนักงาน (กด Ctrl/⌘ เลือกหลายคน)
          </label>
          <select
            id={`${task ? "e" : "c"}_employee_ids`}
            name="employee_ids"
            multiple
            size={Math.min(10, Math.max(4, employees.length))}
            className="input h-auto"
            defaultValue={task ? task.members.map((m) => m.employee_id) : []}
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
              <label className="label">ประเภทงาน</label>
              <select name="type_id" className="input" defaultValue={task?.type_id ?? types[0]?.id ?? ""} required>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.counts_hours ? "" : " (ไม่นับชั่วโมง)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-48 flex-1">
              <label className="label">ชื่องาน</label>
              <input name="title" className="input" defaultValue={task?.title ?? ""} placeholder="เช่น ออกบูธงานมอเตอร์โชว์" />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <label className="label">สถานที่</label>
              <select name="site_id" className="input" defaultValue={task?.site_id ?? ""}>
                <option value="">— พิมพ์เองด้านขวา —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-48 flex-1">
              <label className="label">หรือพิมพ์ชื่อสถานที่</label>
              <input name="place_text" className="input" defaultValue={task?.place_text ?? ""} placeholder="เช่น บ้านลูกค้า" />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">วันที่</label>
              <input name="work_date" type="date" className="input" defaultValue={task?.work_date ?? today} required />
            </div>
            <div>
              <label className="label">เริ่ม (แผน)</label>
              <input name="planned_start" type="time" className="input" defaultValue={task?.planned_start ?? ""} />
            </div>
            <div>
              <label className="label">จบ (แผน)</label>
              <input name="planned_end" type="time" className="input" defaultValue={task?.planned_end ?? ""} />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
              <input type="hidden" name="counts_hours" value="false" />
              <input type="checkbox" name="counts_hours" value="true" defaultChecked={task ? task.counts_hours : true} />
              นับเป็นชั่วโมงงานพิเศษ
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="label">หมายเหตุ</label>
              <input name="note" className="input" defaultValue={task?.note ?? ""} />
            </div>
            <button type="submit" className="btn-primary">
              {task ? "บันทึกการแก้ไข" : "สร้างภารกิจ"}
            </button>
            {task && (
              <Link href={baseQuery({ edit: "" })} className="btn-secondary">
                ยกเลิก
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );

  return (
    <>
    {!access.viaAdmin && access.user && <AttStaffNav user={access.user} />}
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานนอกสถานที่</h1>
          <p className="text-sm text-slate-500">
            มอบหมายงานออกบูธ ส่งรถ หรืองานพิเศษนอกเวลา · พนักงานกดเริ่ม/จบพร้อมถ่ายรูปจากหน้าลงเวลา ·
            งานที่ &quot;นับชั่วโมง&quot; จะรวมเป็น <strong>ชั่วโมงงานพิเศษ</strong> แยกจาก OT ปกติ
            {scope.companyName ? ` · ${scope.companyName}` : ""}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/field/roster?company=${scope.companyId ?? ""}`} className="btn-secondary">
            ตารางรายวัน (ใครประจำบูธไหน)
          </Link>
          <span className="btn-primary pointer-events-none">รายการงาน</span>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {(types.length === 0 || sites.length === 0) && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {types.length === 0 ? "ยังไม่มีประเภทงาน" : "ยังไม่มีสถานที่ปฏิบัติงาน"} — เพิ่มได้ที่{" "}
          <Link href="/admin/setup" className="underline">
            ตั้งค่าข้อมูลหลัก
          </Link>{" "}
          (พิมพ์ชื่อสถานที่เองในภารกิจได้เช่นกัน)
        </p>
      )}

      {/* ---------- ตัวกรอง ---------- */}
      <form method="get" className="card flex flex-wrap items-end gap-3">
        <CompanyFilter companies={scope.companies} value={scope.companyId} />
        <BranchFilter branches={branches} value={params.branch} />
        <div>
          <label className="label" htmlFor="type">
            ประเภท
          </label>
          <select id="type" name="type" defaultValue={params.type ?? ""} className="input">
            <option value="">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">
            ตั้งแต่
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            ถึง
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="input" />
        </div>
        <button type="submit" className="btn-secondary">
          แสดง
        </button>
      </form>

      {/* ---------- สร้าง / แก้ไข ---------- */}
      {editing && canEdit ? (
        <TaskForm task={editing} />
      ) : canWrite ? (
        <details className="card" open={!punching}>
          <summary className="cursor-pointer font-semibold text-slate-800">สร้างภารกิจใหม่</summary>
          <div className="mt-3 -m-4">
            <TaskForm task={null} />
          </div>
        </details>
      ) : null}

      {/* ---------- บันทึกเวลาให้ ---------- */}
      {canEdit && punching && punchMember && (
        <form action={manualFieldPunchForm} className="card space-y-3 border-amber-400 ring-2 ring-amber-100">
          {viewHidden}
          <input type="hidden" name="task_id" value={punching.id} />
          <input type="hidden" name="employee_id" value={punchMember.employee_id} />
          <input type="hidden" name="work_date" value={punching.work_date} />
          <p className="font-semibold text-slate-800">
            บันทึกเวลาให้: {punchMember.full_name} · {punching.title} · {formatThaiDate(punching.work_date)}
          </p>
          <p className="text-xs text-slate-500">
            ใช้เมื่อพนักงานลงเวลาไม่ได้ (มือถือมีปัญหา/ลืมกดจบ) เวลาที่กรอกจะติดธง &quot;แก้ไข&quot; · เว้นว่างช่องที่ไม่ต้องการเปลี่ยน
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">เวลาเริ่ม</label>
              <input name="start_time" type="time" className="input" defaultValue={punchMember.start?.punched_at ? "" : (punching.planned_start ?? "")} />
            </div>
            <div>
              <label className="label">เวลาจบ</label>
              <input name="end_time" type="time" className="input" defaultValue={punchMember.end?.punched_at ? "" : (punching.planned_end ?? "")} />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
              <input type="checkbox" name="end_next_day" /> จบวันถัดไป (งานเลิกหลังเที่ยงคืน)
            </label>
            <div className="min-w-48 flex-1">
              <label className="label">เหตุผล</label>
              <input name="note" className="input" placeholder="เช่น มือถือแบตหมด" />
            </div>
            <button type="submit" className="btn-primary">
              บันทึก
            </button>
            <Link href={baseQuery({ punch: "" })} className="btn-secondary">
              ปิด
            </Link>
          </div>
          {(punchMember.start || punchMember.end) && (
            <div className="flex flex-wrap gap-3 text-xs">
              {(["start", "end"] as const).map((type) =>
                punchMember[type] ? (
                  <form key={type} action={deleteFieldPunchForm} className="inline">
                    {viewHidden}
                    <input type="hidden" name="task_id" value={punching.id} />
                    <input type="hidden" name="employee_id" value={punchMember.employee_id} />
                    <input type="hidden" name="punch_type" value={type} />
                    <button type="submit" className="text-rose-600 hover:underline">
                      ลบเวลา{type === "start" ? "เริ่ม" : "จบ"}ที่บันทึกไว้
                    </button>
                  </form>
                ) : null,
              )}
            </div>
          )}
        </form>
      )}

      {/* ---------- รายการ ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">
            ภารกิจ {formatThaiDate(from)} – {formatThaiDate(to)} ({report.rows.length} รายการ)
          </h2>
          <p className="text-sm text-slate-600">
            ชั่วโมงงานพิเศษรวม <strong>{formatDuration(report.totalMinutes)}</strong>
          </p>
        </div>

        <FieldReportTable
          rows={report.rows}
          showEmployee
          renderActions={(r) => (
            <div className="flex flex-col gap-1 text-xs">
              {canEdit && (<>
              <Link href={baseQuery({ edit: r.task.id, punch: "" })} className="text-brand-600 hover:underline">
                แก้ไขงาน
              </Link>
              <Link
                href={baseQuery({ punch: `${r.task.id}_${r.employeeId}`, edit: "" })}
                className="text-amber-700 hover:underline"
              >
                บันทึกเวลาให้
              </Link>
              <form action={cancelFieldTaskForm}>
                {viewHidden}
                <input type="hidden" name="id" value={r.task.id} />
                <input type="hidden" name="cancelled" value={r.task.is_cancelled ? "false" : "true"} />
                <button type="submit" className="text-slate-600 hover:underline">
                  {r.task.is_cancelled ? "นำกลับมา" : "ยกเลิกงาน"}
                </button>
              </form>
              </>)}
              {canDelete && (
              <form action={deleteFieldTaskForm} className="flex items-center gap-1">
                {viewHidden}
                <input type="hidden" name="id" value={r.task.id} />
                <input type="checkbox" name="confirm" title="ยืนยันลบ" />
                <button type="submit" className="text-rose-600 hover:underline">
                  ลบงาน
                </button>
              </form>
              )}
            </div>
          )}
        />

        {report.perEmployee.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">สรุปชั่วโมงงานพิเศษต่อคน</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {report.perEmployee.map((p) => (
                <span key={p.employeeId} className="badge bg-violet-50 text-violet-800">
                  {p.empCode} {p.fullName}: {p.tasks} งาน · {formatDuration(p.minutes)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
    </>
  );
}

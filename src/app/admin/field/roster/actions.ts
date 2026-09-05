"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, dateRange, dayOfWeek } from "@/lib/datetime";
import {
  addFieldTaskMembers,
  findOrCreateFieldTask,
  listFieldTaskTypes,
  listFieldTasks,
  logAudit,
  removeFieldTaskMember,
  type FieldTaskInput,
} from "@/lib/db";
import { requireMenuAccess } from "@/lib/att-access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_DAYS = 62;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function ids(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

/** พารามิเตอร์มุมมอง (บริษัท/สาขา/ตำแหน่ง/สถานที่/ช่วง) ส่งกลับไปหน้าเดิมหลังบันทึก */
function viewParams(form: FormData): string {
  const q = new URLSearchParams();
  for (const k of ["company", "branch", "position", "site", "from", "view"]) {
    const v = str(form, `view_${k}`);
    if (v) q.set(k, v);
  }
  return q.toString();
}

function back(form: FormData, message: string, isError = false): never {
  const view = viewParams(form);
  redirect(
    `/admin/field/roster?${view ? `${view}&` : ""}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`,
  );
}

/** อ่าน "งานที่จะจัด" จากฟอร์ม: ประเภท + สถานที่/พิมพ์เอง + เวลาแผน */
async function readTaskSpec(form: FormData): Promise<Omit<FieldTaskInput, "work_date">> {
  const companyId = str(form, "view_company") || null;
  const typeId = str(form, "type_id");
  const siteId = str(form, "site_id") || null;
  const placeText = str(form, "place_text") || null;
  const plannedStart = str(form, "planned_start") || null;
  const plannedEnd = str(form, "planned_end") || null;

  if (!typeId) back(form, "กรุณาเลือกประเภทงาน", true);
  if (!siteId && !placeText) back(form, "กรุณาเลือกสถานที่ หรือพิมพ์ชื่อสถานที่", true);
  if (plannedStart && !TIME_RE.test(plannedStart)) back(form, "เวลาเริ่มตามแผนไม่ถูกต้อง", true);
  if (plannedEnd && !TIME_RE.test(plannedEnd)) back(form, "เวลาจบตามแผนไม่ถูกต้อง", true);

  const type = (await listFieldTaskTypes(companyId)).find((t) => t.id === typeId);
  if (!type) back(form, "ประเภทงานไม่ถูกต้อง", true);

  const countsAll = form.getAll("counts_hours").map(String);
  const countsHours =
    countsAll.length === 0 ? type.counts_hours : countsAll.includes("true") || countsAll.includes("on");

  return {
    company_id: companyId,
    type_id: type.id,
    title: str(form, "title") || type.name,
    site_id: siteId,
    place_text: siteId ? null : placeText,
    planned_start: plannedStart,
    planned_end: plannedEnd,
    counts_hours: countsHours,
    note: str(form, "note") || null,
  };
}

/** จัดเป็นชุด: หลายคน × ช่วงวันที่ × เฉพาะวันในสัปดาห์ → งานเดียวกันต่อวัน คนที่เลือกเป็นสมาชิก */
export async function assignFieldRosterForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "write");
  const actorId = access.user?.id ?? null;

  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const to = str(form, "to");
  const weekdays = ids(form, "weekdays").map(Number);

  if (employeeIds.length === 0) back(form, "กรุณาเลือกพนักงานอย่างน้อย 1 คน", true);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) back(form, "ช่วงวันที่ไม่ถูกต้อง", true);
  if (dateRange(from, to).length > MAX_DAYS) back(form, `จัดได้ครั้งละไม่เกิน ${MAX_DAYS} วัน`, true);
  if (weekdays.length === 0) back(form, "กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน", true);

  const dates = dateRange(from, to).filter((d) => weekdays.includes(dayOfWeek(d)));
  if (dates.length === 0) back(form, "ไม่มีวันที่ตรงกับเงื่อนไขที่เลือก", true);

  const spec = await readTaskSpec(form);

  let added = 0;
  try {
    for (const work_date of dates) {
      const task = await findOrCreateFieldTask({ ...spec, work_date });
      added += await addFieldTaskMembers(task.id, employeeIds);
    }
    await logAudit({
      actor_id: actorId,
      action: "assign_field_roster",
      target_table: "field_task_members",
      after: { employees: employeeIds.length, from, to, weekdays, days: dates.length, spec, added },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "จัดตารางไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field/roster");
  revalidatePath("/admin/field");
  back(form, `จัดงานให้ ${employeeIds.length} คน ${dates.length} วัน (เพิ่มใหม่ ${added} ช่อง)`);
}

/** แก้ทีละช่อง: เพิ่มคนเข้างานที่มีอยู่ หรือสร้างงานใหม่ให้วันนั้น */
export async function addCellForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "edit");
  const actorId = access.user?.id ?? null;
  const employeeId = str(form, "employee_id");
  const workDate = str(form, "work_date");
  const existingTaskId = str(form, "task_id");
  if (!employeeId || !DATE_RE.test(workDate)) back(form, "ข้อมูลช่องที่แก้ไม่ถูกต้อง", true);

  try {
    let taskId = existingTaskId;
    if (!taskId) {
      const spec = await readTaskSpec(form);
      taskId = (await findOrCreateFieldTask({ ...spec, work_date: workDate })).id;
    }
    await addFieldTaskMembers(taskId, [employeeId]);
    await logAudit({
      actor_id: actorId,
      action: "assign_field_roster",
      target_table: "field_task_members",
      target_id: taskId,
      after: { employeeId, workDate },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field/roster");
  revalidatePath("/admin/field");
  back(form, "เพิ่มงานให้เรียบร้อยแล้ว");
}

/** เอาคนออกจากงานในช่องนั้น (งานที่ไม่เหลือใครจะถูกลบ) */
export async function removeCellForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "edit");
  const actorId = access.user?.id ?? null;
  const employeeId = str(form, "employee_id");
  const taskId = str(form, "task_id");
  if (!employeeId || !taskId) back(form, "ข้อมูลไม่ครบ", true);

  let taskDeleted = false;
  try {
    ({ taskDeleted } = await removeFieldTaskMember(taskId, employeeId));
    await logAudit({
      actor_id: actorId,
      action: "unassign_field_roster",
      target_table: "field_task_members",
      target_id: taskId,
      after: { employeeId, taskDeleted },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "เอาออกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field/roster");
  revalidatePath("/admin/field");
  back(form, taskDeleted ? "เอาออกแล้ว และลบงานที่ไม่เหลือใครทิ้ง" : "เอาออกจากงานแล้ว");
}

/** คัดลอกตารางจากช่วงก่อนหน้า (ยาวเท่ากัน) มาช่วงที่กำลังดู — งานเดียวกัน สมาชิกเดิม วันต่อวัน */
export async function copyPreviousFieldRosterForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "write");
  const actorId = access.user?.id ?? null;
  const companyId = str(form, "view_company") || null;
  const siteId = str(form, "view_site") || null;
  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const days = Number(str(form, "days"));

  if (employeeIds.length === 0) back(form, "ไม่มีพนักงานในมุมมองนี้", true);
  if (!DATE_RE.test(from) || !Number.isInteger(days) || days <= 0 || days > MAX_DAYS) back(form, "ช่วงวันที่ไม่ถูกต้อง", true);

  const sourceFrom = addDays(from, -days);
  const sourceTo = addDays(from, -1);
  const scope = new Set(employeeIds);

  let copied = 0;
  try {
    const source = await listFieldTasks({ from: sourceFrom, to: sourceTo, companyId });
    for (const t of source) {
      if (siteId && t.site_id !== siteId) continue;
      const members = t.members.map((m) => m.employee_id).filter((id) => scope.has(id));
      if (members.length === 0) continue;
      const offset = dateRange(sourceFrom, t.work_date).length - 1;
      const target = await findOrCreateFieldTask({
        company_id: t.company_id,
        type_id: t.type_id,
        title: t.title,
        site_id: t.site_id,
        place_text: t.place_text,
        work_date: addDays(from, offset),
        planned_start: t.planned_start,
        planned_end: t.planned_end,
        counts_hours: t.counts_hours,
        note: t.note,
      });
      copied += await addFieldTaskMembers(target.id, members);
    }
    await logAudit({
      actor_id: actorId,
      action: "copy_field_roster",
      target_table: "field_task_members",
      after: { from, days, sourceFrom, copied },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "คัดลอกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field/roster");
  revalidatePath("/admin/field");
  back(form, copied === 0 ? "ช่วงก่อนหน้าไม่มีตารางให้คัดลอก" : `คัดลอกมา ${copied} ช่องเรียบร้อยแล้ว`);
}

/** ล้างตารางของทุกคนในมุมมองนี้ทั้งช่วง (เอาออกจากงาน งานที่ว่างถูกลบ) */
export async function clearFieldRosterForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_FIELD_ROSTER", "delete");
  const actorId = access.user?.id ?? null;
  const companyId = str(form, "view_company") || null;
  const siteId = str(form, "view_site") || null;
  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const to = str(form, "to");

  if (form.get("confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนล้างตาราง", true);
  if (employeeIds.length === 0) back(form, "ไม่มีพนักงานในมุมมองนี้", true);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) back(form, "ช่วงวันที่ไม่ถูกต้อง", true);

  const scope = new Set(employeeIds);
  let removed = 0;
  try {
    const tasks = await listFieldTasks({ from, to, companyId });
    for (const t of tasks) {
      if (siteId && t.site_id !== siteId) continue;
      for (const m of t.members) {
        if (!scope.has(m.employee_id)) continue;
        await removeFieldTaskMember(t.id, m.employee_id);
        removed += 1;
      }
    }
    await logAudit({
      actor_id: actorId,
      action: "clear_field_roster",
      target_table: "field_task_members",
      after: { from, to, employees: employeeIds.length, removed },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ล้างไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field/roster");
  revalidatePath("/admin/field");
  back(form, `ล้างตาราง ${removed} ช่องแล้ว`);
}

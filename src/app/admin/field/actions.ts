"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFieldTask,
  deleteFieldPunch,
  deleteFieldTask,
  listFieldTaskTypes,
  logAudit,
  setFieldTaskCancelled,
  updateFieldTask,
  upsertManualFieldPunch,
  type FieldTaskInput,
} from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { FieldPunchType } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** พารามิเตอร์มุมมอง (บริษัท/สาขา/ช่วง/ประเภท) ส่งกลับไปหน้าเดิมหลังบันทึก */
function viewParams(form: FormData): string {
  const q = new URLSearchParams();
  for (const k of ["company", "branch", "from", "to", "type"]) {
    const v = str(form, `view_${k}`);
    if (v) q.set(k, v);
  }
  return q.toString();
}

function back(form: FormData, message: string, isError = false): never {
  const view = viewParams(form);
  redirect(`/admin/field?${view ? `${view}&` : ""}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** อ่านฟอร์มภารกิจ (ใช้ทั้งสร้างและแก้ไข) */
async function readTaskForm(form: FormData): Promise<{ input: FieldTaskInput; memberIds: string[] }> {
  const companyId = str(form, "view_company") || null;
  const typeId = str(form, "type_id");
  const title = str(form, "title");
  const siteId = str(form, "site_id") || null;
  const placeText = str(form, "place_text") || null;
  const workDate = str(form, "work_date");
  const plannedStart = str(form, "planned_start") || null;
  const plannedEnd = str(form, "planned_end") || null;
  const note = str(form, "note") || null;
  const memberIds = form
    .getAll("employee_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (!typeId) back(form, "กรุณาเลือกประเภทงาน", true);
  if (!DATE_RE.test(workDate)) back(form, "กรุณาเลือกวันที่ให้ถูกต้อง", true);
  if (!siteId && !placeText) back(form, "กรุณาเลือกสถานที่ หรือพิมพ์ชื่อสถานที่", true);
  if (plannedStart && !TIME_RE.test(plannedStart)) back(form, "เวลาเริ่มตามแผนไม่ถูกต้อง", true);
  if (plannedEnd && !TIME_RE.test(plannedEnd)) back(form, "เวลาจบตามแผนไม่ถูกต้อง", true);
  if (memberIds.length === 0) back(form, "กรุณาเลือกพนักงานอย่างน้อย 1 คน", true);

  const types = await listFieldTaskTypes(companyId);
  const type = types.find((t) => t.id === typeId);
  if (!type) back(form, "ประเภทงานไม่ถูกต้อง", true);

  // ช่อง "นับชั่วโมง": ฟอร์มส่ง hidden "false" + checkbox "true" มาคู่กัน จึงต้องดูทุกค่า
  // ถ้าไม่ได้ส่งมาเลย (ฟอร์มแบบเร็ว) ใช้ค่าเริ่มต้นของประเภท
  const countsAll = form.getAll("counts_hours").map(String);
  const countsHours =
    countsAll.length === 0 ? type.counts_hours : countsAll.includes("true") || countsAll.includes("on");

  return {
    input: {
      company_id: companyId,
      type_id: type.id,
      title: title || type.name,
      site_id: siteId,
      place_text: siteId ? null : placeText,
      work_date: workDate,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      counts_hours: countsHours,
      note,
    },
    memberIds,
  };
}

export async function createFieldTaskForm(form: FormData): Promise<void> {
  await requireAdmin();
  const { input, memberIds } = await readTaskForm(form);

  try {
    const task = await createFieldTask(input, memberIds);
    await logAudit({
      actor_id: null,
      action: "create_field_task",
      target_table: "field_tasks",
      target_id: task.id,
      after: { ...input, members: memberIds.length },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "สร้างภารกิจไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, `สร้างภารกิจให้ ${memberIds.length} คนเรียบร้อยแล้ว`);
}

export async function updateFieldTaskForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  if (!id) back(form, "ไม่พบภารกิจ", true);
  const { input, memberIds } = await readTaskForm(form);

  try {
    await updateFieldTask(id, input, memberIds);
    await logAudit({
      actor_id: null,
      action: "update_field_task",
      target_table: "field_tasks",
      target_id: id,
      after: { ...input, members: memberIds.length },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "แก้ไขภารกิจไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, "บันทึกภารกิจเรียบร้อยแล้ว");
}

export async function cancelFieldTaskForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const cancelled = str(form, "cancelled") !== "false";
  if (!id) back(form, "ไม่พบภารกิจ", true);

  try {
    await setFieldTaskCancelled(id, cancelled);
    await logAudit({
      actor_id: null,
      action: cancelled ? "cancel_field_task" : "restore_field_task",
      target_table: "field_tasks",
      target_id: id,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, cancelled ? "ยกเลิกภารกิจแล้ว" : "นำภารกิจกลับมาแล้ว");
}

export async function deleteFieldTaskForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  if (!id) back(form, "ไม่พบภารกิจ", true);
  if (form.get("confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนลบภารกิจ", true);

  let photos = 0;
  try {
    ({ photosDeleted: photos } = await deleteFieldTask(id));
    await logAudit({
      actor_id: null,
      action: "delete_field_task",
      target_table: "field_tasks",
      target_id: id,
      after: { photosDeleted: photos },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบภารกิจไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, `ลบภารกิจและรูป ${photos} ไฟล์แล้ว`);
}

/** แอดมินบันทึกเวลาเริ่ม/จบให้สมาชิก (กรณีมือถือมีปัญหา หรือลืมกดจบ) */
export async function manualFieldPunchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const taskId = str(form, "task_id");
  const employeeId = str(form, "employee_id");
  const workDate = str(form, "work_date");
  const startTime = str(form, "start_time");
  const endTime = str(form, "end_time");
  const endNextDay = form.get("end_next_day") === "on";
  const note = str(form, "note") || "แอดมินบันทึกให้";

  if (!taskId || !employeeId || !DATE_RE.test(workDate)) back(form, "ข้อมูลไม่ครบ", true);
  if (!startTime && !endTime) back(form, "กรุณากรอกเวลาเริ่มหรือเวลาจบอย่างน้อยหนึ่งช่อง", true);

  const toIso = (time: string, nextDay: boolean) => {
    const [y, m, d] = workDate.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, d + (nextDay ? 1 : 0), hh - 7, mm)).toISOString();
  };

  try {
    const writes: { type: FieldPunchType; at: string }[] = [];
    if (startTime) {
      if (!TIME_RE.test(startTime)) back(form, "เวลาเริ่มไม่ถูกต้อง", true);
      writes.push({ type: "start", at: toIso(startTime, false) });
    }
    if (endTime) {
      if (!TIME_RE.test(endTime)) back(form, "เวลาจบไม่ถูกต้อง", true);
      writes.push({ type: "end", at: toIso(endTime, endNextDay) });
    }
    for (const w of writes) {
      await upsertManualFieldPunch({
        task_id: taskId,
        employee_id: employeeId,
        punch_type: w.type,
        punched_at: w.at,
        note,
      });
    }
    await logAudit({
      actor_id: null,
      action: "manual_field_punch",
      target_table: "field_punches",
      target_id: taskId,
      after: { employeeId, writes, note },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกเวลาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, "บันทึกเวลาให้เรียบร้อยแล้ว");
}

export async function deleteFieldPunchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const taskId = str(form, "task_id");
  const employeeId = str(form, "employee_id");
  const type = str(form, "punch_type") as FieldPunchType;
  if (!taskId || !employeeId || (type !== "start" && type !== "end")) back(form, "ข้อมูลไม่ครบ", true);

  try {
    await deleteFieldPunch(taskId, employeeId, type);
    await logAudit({
      actor_id: null,
      action: "delete_field_punch",
      target_table: "field_punches",
      target_id: taskId,
      after: { employeeId, type },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath("/admin/field");
  back(form, "ลบการลงเวลาแล้ว");
}

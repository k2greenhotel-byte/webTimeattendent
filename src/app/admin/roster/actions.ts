"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, dateRange, dayOfWeek } from "@/lib/datetime";
import {
  copyAssignments,
  deleteAssignments,
  logAudit,
  upsertAssignments,
  type AssignmentInput,
} from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 62;

/** พารามิเตอร์มุมมองที่ต้องส่งกลับไปหน้าเดิมหลังบันทึก (บริษัท/สาขา/ตำแหน่ง/ช่วงวันที่) */
function viewParams(form: FormData): string {
  const keys = ["company", "branch", "position", "from", "view"];
  const parts = keys
    .map((k) => [k, String(form.get(`view_${k}`) ?? "").trim()])
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.join("&");
}

function back(form: FormData, message: string, isError = false): never {
  const view = viewParams(form);
  redirect(`/admin/roster?${view ? `${view}&` : ""}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function ids(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

/** ค่าจากช่องเลือกกะ: "off" = หยุดเวร, "" = ล้าง (กลับไปใช้กะสาขา), อื่น ๆ = schedule id */
function parseShift(value: string): { is_day_off: boolean; schedule_id: string | null } | "clear" {
  if (!value) return "clear";
  if (value === "off") return { is_day_off: true, schedule_id: null };
  return { is_day_off: false, schedule_id: value };
}

/** จัดเวรเป็นชุด: หลายคน × ช่วงวันที่ × เฉพาะวันในสัปดาห์ที่ติ๊ก */
export async function assignShiftsForm(form: FormData): Promise<void> {
  await requireAdmin();

  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const to = str(form, "to");
  const shift = parseShift(str(form, "shift"));
  const note = str(form, "note") || null;
  const weekdays = ids(form, "weekdays").map(Number);

  if (employeeIds.length === 0) back(form, "กรุณาเลือกพนักงานอย่างน้อย 1 คน", true);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) back(form, "ช่วงวันที่ไม่ถูกต้อง", true);
  if (dateRange(from, to).length > MAX_DAYS) back(form, `จัดได้ครั้งละไม่เกิน ${MAX_DAYS} วัน`, true);
  if (weekdays.length === 0) back(form, "กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน", true);

  const dates = dateRange(from, to).filter((d) => weekdays.includes(dayOfWeek(d)));
  if (dates.length === 0) back(form, "ไม่มีวันที่ตรงกับเงื่อนไขที่เลือก", true);

  let count = 0;
  try {
    if (shift === "clear") {
      // "ล้าง" ในโหมดจัดเป็นชุด = ลบเฉพาะวันที่ตรงเงื่อนไข
      for (const d of dates) count += await deleteAssignments({ employeeIds, from: d, to: d });
    } else {
      const rows: AssignmentInput[] = [];
      for (const employee_id of employeeIds) {
        for (const work_date of dates) rows.push({ employee_id, work_date, note, ...shift });
      }
      count = await upsertAssignments(rows);
    }
    await logAudit({
      actor_id: null,
      action: shift === "clear" ? "clear_roster" : "upsert_roster",
      target_table: "shift_assignments",
      after: { employees: employeeIds.length, from, to, weekdays, shift, days: dates.length },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกตารางเวรไม่สำเร็จ", true);
  }

  revalidatePath("/admin/roster");
  back(
    form,
    shift === "clear"
      ? `ล้างตารางเวร ${count} ช่องแล้ว`
      : `จัดเวรให้ ${employeeIds.length} คน รวม ${count} ช่องเรียบร้อยแล้ว`,
  );
}

/** แก้ทีละช่อง (1 คน 1 วัน) */
export async function saveCellForm(form: FormData): Promise<void> {
  await requireAdmin();

  const employee_id = str(form, "employee_id");
  const work_date = str(form, "work_date");
  const shift = parseShift(str(form, "shift"));
  const note = str(form, "note") || null;

  if (!employee_id || !DATE_RE.test(work_date)) back(form, "ข้อมูลช่องที่แก้ไม่ถูกต้อง", true);

  try {
    if (shift === "clear") {
      await deleteAssignments({ employeeIds: [employee_id], from: work_date, to: work_date });
    } else {
      await upsertAssignments([{ employee_id, work_date, note, ...shift }]);
    }
    await logAudit({
      actor_id: null,
      action: shift === "clear" ? "clear_roster" : "upsert_roster",
      target_table: "shift_assignments",
      target_id: employee_id,
      after: { work_date, shift, note },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/roster");
  back(form, shift === "clear" ? "ล้างช่องนี้แล้ว (ใช้กะสาขาตามเดิม)" : "บันทึกเวรเรียบร้อยแล้ว");
}

/** คัดลอกตารางเวรจากช่วงก่อนหน้า (ยาวเท่ากัน) มาทับช่วงที่กำลังดู */
export async function copyPreviousForm(form: FormData): Promise<void> {
  await requireAdmin();

  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const days = Number(str(form, "days"));

  if (employeeIds.length === 0) back(form, "ไม่มีพนักงานในมุมมองนี้", true);
  if (!DATE_RE.test(from) || !Number.isInteger(days) || days <= 0 || days > MAX_DAYS) {
    back(form, "ช่วงวันที่ไม่ถูกต้อง", true);
  }

  let count = 0;
  try {
    count = await copyAssignments({
      employeeIds,
      sourceFrom: addDays(from, -days),
      targetFrom: from,
      days,
    });
    await logAudit({
      actor_id: null,
      action: "copy_roster",
      target_table: "shift_assignments",
      after: { employees: employeeIds.length, from, days, copied: count },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "คัดลอกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/roster");
  back(
    form,
    count === 0 ? "ช่วงก่อนหน้าไม่มีตารางเวรให้คัดลอก" : `คัดลอกตารางเวรมา ${count} ช่องเรียบร้อยแล้ว`,
  );
}

/** ล้างตารางเวรของทุกคนในมุมมองนี้ทั้งช่วง (ต้องติ๊กยืนยัน) */
export async function clearRangeForm(form: FormData): Promise<void> {
  await requireAdmin();

  const employeeIds = ids(form, "employee_ids");
  const from = str(form, "from");
  const to = str(form, "to");

  if (form.get("confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนล้างตารางเวร", true);
  if (employeeIds.length === 0) back(form, "ไม่มีพนักงานในมุมมองนี้", true);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) back(form, "ช่วงวันที่ไม่ถูกต้อง", true);

  let count = 0;
  try {
    count = await deleteAssignments({ employeeIds, from, to });
    await logAudit({
      actor_id: null,
      action: "clear_roster",
      target_table: "shift_assignments",
      after: { employees: employeeIds.length, from, to, deleted: count },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ล้างไม่สำเร็จ", true);
  }

  revalidatePath("/admin/roster");
  back(form, `ล้างตารางเวร ${count} ช่องแล้ว`);
}

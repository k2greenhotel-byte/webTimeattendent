/**
 * กฎธุรกิจของระบบบันทึกงานประจำวันพนักงานขาย — pure function ล้วน (ไม่แตะฐานข้อมูล)
 * หน้าเว็บ server action และ dashboard เรียกใช้ชุดเดียวกันหมด ตัวเลขจะได้ตรงกันทุกที่
 */
import type {
  Db2Salesman,
  ItemStatRow,
  LogItemInput,
  MapRow,
  MediaKind,
  StaffSummary,
  TaskGroup,
  TaskSummary,
  TaskType,
  TaskTypeInput,
} from "./salework-types";
import type { TaskMatrixRow } from "./salework-types";
import type { AccessLevel } from "./core-types";
import { daysBetween } from "./datetime";

/** หัวหน้างานขึ้นไปเห็นใบงานของทุกคน — พนักงานทั่วไปเห็นเฉพาะของตัวเอง */
export function canSeeAllWork(level: AccessLevel): boolean {
  return level === "admin" || level === "assistant_admin" || level === "supervisor";
}

// ---------- ประเภทงาน ----------

/**
 * จัดประเภทงานเป็นชั้น: หัวข้อ (parent_id = null) แล้วตามด้วยงานย่อยของหัวข้อนั้น
 * เรียงตาม sort_order แล้วค่อยชื่อ เพื่อให้ลำดับบนจอเหมือนกันทุกครั้ง
 */
export function groupTaskTypes(types: TaskType[]): TaskGroup[] {
  const byOrder = (a: TaskType, b: TaskType) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name, "th");

  const heads = types.filter((t) => !t.parent_id).sort(byOrder);
  return heads.map((head) => ({
    head,
    children: types.filter((t) => t.parent_id === head.id).sort(byOrder),
  }));
}

/**
 * ประเภทงานที่ "กรอกได้จริง" เรียงตามลำดับที่แสดงบนจอ
 * หัวข้อที่มีงานย่อยเป็นแค่ป้ายกำกับ ไม่ใช่บรรทัดให้ติ๊ก — ตัดออก
 */
export function fillableTasks(types: TaskType[]): TaskType[] {
  const out: TaskType[] = [];
  for (const group of groupTaskTypes(types)) {
    if (group.children.length === 0) out.push(group.head);
    else out.push(...group.children);
  }
  return out;
}

/** ตรวจข้อมูลประเภทงานก่อนบันทึก — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateTaskType(
  input: TaskTypeInput,
  otherCodes: string[],
): string | null {
  const code = input.code.trim();
  const name = input.name.trim();

  if (!code) return "กรุณากรอกรหัสประเภทงาน";
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(code)) {
    return "รหัสประเภทงานใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข - และ _ ยาวไม่เกิน 20 ตัว";
  }
  if (otherCodes.includes(code)) return `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`;
  if (!name) return "กรุณากรอกชื่อประเภทงาน";

  if (input.require_metric && !input.metric_label?.trim()) {
    return "ถ้าบังคับให้กรอกตัวเลข ต้องระบุชื่อช่องตัวเลขด้วย เช่น จำนวนใบปลิวที่แจก";
  }
  if (input.daily_target !== null && input.daily_target < 0) {
    return "เป้าหมายต่อวันต้องไม่ติดลบ";
  }
  if (input.sort_order < 0) return "ลำดับการแสดงผลต้องไม่ติดลบ";

  return null;
}

/** ประเภทงานนี้ลบได้ไหม (มีงานย่อยอยู่ ต้องลบ/ย้ายงานย่อยก่อน) */
export function taskTypeBlockers(
  type: TaskType,
  allTypes: TaskType[],
  usageCount: number,
): string | null {
  const children = allTypes.filter((t) => t.parent_id === type.id);
  if (children.length > 0) {
    return `หัวข้อนี้มีงานย่อยอยู่ ${children.length} รายการ กรุณาลบหรือย้ายงานย่อยออกก่อน`;
  }
  if (usageCount > 0) {
    return `ประเภทงานนี้ถูกใช้ในใบงานแล้ว ${usageCount} บรรทัด — แนะนำให้ "ปิดใช้งาน" แทนการลบ เพื่อให้ใบเก่ายังอ่านได้`;
  }
  return null;
}

// ---------- ใบบันทึกงานประจำวัน ----------

/** ลิงก์โพสต์ที่ผู้ใช้วางมา — เติม https:// ให้ถ้าลืม และตัดค่าที่ไม่ใช่ลิงก์ทิ้ง */
export function normalizeLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** ชนิดไฟล์แนบจาก mime — อย่างอื่นที่ไม่ใช่วิดีโอถือเป็นรูป */
export function mediaKindOf(mime: string | null | undefined): MediaKind {
  return (mime ?? "").toLowerCase().startsWith("video/") ? "video" : "image";
}

/**
 * ตรวจใบงานก่อนบันทึก
 *
 * ตรวจเฉพาะบรรทัดที่ติ๊กว่า "ทำแล้ว" เท่านั้น — บรรทัดที่ยังไม่ทำปล่อยว่างได้
 * `submitting = true` (กดส่งงาน ไม่ใช่เก็บร่าง) ถึงจะบังคับว่าต้องมีอย่างน้อยหนึ่งงานที่ทำแล้ว
 */
export function validateWorkLog(
  workDate: string,
  items: LogItemInput[],
  types: TaskType[],
  submitting: boolean,
  today: string,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return "กรุณาเลือกวันที่ทำงาน";
  if (workDate > today) return "บันทึกงานล่วงหน้าไม่ได้ กรุณาเลือกวันที่ไม่เกินวันนี้";

  const typeOf = new Map(types.map((t) => [t.id, t]));
  const doneItems = items.filter((i) => i.done);

  for (const item of doneItems) {
    const type = item.task_type_id ? typeOf.get(item.task_type_id) : undefined;
    if (!type) continue;

    if (type.require_metric && (item.qty === null || item.qty <= 0)) {
      return `งาน "${type.name}" ต้องกรอก${type.metric_label ?? "ตัวเลขผลงาน"}ให้มากกว่า 0`;
    }
    if (item.qty !== null && item.qty < 0) {
      return `งาน "${type.name}" กรอกตัวเลขติดลบไม่ได้`;
    }
    if (type.require_media && item.media.length === 0) {
      return `งาน "${type.name}" ต้องแนบรูปหรือคลิปอย่างน้อย 1 ไฟล์`;
    }
  }

  if (submitting && doneItems.length === 0) {
    return "ยังไม่ได้ติ๊กงานที่ทำเลยสักรายการ — ติ๊กงานที่ทำแล้วก่อนส่งงาน หรือกดเก็บเป็นร่างไว้ก่อน";
  }

  return null;
}

/** ความคืบหน้าของใบงานหนึ่งใบ */
export function progressOf(items: { done: boolean }[]): {
  done: number;
  total: number;
  pct: number;
} {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ---------- Dashboard / War room ----------

/** กุญแจประจำตัวพนักงานหนึ่งคน — ใช้ตัวเดียวกันทุกตาราง จะได้ join กันได้ */
export function staffKeyOf(row: ItemStatRow): string {
  return row.owner_id ?? `name:${row.owner_name}`;
}

const keyOf = staffKeyOf;

/**
 * จำนวนวันที่ใช้หารหาค่าเฉลี่ยต่อวัน — นับวันปฏิทินตั้งแต่ from ถึง to แบบรวมปลายทั้งสองด้าน
 *
 * ตัดที่ "วันนี้" เสมอ เพราะช่วงที่เลือกอาจลากไปถึงสิ้นเดือนที่ยังมาไม่ถึง
 * (เลือกเดือนนี้ = 1–30 ก.ย. แต่วันนี้ 9 ก.ย. ต้องหารด้วย 9 ไม่ใช่ 30 ไม่งั้นค่าเฉลี่ยต่ำเกินจริง)
 */
export function daysElapsed(from: string, to: string, today: string): number {
  const end = to > today ? today : to;
  if (end < from) return 0;
  return daysBetween(from, end) + 1;
}

/** ค่าเฉลี่ยต่อวัน ทศนิยม 1 ตำแหน่ง (ไม่มีวัน = 0 ไม่ใช่ค่าอนันต์) */
export function perDay(total: number, days: number): number {
  return days > 0 ? Math.round((total / days) * 10) / 10 : 0;
}

/** สัดส่วนเป็น % ปัดจำนวนเต็ม — ตัวหารเป็นศูนย์คืน 0 */
export function sharePct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * สรุปผลงานรายคนจากบรรทัดงานทั้งหมดในช่วงที่เลือก
 * เรียงจากคนที่ทำงานเสร็จมากที่สุดลงมา (ตัวเลขบนกระดาน war room)
 */
export function buildStaffSummaries(rows: ItemStatRow[]): StaffSummary[] {
  const acc = new Map<
    string,
    StaffSummary & { dateSet: Set<string>; submittedSet: Set<string> }
  >();

  for (const row of rows) {
    const key = keyOf(row);
    let s = acc.get(key);
    if (!s) {
      s = {
        key,
        owner_id: row.owner_id,
        owner_name: row.owner_full_name ?? row.owner_name,
        branch_name: row.branch_name,
        days: 0,
        submittedDays: 0,
        doneCount: 0,
        itemCount: 0,
        mediaCount: 0,
        qtyByTask: {},
        donePct: 0,
        dateSet: new Set(),
        submittedSet: new Set(),
      };
      acc.set(key, s);
    }

    s.dateSet.add(row.work_date);
    if (row.submitted_at) s.submittedSet.add(row.work_date);
    s.itemCount += 1;
    s.mediaCount += row.media_count;
    if (row.done) {
      s.doneCount += 1;
      if (row.qty !== null) {
        s.qtyByTask[row.task_code] = (s.qtyByTask[row.task_code] ?? 0) + row.qty;
      }
    }
  }

  return [...acc.values()]
    .map(({ dateSet, submittedSet, ...s }) => ({
      ...s,
      days: dateSet.size,
      submittedDays: submittedSet.size,
      donePct: s.itemCount === 0 ? 0 : Math.round((s.doneCount / s.itemCount) * 100),
    }))
    .sort((a, b) => b.doneCount - a.doneCount || a.owner_name.localeCompare(b.owner_name, "th"));
}

/** สรุปผลงานรายประเภทงาน (รวมทุกคน) — เรียงตามจำนวนครั้งที่ทำ */
export function buildTaskSummaries(rows: ItemStatRow[]): TaskSummary[] {
  const acc = new Map<string, TaskSummary & { staff: Set<string> }>();

  for (const row of rows) {
    let t = acc.get(row.task_code);
    if (!t) {
      t = {
        task_code: row.task_code,
        task_name: row.task_name,
        metric_unit: row.metric_unit,
        doneCount: 0,
        itemCount: 0,
        qty: 0,
        staffCount: 0,
        staff: new Set(),
      };
      acc.set(row.task_code, t);
    }
    t.itemCount += 1;
    if (row.done) {
      t.doneCount += 1;
      t.qty += row.qty ?? 0;
      t.staff.add(keyOf(row));
    }
  }

  return [...acc.values()]
    .map(({ staff, ...t }) => ({ ...t, staffCount: staff.size }))
    .sort((a, b) => b.doneCount - a.doneCount || a.task_name.localeCompare(b.task_name, "th"));
}

/**
 * งานรายประเภท แยกยอดตามพนักงาน — เรียงจากประเภทที่ทำน้อยที่สุดขึ้นก่อน
 *
 * ส่งทั้งตารางไปให้จอครั้งเดียว จอจึงสลับ "ดูรวมทุกคน / ดูรายคน" ได้ทันทีโดยไม่ต้องยิงใหม่
 * และคิด % เทียบยอดรวมของประเภทนั้นได้เอง (เช่น โพสต์ FB รวม 62 งาน คนนี้ทำ 10 = 16%)
 *
 * นับเฉพาะบรรทัดที่ติ๊กว่า "ทำแล้ว" เหมือน buildTaskSummaries — ตัวเลขสองที่จะได้ตรงกัน
 */
export function buildTaskMatrix(rows: ItemStatRow[]): TaskMatrixRow[] {
  const acc = new Map<string, TaskMatrixRow>();

  for (const row of rows) {
    let t = acc.get(row.task_code);
    if (!t) {
      t = { task_code: row.task_code, task_name: row.task_name, total: 0, byStaff: {} };
      acc.set(row.task_code, t);
    }
    if (!row.done) continue;

    t.total += 1;
    const key = keyOf(row);
    t.byStaff[key] = (t.byStaff[key] ?? 0) + 1;
  }

  return [...acc.values()].sort(
    (a, b) => a.total - b.total || a.task_name.localeCompare(b.task_name, "th"),
  );
}

/** เติมยอดขายจริงจากระบบขาย (Db2) ลงในสรุปรายคน ผ่านคู่ที่จับไว้ */
export function attachDb2Sales(
  summaries: StaffSummary[],
  mapByEmployee: Map<string, string>,
  unitsBySalcod: Map<string, number>,
): StaffSummary[] {
  return summaries.map((s) => {
    const salcod = s.owner_id ? (mapByEmployee.get(s.owner_id) ?? null) : null;
    return {
      ...s,
      db2Salcod: salcod,
      db2Units: salcod ? (unitsBySalcod.get(salcod) ?? 0) : null,
    };
  });
}

// ---------- จับคู่พนักงานขายกับระบบขาย (Db2) ----------

/** รหัส SALCOD ที่ผู้ใช้พิมพ์เอง — ระบบขายเก็บเป็นตัวพิมพ์ใหญ่ไม่มีช่องว่าง */
export function normalizeSalcod(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * ตรวจก่อนบันทึกการจับคู่ — หนึ่งรหัสพนักงานขายจับคู่ได้กับบัญชีเดียวเท่านั้น
 * (ไม่งั้นยอดขายในระบบขายจะถูกนับให้สองคน)
 */
export function validateMapping(
  employeeId: string,
  salcod: string,
  existing: { employee_id: string; db2_salcod: string }[],
): string | null {
  if (!employeeId) return "ไม่พบบัญชีผู้ใช้ที่จะจับคู่";
  if (!salcod) return "กรุณาเลือกหรือกรอกรหัสพนักงานขายในระบบขาย";
  if (!/^[A-Z0-9_-]{1,20}$/.test(salcod)) {
    return "รหัสพนักงานขายใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข - และ _ ยาวไม่เกิน 20 ตัว";
  }

  const taken = existing.find((m) => m.db2_salcod === salcod && m.employee_id !== employeeId);
  if (taken) return `รหัส ${salcod} ถูกจับคู่กับบัญชีอื่นไปแล้ว กรุณายกเลิกคู่เดิมก่อน`;

  return null;
}

/**
 * เดาคู่ที่น่าจะใช่ให้แอดมินกดยืนยัน — เทียบชื่อในระบบขายกับชื่อบัญชีผู้ใช้
 * เทียบแบบตัดคำนำหน้า/ช่องว่างออก และต้องตรงกันทั้งชื่อจึงจะเสนอ (กันจับคู่ผิดคน)
 */
export function suggestMappings(
  rows: MapRow[],
  salesmen: Db2Salesman[],
): Map<string, Db2Salesman> {
  const usedSalcod = new Set(rows.map((r) => r.db2_salcod).filter(Boolean) as string[]);
  const byName = new Map<string, Db2Salesman>();

  for (const s of salesmen) {
    if (!s.name || usedSalcod.has(s.salcod)) continue;
    const key = simplifyName(s.name);
    if (!key) continue;
    // ชื่อซ้ำกันหลายรหัส = เดาไม่ได้ ให้แอดมินเลือกเอง
    byName.set(key, byName.has(key) ? ({ ...s, salcod: "" } as Db2Salesman) : s);
  }

  const out = new Map<string, Db2Salesman>();
  for (const row of rows) {
    if (row.db2_salcod) continue;
    const hit = byName.get(simplifyName(row.full_name));
    if (hit && hit.salcod) out.set(row.employee_id, hit);
  }
  return out;
}

/** เรียงจากยาวไปสั้น เพื่อให้ "นางสาว" ถูกตัดก่อน "นาง" (ทะเบียนพนักงานพิมพ์มาไม่เหมือนกันทุกแบบ) */
const NAME_PREFIXES = ["นางสาว", "น.ส.", "นส.", "ด.ช.", "ด.ญ.", "นาย", "นาง", "คุณ"];

/** ตัดคำนำหน้าชื่อและช่องว่างออก เพื่อเทียบชื่อสองระบบที่พิมพ์ไม่เหมือนกัน */
export function simplifyName(raw: string): string {
  let name = raw.trim();
  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  return name.replace(/\s+/g, "");
}

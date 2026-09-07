"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { workDateOf } from "@/lib/datetime";
import { logAudit } from "@/lib/db";
import { canSeeAllWork, normalizeLink, validateWorkLog } from "@/lib/salework";
import { deleteLog, getLog, listTaskTypes, saveWorkLog } from "@/lib/salework-db";
import type { LogItemInput, MediaInput, TaskType } from "@/lib/salework-types";
import { requirePermission } from "@/lib/session";

// ---------- ตัวช่วยอ่านค่าจากฟอร์ม ----------

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function optNumber(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** ไฟล์แนบที่ MediaUploader ส่งมาเป็น JSON บรรทัดละไฟล์ — ค่าที่อ่านไม่ออกทิ้งไปเงียบ ๆ */
function readMedia(form: FormData, key: string): MediaInput[] {
  const out: MediaInput[] = [];
  for (const raw of form.getAll(key)) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    try {
      const m = JSON.parse(text) as Partial<MediaInput>;
      if (typeof m.path !== "string" || !m.path.startsWith("sw/")) continue;
      out.push({
        path: m.path,
        kind: m.kind === "video" ? "video" : "image",
        filename: typeof m.filename === "string" ? m.filename : null,
        mime: typeof m.mime === "string" ? m.mime : null,
        size_bytes: typeof m.size_bytes === "number" ? m.size_bytes : null,
      });
    } catch {
      // ค่าที่ไม่ใช่ JSON = ไม่ใช่ไฟล์แนบ ข้ามไป
    }
  }
  return out;
}

/** ประกอบบรรทัดงานจากฟอร์ม โดยยึดรายการ task_id ที่หน้าจอแสดงไว้จริง */
function readItems(form: FormData, types: TaskType[]): LogItemInput[] {
  const byId = new Map(types.map((t) => [t.id, t]));
  const items: LogItemInput[] = [];

  for (const raw of form.getAll("task_id")) {
    const id = String(raw ?? "");
    const type = byId.get(id);
    if (!type) continue;

    const done = str(form, `done_${id}`) === "1";
    const link = str(form, `link_${id}`);

    items.push({
      task_type_id: type.id,
      task_code: type.code,
      task_name: type.name,
      metric_label: type.metric_label,
      metric_unit: type.metric_unit,
      done,
      qty: type.metric_label ? optNumber(form, `qty_${id}`) : null,
      detail: optText(form, `detail_${id}`),
      link_url: type.allow_link && link ? normalizeLink(link) : null,
      sort_order: type.sort_order,
      media: readMedia(form, `media_${id}`),
    });
  }

  return items;
}

/**
 * บันทึกใบงานประจำวันของตัวเอง (เก็บร่างหรือส่งงาน)
 * วันที่มาจากฟอร์มแต่ต้องไม่เกินวันนี้ และเจ้าของใบคือคนที่ล็อกอินอยู่เสมอ
 */
export async function saveDailyLogForm(form: FormData): Promise<void> {
  const user = await requirePermission("SW_ENTRY", "write");

  const workDate = str(form, "work_date") || workDateOf();
  const path = `/salework/daily?date=${encodeURIComponent(workDate)}`;
  const submit = str(form, "submit") === "1";

  // โหลดทั้งหมด (รวมที่ปิดใช้งาน) เพราะใบเก่าอาจมีงานที่เพิ่งถูกปิดใช้งานไปค้างอยู่
  const types = await listTaskTypes(false);
  const items = readItems(form, types);

  const problem = validateWorkLog(workDate, items, types, submit, workDateOf());
  if (problem) back(path, problem, true);

  try {
    await saveWorkLog({
      work_date: workDate,
      owner_id: user.id,
      owner_name: user.full_name,
      branch_id: user.branch_id ?? null,
      company_id: user.company_id ?? null,
      note: optText(form, "note"),
      submit,
      items,
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบงานไม่สำเร็จ", true);
  }

  revalidatePath("/salework");
  revalidatePath("/salework/daily");
  back(path, submit ? "ส่งงานประจำวันเรียบร้อยแล้ว" : "เก็บเป็นร่างไว้แล้ว");
}

/** ลบใบงาน (เฉพาะผู้มีสิทธิ์ลบ) — ไฟล์แนบในถังถูกลบตามไปด้วย */
export async function deleteLogForm(form: FormData): Promise<void> {
  const user = await requirePermission("SW_ENTRY", "delete");
  const id = str(form, "id");
  const path = "/salework/search";

  if (str(form, "confirm") !== "on") back(path, "กรุณาติ๊กยืนยันก่อนลบใบงาน", true);

  const detail = await getLog(id);
  if (!detail) back(path, "ไม่พบใบงานที่ต้องการลบ", true);
  if (!canSeeAllWork(user.level) && detail.log.owner_id !== user.id) {
    back(path, "ลบได้เฉพาะใบงานของตัวเองเท่านั้น", true);
  }

  try {
    await deleteLog(id);
    await logAudit({
      actor_id: user.id,
      action: "ลบใบบันทึกงานประจำวันพนักงานขาย",
      target_table: "sw_logs",
      target_id: id,
      before: { doc_no: detail.log.doc_no, owner: detail.log.owner_name, work_date: detail.log.work_date },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบงานไม่สำเร็จ", true);
  }

  revalidatePath("/salework/search");
  back(path, `ลบใบงาน ${detail.log.doc_no} แล้ว`);
}

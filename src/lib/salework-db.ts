import "server-only";
import type {
  ItemMedia,
  ItemStatRow,
  LogItemRow,
  MapRow,
  MediaInput,
  SalesmanMap,
  TaskType,
  TaskTypeInput,
  WorkLogDetail,
  WorkLogInput,
  WorkLogQuery,
  WorkLogRow,
} from "./salework-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบบันทึกงานประจำวันพนักงานขายอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 *
 * การกรอง "พนักงานเห็นเฉพาะใบของตัวเอง" เป็นหน้าที่ของผู้เรียก (ส่ง owner_id มาด้วย)
 * ที่นี่แค่ทำตามเงื่อนไขที่ได้รับ — เหมือนโมดูล Lead
 */

const DOC_PREFIX = "SW";

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------- ประเภทงาน ----------

const TASK_COLUMNS =
  "id, parent_id, code, name, description, metric_label, metric_unit, require_metric, require_media, allow_link, daily_target, sort_order, is_active";

function toTaskType(raw: Record<string, unknown>): TaskType {
  return { ...(raw as unknown as TaskType), daily_target: numOrNull(raw.daily_target) };
}

/**
 * ประเภทงานทั้งหมด — `activeOnly` ใช้ตอนสร้างฟอร์มบันทึก
 * หน้าตั้งค่าและใบเก่าต้องเห็นที่ปิดใช้งานแล้วด้วย จึงเรียกแบบไม่กรอง
 */
export async function listTaskTypes(activeOnly = false): Promise<TaskType[]> {
  let q = getSupabase().from("sw_task_types").select(TASK_COLUMNS);
  if (activeOnly) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านประเภทงานไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => toTaskType(r as Record<string, unknown>));
}

export async function getTaskType(id: string): Promise<TaskType | null> {
  const { data, error } = await getSupabase()
    .from("sw_task_types")
    .select(TASK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านประเภทงานไม่สำเร็จ: ${error.message}`);
  return data ? toTaskType(data as Record<string, unknown>) : null;
}

export async function createTaskType(input: TaskTypeInput): Promise<void> {
  const { error } = await getSupabase().from("sw_task_types").insert(input);
  if (error) throw new Error(`บันทึกประเภทงานไม่สำเร็จ: ${error.message}`);
}

export async function updateTaskType(id: string, input: Partial<TaskTypeInput>): Promise<void> {
  const { error } = await getSupabase().from("sw_task_types").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกประเภทงานไม่สำเร็จ: ${error.message}`);
}

export async function deleteTaskType(id: string): Promise<void> {
  const { error } = await getSupabase().from("sw_task_types").delete().eq("id", id);
  if (error) throw new Error(`ลบประเภทงานไม่สำเร็จ: ${error.message}`);
}

/** จำนวนบรรทัดในใบงานที่ใช้ประเภทงานนี้ — ใช้เตือนก่อนลบ */
export async function countTaskUsage(taskTypeId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("sw_log_items")
    .select("id", { count: "exact", head: true })
    .eq("task_type_id", taskTypeId);
  if (error) throw new Error(`ตรวจการใช้งานประเภทงานไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

// ---------- ใบบันทึกงานประจำวัน ----------

function toLogRow(raw: Record<string, unknown>): WorkLogRow {
  return {
    ...(raw as unknown as WorkLogRow),
    item_count: Number(raw.item_count ?? 0),
    done_count: Number(raw.done_count ?? 0),
    media_count: Number(raw.media_count ?? 0),
  };
}

/** รายการใบงานตามเงื่อนไข — ใช้ร่วมกันทั้งหน้าสอบถามและหน้าแรก */
export async function listLogs(query: WorkLogQuery = {}): Promise<WorkLogRow[]> {
  let q = getSupabase().from("v_sw_logs").select("*");

  if (query.owner_id) q = q.eq("owner_id", query.owner_id);
  if (query.branch_id) q = q.eq("branch_id", query.branch_id);
  if (query.company_id) q = q.eq("company_id", query.company_id);
  if (query.from) q = q.gte("work_date", query.from);
  if (query.to) q = q.lte("work_date", query.to);
  if (query.submitted === true) q = q.not("submitted_at", "is", null);
  if (query.submitted === false) q = q.is("submitted_at", null);

  const { data, error } = await q
    .order("work_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบงานไม่สำเร็จ: ${error.message}`);

  let rows = (data ?? []).map((r) => toLogRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (keyword) {
    rows = rows.filter((r) =>
      [r.doc_no, r.owner_name, r.owner_full_name, r.owner_emp_code, r.branch_name, r.note]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }

  return rows;
}

async function itemsOfLog(logId: string): Promise<LogItemRow[]> {
  const supabase = getSupabase();

  const { data: items, error } = await supabase
    .from("sw_log_items")
    .select("*")
    .eq("log_id", logId)
    .order("sort_order")
    .order("task_code");
  if (error) throw new Error(`อ่านรายการงานในใบไม่สำเร็จ: ${error.message}`);

  const ids = (items ?? []).map((i) => (i as { id: string }).id);
  if (ids.length === 0) return [];

  const { data: media, error: mediaError } = await supabase
    .from("sw_item_media")
    .select("*")
    .in("item_id", ids)
    .order("sort_order");
  if (mediaError) throw new Error(`อ่านไฟล์แนบไม่สำเร็จ: ${mediaError.message}`);

  const byItem = new Map<string, ItemMedia[]>();
  for (const m of (media ?? []) as unknown as ItemMedia[]) {
    const list = byItem.get(m.item_id) ?? [];
    list.push(m);
    byItem.set(m.item_id, list);
  }

  return (items ?? []).map((raw) => {
    const item = raw as unknown as LogItemRow;
    return { ...item, qty: numOrNull((raw as Record<string, unknown>).qty), media: byItem.get(item.id) ?? [] };
  });
}

export async function getLog(id: string): Promise<WorkLogDetail | null> {
  const { data, error } = await getSupabase()
    .from("v_sw_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบงานไม่สำเร็จ: ${error.message}`);
  if (!data) return null;

  return { log: toLogRow(data as Record<string, unknown>), items: await itemsOfLog((data as { id: string }).id) };
}

/** ใบงานของพนักงานคนนี้ในวันนั้น (หนึ่งคนหนึ่งวันหนึ่งใบ) */
export async function getLogByOwnerDate(
  ownerId: string,
  workDate: string,
): Promise<WorkLogDetail | null> {
  const { data, error } = await getSupabase()
    .from("v_sw_logs")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบงานไม่สำเร็จ: ${error.message}`);
  if (!data) return null;

  return { log: toLogRow(data as Record<string, unknown>), items: await itemsOfLog((data as { id: string }).id) };
}

/**
 * บันทึกใบงานหนึ่งใบ (สร้างใหม่หรือทับของเดิมของวันนั้น) แล้วคืน id
 *
 * ลำดับ: ออกเลขที่ (เฉพาะใบใหม่) → บันทึกหัวใบ → เขียนบรรทัดงานทีละรายการ
 * บรรทัดที่หายไปจากฟอร์ม (ประเภทงานถูกลบ/ปิดใช้งาน) จะถูกลบพร้อมไฟล์แนบ
 */
export async function saveWorkLog(input: WorkLogInput): Promise<string> {
  const supabase = getSupabase();
  if (!input.owner_id) throw new Error("ไม่พบบัญชีพนักงานขายของใบงานนี้");

  const existing = await getLogByOwnerDate(input.owner_id, input.work_date);

  const head = {
    work_date: input.work_date,
    owner_id: input.owner_id,
    owner_name: input.owner_name,
    branch_id: input.branch_id,
    company_id: input.company_id,
    note: input.note,
    // ส่งงานแล้วส่งซ้ำไม่รีเซ็ตเวลาเดิม · กลับไปเก็บร่างได้ถ้ายังไม่เคยส่ง
    submitted_at: input.submit ? (existing?.log.submitted_at ?? new Date().toISOString()) : null,
  };

  let logId: string;
  if (existing) {
    logId = existing.log.id;
    const { error } = await supabase.from("sw_logs").update(head).eq("id", logId);
    if (error) throw new Error(`บันทึกใบงานไม่สำเร็จ: ${error.message}`);
  } else {
    const { data: docNo, error: docError } = await supabase.rpc("sw_next_doc_no", {
      doc_prefix: DOC_PREFIX,
      be_year: beYearOf(input.work_date),
    });
    if (docError) throw new Error(`ออกเลขที่ใบงานไม่สำเร็จ: ${docError.message}`);

    const { data, error } = await supabase
      .from("sw_logs")
      .insert({ ...head, doc_no: docNo, created_by: input.owner_id })
      .select("id")
      .single();
    if (error) throw new Error(`บันทึกใบงานไม่สำเร็จ: ${error.message}`);
    logId = (data as { id: string }).id;
  }

  const before = existing?.items ?? [];
  const keepTaskIds = new Set(input.items.map((i) => i.task_type_id).filter(Boolean) as string[]);

  // บรรทัดที่ไม่มีในฟอร์มแล้ว → ลบไฟล์ก่อน แล้วค่อยลบแถว
  const dropped = before.filter((i) => !i.task_type_id || !keepTaskIds.has(i.task_type_id));
  if (dropped.length > 0) {
    await removeWorkMedia(dropped.flatMap((i) => i.media.map((m) => m.path)));
    const { error } = await supabase
      .from("sw_log_items")
      .delete()
      .in("id", dropped.map((i) => i.id));
    if (error) throw new Error(`ลบรายการงานเดิมไม่สำเร็จ: ${error.message}`);
  }

  const beforeByTask = new Map(before.filter((i) => i.task_type_id).map((i) => [i.task_type_id as string, i]));

  for (const item of input.items) {
    const row = {
      log_id: logId,
      task_type_id: item.task_type_id,
      task_code: item.task_code,
      task_name: item.task_name,
      metric_label: item.metric_label,
      metric_unit: item.metric_unit,
      done: item.done,
      qty: item.done ? item.qty : null,
      detail: item.done ? item.detail : null,
      link_url: item.done ? item.link_url : null,
      sort_order: item.sort_order,
    };

    const prev = item.task_type_id ? beforeByTask.get(item.task_type_id) : undefined;
    let itemId: string;

    if (prev) {
      itemId = prev.id;
      const { error } = await supabase.from("sw_log_items").update(row).eq("id", itemId);
      if (error) throw new Error(`บันทึกรายการงานไม่สำเร็จ: ${error.message}`);
    } else {
      const { data, error } = await supabase.from("sw_log_items").insert(row).select("id").single();
      if (error) throw new Error(`บันทึกรายการงานไม่สำเร็จ: ${error.message}`);
      itemId = (data as { id: string }).id;
    }

    await syncItemMedia(itemId, prev?.media ?? [], item.done ? item.media : []);
  }

  return logId;
}

/** ปรับไฟล์แนบของบรรทัดหนึ่งให้ตรงกับที่ฟอร์มส่งมา (ลบไฟล์ที่ถูกเอาออกจริงด้วย) */
async function syncItemMedia(
  itemId: string,
  before: ItemMedia[],
  after: MediaInput[],
): Promise<void> {
  const supabase = getSupabase();
  const keep = new Set(after.map((m) => m.path));

  const removed = before.filter((m) => !keep.has(m.path));
  if (removed.length > 0) {
    await removeWorkMedia(removed.map((m) => m.path));
    const { error } = await supabase
      .from("sw_item_media")
      .delete()
      .in("id", removed.map((m) => m.id));
    if (error) throw new Error(`ลบไฟล์แนบไม่สำเร็จ: ${error.message}`);
  }

  const existingPaths = new Set(before.map((m) => m.path));
  const added = after
    .map((m, index) => ({ ...m, sort_order: index }))
    .filter((m) => !existingPaths.has(m.path));

  if (added.length > 0) {
    const { error } = await supabase
      .from("sw_item_media")
      .insert(added.map((m) => ({ item_id: itemId, ...m })));
    if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`);
  }

  // เรียงลำดับใหม่ให้ตรงกับที่เห็นบนจอ
  for (const [index, m] of after.entries()) {
    const row = before.find((b) => b.path === m.path);
    if (row && row.sort_order !== index) {
      await supabase.from("sw_item_media").update({ sort_order: index }).eq("id", row.id);
    }
  }
}

/** ลบใบงานทั้งใบ — ลบไฟล์ในถังก่อนเสมอ ไม่งั้นไฟล์ค้างโดยไม่มีใครรู้ */
export async function deleteLog(id: string): Promise<void> {
  const detail = await getLog(id);
  if (!detail) return;

  await removeWorkMedia(detail.items.flatMap((i) => i.media.map((m) => m.path)));

  const { error } = await getSupabase().from("sw_logs").delete().eq("id", id);
  if (error) throw new Error(`ลบใบงานไม่สำเร็จ: ${error.message}`);
}

// ---------- ข้อมูลสำหรับ dashboard ----------

/** บรรทัดงานทั้งหมดในช่วงที่เลือก — เอาไปรวมยอดต่อในฝั่ง Node (salework.ts) */
export async function listItemStats(filter: {
  from: string;
  to: string;
  owner_id?: string | null;
  branch_id?: string | null;
  company_id?: string | null;
  limit?: number;
}): Promise<ItemStatRow[]> {
  let q = getSupabase()
    .from("v_sw_items")
    .select(
      "task_type_id, task_code, task_name, metric_unit, done, qty, media_count, work_date, owner_id, owner_name, owner_full_name, branch_id, branch_name, submitted_at",
    )
    .gte("work_date", filter.from)
    .lte("work_date", filter.to);

  if (filter.owner_id) q = q.eq("owner_id", filter.owner_id);
  if (filter.branch_id) q = q.eq("branch_id", filter.branch_id);
  if (filter.company_id) q = q.eq("company_id", filter.company_id);

  const { data, error } = await q.limit(filter.limit ?? 20000);
  if (error) throw new Error(`อ่านข้อมูลสรุปงานไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      ...(raw as unknown as ItemStatRow),
      qty: numOrNull(r.qty),
      media_count: Number(r.media_count ?? 0),
    };
  });
}

/** รายชื่อพนักงานที่เคยมีใบงาน — ใช้เป็นตัวเลือกในช่องกรอง */
export async function listWorkOwners(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabase()
    .from("v_sw_logs")
    .select("owner_id, owner_name, owner_full_name")
    .limit(5000);
  if (error) throw new Error(`อ่านรายชื่อพนักงานขายไม่สำเร็จ: ${error.message}`);

  const seen = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { owner_id: string | null; owner_name: string; owner_full_name: string | null };
    if (r.owner_id && !seen.has(r.owner_id)) seen.set(r.owner_id, r.owner_full_name ?? r.owner_name);
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

// ---------- จับคู่พนักงานขายกับระบบขาย (Db2) ----------

export async function listMappings(): Promise<SalesmanMap[]> {
  const { data, error } = await getSupabase()
    .from("sw_salesman_map")
    .select("id, employee_id, db2_salcod, db2_name, note, updated_at");
  if (error) throw new Error(`อ่านข้อมูลการจับคู่ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as SalesmanMap[];
}

/**
 * แถวบนหน้าจอจับคู่ — บัญชีผู้ใช้ + คู่ที่จับไว้
 * `onlyProgramUsers = true` แสดงเฉพาะคนที่มีสิทธิ์เข้าโปรแกรมบันทึกงานพนักงานขาย
 */
export async function listMapRows(onlyProgramUsers = true): Promise<MapRow[]> {
  const supabase = getSupabase();

  const [{ data: employees, error }, { data: branches }, mappings] = await Promise.all([
    supabase
      .from("employees")
      .select("id, emp_code, full_name, access_level, is_active, branch_id")
      .order("emp_code"),
    supabase.from("branches").select("id, name"),
    listMappings(),
  ]);
  if (error) throw new Error(`อ่านรายชื่อผู้ใช้งานไม่สำเร็จ: ${error.message}`);

  let allowed: Set<string> | null = null;
  if (onlyProgramUsers) {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("code", "SALEWORK")
      .maybeSingle();
    if (program) {
      const { data: links } = await supabase
        .from("user_programs")
        .select("user_id")
        .eq("program_id", (program as { id: string }).id);
      allowed = new Set((links ?? []).map((l) => (l as { user_id: string }).user_id));
    }
  }

  const branchName = new Map(
    (branches ?? []).map((b) => [(b as { id: string }).id, (b as { name: string }).name]),
  );
  const mapOf = new Map(mappings.map((m) => [m.employee_id, m]));

  return (employees ?? [])
    .map((raw) => {
      const e = raw as {
        id: string;
        emp_code: string;
        full_name: string;
        access_level: string;
        is_active: boolean;
        branch_id: string | null;
      };
      const m = mapOf.get(e.id);
      return {
        employee_id: e.id,
        emp_code: e.emp_code,
        full_name: e.full_name,
        access_level: e.access_level,
        branch_name: e.branch_id ? (branchName.get(e.branch_id) ?? null) : null,
        is_active: e.is_active,
        db2_salcod: m?.db2_salcod ?? null,
        db2_name: m?.db2_name ?? null,
        note: m?.note ?? null,
      };
    })
    // คนที่จับคู่ไว้แล้วต้องเห็นเสมอ แม้ภายหลังถูกถอดสิทธิ์เข้าโปรแกรม
    .filter((r) => !allowed || allowed.has(r.employee_id) || r.db2_salcod);
}

export async function saveMapping(input: {
  employee_id: string;
  db2_salcod: string;
  db2_name: string | null;
  note: string | null;
  mapped_by: string | null;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("sw_salesman_map")
    .upsert(input, { onConflict: "employee_id" });
  if (error) throw new Error(`บันทึกการจับคู่ไม่สำเร็จ: ${error.message}`);
}

export async function deleteMapping(employeeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("sw_salesman_map")
    .delete()
    .eq("employee_id", employeeId);
  if (error) throw new Error(`ยกเลิกการจับคู่ไม่สำเร็จ: ${error.message}`);
}

// ---------- ไฟล์แนบ (ใช้ถังเดียวกับไฟล์ Memo) ----------

/** เส้นทางไฟล์ใหม่ในถัง — แยกโฟลเดอร์ตามเดือนเพื่อให้ไล่ดู/ล้างของเก่าง่าย */
export function newMediaPath(originalName: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `sw/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadWorkMedia(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: false });
  if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
}

/** signed URL ของไฟล์แนบ (ถังนี้เป็น private) */
export async function workMediaUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** ลบไฟล์ออกจากถัง — เรียกก่อนลบแถวในฐานข้อมูลเสมอ */
export async function removeWorkMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบไฟล์แนบงานพนักงานขายไม่สำเร็จ:", error.message);
  }
}


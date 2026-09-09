import "server-only";
import { buildForm, totalsOf } from "./inspection";
import type {
  InspForm,
  InspItem,
  InspItemInput,
  InspItemOption,
  InspItemOptionInput,
  InspResultInput,
  InspResultRow,
  InspSection,
  InspSectionInput,
  InspTemplate,
  InspTemplateInput,
  Inspection,
  InspectionInput,
  InspectionQuery,
  InspectionRow,
} from "./inspection-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบตรวจสอบสาขาอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const DOC_PREFIX = "INS";

function num(value: unknown): number {
  return Number(value ?? 0);
}

function nullableNum(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

// ---------- โครงแบบฟอร์ม (หน้าจอตั้งค่า ข้อ 4) ----------

export async function listTemplates(includeInactive = false): Promise<InspTemplate[]> {
  let q = getSupabase().from("insp_templates").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านแม่แบบใบตรวจไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => ({
    ...(raw as unknown as InspTemplate),
    bonus_threshold: nullableNum((raw as Record<string, unknown>).bonus_threshold),
    bonus_amount: num((raw as Record<string, unknown>).bonus_amount),
  }));
}

export async function getTemplate(id: string): Promise<InspTemplate | null> {
  const all = await listTemplates(true);
  return all.find((t) => t.id === id) ?? null;
}

export async function listSections(includeInactive = false): Promise<InspSection[]> {
  let q = getSupabase().from("insp_sections").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านหมวดที่ตรวจไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as InspSection[];
}

export async function listItems(includeInactive = false): Promise<InspItem[]> {
  let q = getSupabase().from("insp_items").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการตรวจไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => ({
    ...(raw as unknown as InspItem),
    max_score: num((raw as Record<string, unknown>).max_score),
  }));
}

export async function listItemOptions(includeInactive = false): Promise<InspItemOption[]> {
  let q = getSupabase().from("insp_item_options").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านตัวเลือกของรายการตรวจไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => ({
    ...(raw as unknown as InspItemOption),
    score: num((raw as Record<string, unknown>).score),
    fine_amount: num((raw as Record<string, unknown>).fine_amount),
  }));
}

/**
 * ประกอบแบบฟอร์มพร้อมใช้ของแม่แบบหนึ่งชุด
 * includeInactive = true ใช้ในหน้าตั้งค่า (ต้องเห็นของที่ปิดใช้งานไว้ด้วย)
 */
export async function getForm(templateId: string, includeInactive = false): Promise<InspForm | null> {
  const [templates, sections, items, options] = await Promise.all([
    listTemplates(true),
    listSections(includeInactive),
    listItems(includeInactive),
    listItemOptions(includeInactive),
  ]);

  const template = templates.find((t) => t.id === templateId);
  if (!template) return null;

  return buildForm(template, sections, items, options, includeInactive);
}

/** แบบฟอร์มทุกชุด (หน้าตั้งค่าแสดงทีเดียวทั้งหน้า) */
export async function listForms(includeInactive = false): Promise<InspForm[]> {
  const [templates, sections, items, options] = await Promise.all([
    listTemplates(includeInactive),
    listSections(includeInactive),
    listItems(includeInactive),
    listItemOptions(includeInactive),
  ]);

  return templates.map((t) => buildForm(t, sections, items, options, includeInactive));
}

// ---------- เพิ่ม / แก้ไข / ลบ โครงแบบฟอร์ม ----------

function dupMessage(error: { code?: string; message: string }, what: string): string {
  return error.code === "23505"
    ? `รหัสนี้ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`
    : `บันทึก${what}ไม่สำเร็จ: ${error.message}`;
}

export async function createTemplate(input: InspTemplateInput): Promise<void> {
  const { error } = await getSupabase().from("insp_templates").insert(input);
  if (error) throw new Error(dupMessage(error, "แม่แบบใบตรวจ"));
}

export async function updateTemplate(id: string, patch: Partial<InspTemplateInput>): Promise<void> {
  const { error } = await getSupabase().from("insp_templates").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "แม่แบบใบตรวจ"));
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await getSupabase().from("insp_templates").delete().eq("id", id);
  if (error) throw new Error(`ลบแม่แบบใบตรวจไม่สำเร็จ: ${error.message}`);
}

export async function createSection(input: InspSectionInput): Promise<void> {
  const { error } = await getSupabase().from("insp_sections").insert(input);
  if (error) throw new Error(dupMessage(error, "หมวดที่ตรวจ"));
}

export async function updateSection(id: string, patch: Partial<InspSectionInput>): Promise<void> {
  const { error } = await getSupabase().from("insp_sections").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "หมวดที่ตรวจ"));
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await getSupabase().from("insp_sections").delete().eq("id", id);
  if (error) throw new Error(`ลบหมวดที่ตรวจไม่สำเร็จ: ${error.message}`);
}

export async function createItem(input: InspItemInput): Promise<void> {
  const { error } = await getSupabase().from("insp_items").insert(input);
  if (error) throw new Error(dupMessage(error, "รายการตรวจ"));
}

export async function updateItem(id: string, patch: Partial<InspItemInput>): Promise<void> {
  const { error } = await getSupabase().from("insp_items").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "รายการตรวจ"));
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("insp_items").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการตรวจไม่สำเร็จ: ${error.message}`);
}

export async function createOption(input: InspItemOptionInput): Promise<void> {
  const { error } = await getSupabase().from("insp_item_options").insert(input);
  if (error) throw new Error(dupMessage(error, "ตัวเลือก"));
}

export async function updateOption(id: string, patch: Partial<InspItemOptionInput>): Promise<void> {
  const { error } = await getSupabase().from("insp_item_options").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "ตัวเลือก"));
}

export async function deleteOption(id: string): Promise<void> {
  const { error } = await getSupabase().from("insp_item_options").delete().eq("id", id);
  if (error) throw new Error(`ลบตัวเลือกไม่สำเร็จ: ${error.message}`);
}

/** จำนวนใบตรวจที่เคยใช้รายการนี้ไปแล้ว — ใช้เตือนก่อนลบ (ผลเก่ายังอ่านออกเพราะเก็บสำเนาชื่อไว้) */
export async function countItemUsage(itemId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("insp_results")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  if (error) throw new Error(`ตรวจการใช้งานรายการตรวจไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/** จำนวนใบตรวจที่ออกด้วยแม่แบบนี้ */
export async function countTemplateUsage(templateId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("insp_inspections")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);
  if (error) throw new Error(`ตรวจการใช้งานแม่แบบไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

// ---------- ใบตรวจ ----------

function toInspectionRow(raw: Record<string, unknown>): InspectionRow {
  return {
    ...(raw as unknown as InspectionRow),
    total_score: num(raw.total_score),
    max_score: num(raw.max_score),
    score_pct: num(raw.score_pct),
    total_fine: num(raw.total_fine),
    bonus_amount: num(raw.bonus_amount),
    fail_count: num(raw.fail_count),
    result_count: num(raw.result_count),
    photo_count: num(raw.photo_count),
  };
}

/** รายการใบตรวจตามเงื่อนไข — หน้ารายการ สอบถาม dashboard และจอ War Room ใช้ตัวนี้ตัวเดียว */
export async function listInspections(query: InspectionQuery = {}): Promise<InspectionRow[]> {
  let q = getSupabase().from("v_insp_inspections").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    template_id: query.template_id,
    status: query.status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("inspect_date", query.from);
  if (query.to) q = q.lte("inspect_date", query.to);

  // ใบล่าสุดขึ้นก่อน — คนตรวจเปิดหน้ามาเพื่อดูของที่เพิ่งตรวจไป
  const { data, error } = await q
    .order("inspect_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบตรวจไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toInspectionRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.branch_name, r.company_name, r.template_name, r.inspector_name, r.note]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getInspection(id: string): Promise<InspectionRow | null> {
  const { data, error } = await getSupabase()
    .from("v_insp_inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบตรวจไม่สำเร็จ: ${error.message}`);
  return data ? toInspectionRow(data as Record<string, unknown>) : null;
}

/** ผลรายข้อของใบตรวจ พร้อมรูปที่แนบไว้ */
export async function listResults(inspectionId: string): Promise<InspResultRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("insp_results")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("section_sort")
    .order("sort_order");
  if (error) throw new Error(`อ่านผลการตรวจรายข้อไม่สำเร็จ: ${error.message}`);

  const results = (data ?? []).map((raw) => ({
    ...(raw as unknown as InspResultRow),
    score: num((raw as Record<string, unknown>).score),
    max_score: num((raw as Record<string, unknown>).max_score),
    fine_amount: num((raw as Record<string, unknown>).fine_amount),
    photos: [] as string[],
  }));
  if (results.length === 0) return results;

  const { data: photoRows, error: photoError } = await supabase
    .from("insp_result_photos")
    .select("result_id, path, sort_order")
    .in(
      "result_id",
      results.map((r) => r.id),
    )
    .order("sort_order");
  if (photoError) throw new Error(`อ่านรูปประกอบไม่สำเร็จ: ${photoError.message}`);

  const byResult = new Map<string, string[]>();
  for (const row of (photoRows ?? []) as { result_id: string; path: string }[]) {
    const list = byResult.get(row.result_id) ?? [];
    list.push(row.path);
    byResult.set(row.result_id, list);
  }
  for (const r of results) r.photos = byResult.get(r.id) ?? [];

  return results;
}

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

async function nextDocNo(date: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("insp_next_doc_no", {
    doc_prefix: DOC_PREFIX,
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่ใบตรวจไม่สำเร็จ: ${error.message}`);
  return data as string;
}

/** เขียนผลรายข้อทั้งชุดใหม่ (ลบของเดิมทิ้งก่อน) พร้อมรูปของแต่ละข้อ */
async function replaceResults(inspectionId: string, results: InspResultInput[]): Promise<void> {
  const supabase = getSupabase();

  // ลบไฟล์ที่ถูกเอาออกจากฟอร์ม ไม่ให้ค้างในถัง
  const keep = new Set(results.flatMap((r) => r.photos));
  const old = await listResults(inspectionId);
  const orphans = old.flatMap((r) => r.photos).filter((p) => !keep.has(p));
  if (orphans.length > 0) await removeInspectionFiles(orphans);

  const { error: delError } = await supabase
    .from("insp_results")
    .delete()
    .eq("inspection_id", inspectionId);
  if (delError) throw new Error(`ล้างผลการตรวจเดิมไม่สำเร็จ: ${delError.message}`);

  if (results.length === 0) return;

  const { data, error } = await supabase
    .from("insp_results")
    .insert(
      results.map((r) => ({
        inspection_id: inspectionId,
        item_id: r.item_id,
        section_name: r.section_name,
        section_sort: r.section_sort,
        item_name: r.item_name,
        item_type: r.item_type,
        option_id: r.option_id,
        option_label: r.option_label,
        score: r.score,
        max_score: r.max_score,
        fine_amount: r.fine_amount,
        note: r.note,
        sort_order: r.sort_order,
      })),
    )
    .select("id");
  if (error) throw new Error(`บันทึกผลการตรวจรายข้อไม่สำเร็จ: ${error.message}`);

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  const photoRows = results.flatMap((r, index) =>
    r.photos.map((path, sort_order) => ({ result_id: ids[index], path, sort_order })),
  );
  if (photoRows.length === 0) return;

  const { error: photoError } = await supabase.from("insp_result_photos").insert(photoRows);
  if (photoError) throw new Error(`บันทึกรูปประกอบไม่สำเร็จ: ${photoError.message}`);
}

/** ยอดรวมที่เก็บลงหัวใบ — คำนวณจากผลรายข้อด้วยสูตรกลางเสมอ */
function headerTotals(
  results: InspResultInput[],
  template: Pick<InspTemplate, "bonus_threshold" | "bonus_amount"> | null,
) {
  const totals = totalsOf(results, template);
  return {
    total_score: totals.totalScore,
    max_score: totals.maxScore,
    score_pct: totals.scorePct,
    total_fine: totals.totalFine,
    bonus_amount: totals.bonusAmount,
    fail_count: totals.failCount,
  };
}

export async function createInspection(
  input: InspectionInput,
  results: InspResultInput[],
  createdBy: string | null,
): Promise<InspectionRow> {
  const template = input.template_id ? await getTemplate(input.template_id) : null;
  const doc_no = await nextDocNo(input.inspect_date);

  const { data, error } = await getSupabase()
    .from("insp_inspections")
    .insert({ ...input, doc_no, created_by: createdBy, ...headerTotals(results, template) })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบตรวจไม่สำเร็จ: ${error.message}`);

  const id = (data as Pick<Inspection, "id">).id;
  await replaceResults(id, results);

  return (await getInspection(id)) as InspectionRow;
}

export async function updateInspection(
  id: string,
  input: Partial<InspectionInput>,
  results: InspResultInput[],
): Promise<void> {
  const templateId = input.template_id ?? (await getInspection(id))?.template_id ?? null;
  const template = templateId ? await getTemplate(templateId) : null;

  const { error } = await getSupabase()
    .from("insp_inspections")
    .update({ ...input, ...headerTotals(results, template) })
    .eq("id", id);
  if (error) throw new Error(`บันทึกใบตรวจไม่สำเร็จ: ${error.message}`);

  await replaceResults(id, results);
}

/** เปลี่ยนเฉพาะสถานะใบ (ส่งผล / ยกเลิก) โดยไม่แตะผลรายข้อ */
export async function setInspectionStatus(id: string, status: Inspection["status"]): Promise<void> {
  const { error } = await getSupabase().from("insp_inspections").update({ status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะใบตรวจไม่สำเร็จ: ${error.message}`);
}

/** ลบใบตรวจ พร้อมรูปทั้งหมดของใบนั้น (ไม่ให้ไฟล์ค้างในถัง) */
export async function deleteInspection(id: string): Promise<{ filesDeleted: number }> {
  const paths = (await listResults(id)).flatMap((r) => r.photos);
  await removeInspectionFiles(paths);

  const { error } = await getSupabase().from("insp_inspections").delete().eq("id", id);
  if (error) throw new Error(`ลบใบตรวจไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

// ---------- ไฟล์รูปประกอบ ----------

export function newInspectionFilePath(originalName = ""): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `inspection/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadInspectionFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "image/jpeg", upsert: false });
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
}

export async function removeInspectionFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await getSupabase().storage.from(MEMO_BUCKET).remove(paths);
}

export async function inspectionFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * ข้อที่สาขาต่าง ๆ ทำได้ไม่เต็มคะแนนบ่อยที่สุด — บอกว่าควรอบรม/แก้กระบวนการเรื่องอะไรก่อน
 * นับเฉพาะใบที่ส่งผลแล้ว และเฉพาะข้อที่มีคะแนนเต็ม (ข้อปรับเงินอย่างเดียวไม่นับ)
 */
export async function listFailedItems(
  query: { from?: string | null; to?: string | null; branchId?: string | null } = {},
): Promise<{ label: string; count: number; fine: number }[]> {
  const inspections = await listInspections({
    status: "submitted",
    from: query.from,
    to: query.to,
    branch_id: query.branchId,
  });
  if (inspections.length === 0) return [];

  const { data, error } = await getSupabase()
    .from("insp_results")
    .select("section_name, item_name, score, max_score, fine_amount, inspection_id")
    .in(
      "inspection_id",
      inspections.map((i) => i.id),
    );
  if (error) throw new Error(`อ่านสรุปข้อที่ตกไม่สำเร็จ: ${error.message}`);

  const map = new Map<string, { count: number; fine: number }>();
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const max = num(raw.max_score);
    const score = num(raw.score);
    const fine = num(raw.fine_amount);
    if (max <= 0 || score >= max) continue;

    const label = `${raw.section_name} · ${raw.item_name}`;
    const cur = map.get(label) ?? { count: 0, fine: 0 };
    map.set(label, { count: cur.count + 1, fine: cur.fine + fine });
  }

  return [...map.entries()]
    .map(([label, v]) => ({ label, count: v.count, fine: Math.round(v.fine * 100) / 100 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

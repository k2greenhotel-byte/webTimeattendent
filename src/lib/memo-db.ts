import "server-only";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";
import type {
  MktActiveStatus,
  MktMemo,
  MktMemoFile,
  MktMemoQuery,
  MktMemoRow,
  MktMemoStatus,
  MktMemoStatusLog,
} from "./marketing-types";

/**
 * ทุก query ของ Memo (หน้าจอ 7 และ 8) อยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

function toRow(raw: Record<string, unknown>): MktMemoRow {
  return {
    ...(raw as unknown as MktMemoRow),
    file_count: Number(raw.file_count ?? 0),
    status_log_count: Number(raw.status_log_count ?? 0),
  };
}

export async function listMemos(query: MktMemoQuery = {}): Promise<MktMemoRow[]> {
  let q = getSupabase().from("v_mkt_memos").select("*");

  if (query.status) q = q.eq("status", query.status);
  if (query.active_status) q = q.eq("active_status", query.active_status);
  if (query.company_id) q = q.eq("company_id", query.company_id);
  if (query.staff_id) q = q.eq("created_by_staff_id", query.staff_id);
  if (query.from) q = q.gte("memo_date", query.from);
  if (query.to) q = q.lte("memo_date", query.to);

  const { data, error } = await q
    .order("memo_date", { ascending: false })
    .order("doc_no", { ascending: false });
  if (error) throw new Error(`อ่านรายการ Memo ไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    `${r.doc_no} ${r.detail ?? ""} ${r.company_name ?? ""}`.toLowerCase().includes(keyword),
  );
}

export async function getMemoRow(id: string): Promise<MktMemoRow | null> {
  const { data, error } = await getSupabase()
    .from("v_mkt_memos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`อ่าน Memo ไม่สำเร็จ: ${error.message}`);
  return data ? toRow(data as Record<string, unknown>) : null;
}

export async function listMemoFiles(memoId: string): Promise<MktMemoFile[]> {
  const { data, error } = await getSupabase()
    .from("mkt_memo_files")
    .select("id, path, filename, mime, size_bytes, sort_order")
    .eq("memo_id", memoId)
    .order("sort_order");

  if (error) throw new Error(`อ่านไฟล์แนบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as MktMemoFile[];
}

export async function listMemoStatusLogs(memoId: string): Promise<MktMemoStatusLog[]> {
  const { data, error } = await getSupabase()
    .from("mkt_memo_status_logs")
    .select("*, mkt_staff(name)")
    .eq("memo_id", memoId)
    .order("changed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`อ่านประวัติสถานะไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const staff = r.mkt_staff as { name?: string } | null;
    return {
      id: r.id as string,
      memo_id: r.memo_id as string,
      status: r.status as MktMemoStatus,
      changed_on: r.changed_on as string,
      changed_by_staff_id: (r.changed_by_staff_id as string) ?? null,
      changed_by_name: staff?.name ?? null,
      note: (r.note as string) ?? null,
      created_at: r.created_at as string,
    };
  });
}

export type MemoInput = {
  memo_date: string;
  company_id: string | null;
  detail: string | null;
  period_from: string | null;
  period_to: string | null;
  created_by_staff_id: string | null;
  status: MktMemoStatus;
  active_status: MktActiveStatus;
};

export type MemoFileInput = {
  path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
};

/** สร้าง Memo ใหม่ พร้อมออกเลขที่รันนิ่งตามปี พ.ศ. และบันทึกสถานะแรกลงประวัติ */
export async function createMemo(input: MemoInput, files: MemoFileInput[]): Promise<MktMemo> {
  const supabase = getSupabase();
  const beYear = Number(input.memo_date.slice(0, 4)) + 543;

  const { data: docNo, error: docError } = await supabase.rpc("mkt_next_memo_no", {
    be_year: beYear,
  });
  if (docError) throw new Error(`ออกเลขที่ Memo ไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("mkt_memos")
    .insert({ ...input, doc_no: docNo })
    .select("*")
    .single();

  if (error) throw new Error(`บันทึก Memo ไม่สำเร็จ: ${error.message}`);

  const memo = data as MktMemo;
  await replaceMemoFiles(memo.id, files);

  // บันทึกสถานะตั้งต้นลงประวัติ เพื่อให้ไล่ดูย้อนหลังได้ครบตั้งแต่ใบแรก
  await supabase.from("mkt_memo_status_logs").insert({
    memo_id: memo.id,
    status: input.status,
    changed_on: input.memo_date,
    changed_by_staff_id: input.created_by_staff_id,
    note: "สถานะตั้งต้นตอนสร้าง Memo",
  });

  return memo;
}

/** แก้ไขข้อมูล Memo (หน้าจอ 8 แก้ field ของหน้าจอ 7 ได้) — สถานะเปลี่ยนผ่าน changeMemoStatus เท่านั้น */
export async function updateMemo(
  id: string,
  input: Omit<MemoInput, "status">,
  files: MemoFileInput[],
): Promise<void> {
  const { error } = await getSupabase().from("mkt_memos").update(input).eq("id", id);
  if (error) throw new Error(`บันทึก Memo ไม่สำเร็จ: ${error.message}`);

  await replaceMemoFiles(id, files);
}

/** ตั้งชุดไฟล์แนบใหม่ทั้งชุด — ไฟล์ที่ถูกเอาออกจะถูกลบออกจาก storage ด้วย */
async function replaceMemoFiles(memoId: string, files: MemoFileInput[]): Promise<void> {
  const supabase = getSupabase();
  const current = await listMemoFiles(memoId);

  const keep = new Set(files.map((f) => f.path));
  const removed = current.filter((f) => !keep.has(f.path)).map((f) => f.path);
  if (removed.length > 0) await removeMemoFiles(removed);

  const { error: delError } = await supabase.from("mkt_memo_files").delete().eq("memo_id", memoId);
  if (delError) throw new Error(`อัปเดตไฟล์แนบไม่สำเร็จ: ${delError.message}`);

  if (files.length === 0) return;

  const { error } = await supabase
    .from("mkt_memo_files")
    .insert(files.map((f, i) => ({ memo_id: memoId, ...f, sort_order: i })));
  if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`);
}

/**
 * เปลี่ยนสถานะ Memo (หน้าจอ 8)
 * เขียน 2 ที่พร้อมกัน: สถานะปัจจุบันบนใบ Memo และแถวประวัติ — ฟังก์ชันนี้เป็นผู้เขียนตัวเดียว
 */
export async function changeMemoStatus(
  memoId: string,
  input: {
    status: MktMemoStatus;
    changed_on: string;
    changed_by_staff_id: string | null;
    note: string | null;
  },
): Promise<void> {
  const supabase = getSupabase();

  const { error: logError } = await supabase.from("mkt_memo_status_logs").insert({
    memo_id: memoId,
    status: input.status,
    changed_on: input.changed_on,
    changed_by_staff_id: input.changed_by_staff_id,
    note: input.note,
  });
  if (logError) throw new Error(`บันทึกประวัติสถานะไม่สำเร็จ: ${logError.message}`);

  const { error } = await supabase
    .from("mkt_memos")
    .update({ status: input.status })
    .eq("id", memoId);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
}

/** ลบ Memo พร้อมไฟล์แนบทั้งหมดใน storage (ประวัติสถานะถูกลบตามด้วย cascade) */
export async function deleteMemo(id: string): Promise<void> {
  const files = await listMemoFiles(id);
  await removeMemoFiles(files.map((f) => f.path));

  const { error } = await getSupabase().from("mkt_memos").delete().eq("id", id);
  if (error) throw new Error(`ลบ Memo ไม่สำเร็จ: ${error.message}`);
}

// ---------- ไฟล์แนบ ----------

/** เส้นทางไฟล์แนบ: mkt/files/{ปีเดือน}/{สุ่ม}.{นามสกุลเดิม} */
export function newFilePath(originalName: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `mkt/files/${ym}/${crypto.randomUUID()}${suffix}`;
}

/** ลบไฟล์ออกจากถัง (ทีละก้อน) — เรียกก่อนลบแถวในฐานข้อมูลเสมอ */
export async function removeMemoFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบไฟล์แนบไม่สำเร็จ:", error.message);
  }
}

/** signed URL ของไฟล์แนบ (ถังนี้เป็น private) */
export async function memoFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadMarketingFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: false });
  if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
}

import "server-only";
import { buildChecklist, scopeOf, totalsOf } from "./hotel";
import type {
  HtlChecklist,
  HtlGroup,
  HtlGroupInput,
  HtlItem,
  HtlItemInput,
  HtlIssueQuery,
  HtlIssueRow,
  HtlResultInput,
  HtlResultRow,
  HtlRound,
  HtlRoundInput,
  HtlRoundQuery,
  HtlRoundRow,
  HtlRoundStatus,
  HtlRoom,
  HtlRoomInput,
  HtlRoomRow,
  HtlScope,
} from "./hotel-types";
import { HTL_DOC_PREFIX } from "./hotel-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบตรวจเช็คโรงแรมประจำวันอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

function num(value: unknown): number {
  return Number(value ?? 0);
}

// ---------- รายการตรวจ (หน้าจอตั้งค่า ข้อ 5) ----------

export async function listGroups(includeInactive = false): Promise<HtlGroup[]> {
  let q = getSupabase().from("htl_groups").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านประเภทงานที่ตรวจไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as HtlGroup[];
}

export async function listItems(includeInactive = false): Promise<HtlItem[]> {
  let q = getSupabase().from("htl_items").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการตรวจเช็คไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as HtlItem[];
}

/**
 * รายการตรวจของงานหนึ่งครั้ง พร้อมใช้ในหน้าบันทึก
 *   scope           งานตรวจอาคาร หรืองานตรวจห้องพัก (คนละชุดรายการ)
 *   includeInactive true ใช้ในหน้าตั้งค่า (ต้องเห็นของที่ปิดใช้งานไว้ด้วย)
 */
export async function getChecklist(
  branchId: string | null,
  includeInactive = false,
  scope: HtlScope = "building",
): Promise<HtlChecklist> {
  const [groups, items] = await Promise.all([
    listGroups(includeInactive),
    listItems(includeInactive),
  ]);
  return buildChecklist(groups, items, branchId, includeInactive, scope);
}

// ---------- เพิ่ม / แก้ไข / ลบ รายการตรวจ ----------

function dupMessage(error: { code?: string; message: string }, what: string): string {
  return error.code === "23505"
    ? "รหัสนี้ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น"
    : `บันทึก${what}ไม่สำเร็จ: ${error.message}`;
}

export async function createGroup(input: HtlGroupInput): Promise<void> {
  const { error } = await getSupabase().from("htl_groups").insert(input);
  if (error) throw new Error(dupMessage(error, "ประเภทงาน"));
}

export async function updateGroup(id: string, patch: Partial<HtlGroupInput>): Promise<void> {
  const { error } = await getSupabase().from("htl_groups").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "ประเภทงาน"));
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from("htl_groups").delete().eq("id", id);
  if (error) throw new Error(`ลบประเภทงานไม่สำเร็จ: ${error.message}`);
}

export async function createItem(input: HtlItemInput): Promise<void> {
  const { error } = await getSupabase().from("htl_items").insert(input);
  if (error) throw new Error(dupMessage(error, "รายการตรวจเช็ค"));
}

export async function updateItem(id: string, patch: Partial<HtlItemInput>): Promise<void> {
  const { error } = await getSupabase().from("htl_items").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "รายการตรวจเช็ค"));
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("htl_items").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการตรวจเช็คไม่สำเร็จ: ${error.message}`);
}

/** จำนวนใบตรวจที่เคยใช้รายการนี้ไปแล้ว — ใช้เตือนก่อนลบ (ผลเก่ายังอ่านออกเพราะเก็บสำเนาชื่อไว้) */
export async function countItemUsage(itemId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("htl_results")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  if (error) throw new Error(`ตรวจการใช้งานรายการไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/** จำนวนรายการที่อยู่ใต้ประเภทงานนี้ — ลบประเภทงานแล้วรายการจะหายตามไปด้วย (cascade) */
export async function countGroupItems(groupId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("htl_items")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) throw new Error(`ตรวจการใช้งานประเภทงานไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/**
 * คัดลอกชุดรายการตรวจของสาขาหนึ่งไปให้สาขาอื่น (หน้าตั้งค่า)
 *
 * แต่ละสาขาตรวจไม่เหมือนกัน แต่ส่วนใหญ่ต่างกันแค่ไม่กี่ข้อ
 * การตั้งค่าใหม่ทีละสาขาจากศูนย์จึงเสียเวลาเกินจำเป็น — คัดลอกแล้วค่อยลบข้อที่ไม่ใช้จะเร็วกว่ามาก
 *
 * ข้ามรายการที่สาขาปลายทางมี "ชื่อเดียวกัน" อยู่แล้ว จะได้กดซ้ำได้โดยไม่เกิดของซ้ำ
 * รหัสรายการใหม่ตั้งเป็น <รหัสเดิม>-<รหัสสาขา> เพราะรหัสต้องไม่ซ้ำทั้งระบบ
 */
export async function copyItemsToBranches(input: {
  sourceBranchId: string | null;
  targetBranchIds: string[];
  scope: HtlScope;
}): Promise<{ copied: number; skipped: number }> {
  const { sourceBranchId, targetBranchIds, scope } = input;
  if (targetBranchIds.length === 0) return { copied: 0, skipped: 0 };

  const [allItems, branches] = await Promise.all([
    listItems(true),
    getSupabase().from("branches").select("id, code").in("id", targetBranchIds),
  ]);
  if (branches.error) throw new Error(`อ่านรายชื่อสาขาไม่สำเร็จ: ${branches.error.message}`);

  const codeOfBranch = new Map(
    ((branches.data ?? []) as { id: string; code: string }[]).map((b) => [b.id, b.code]),
  );

  const source = allItems.filter(
    (i) => i.scope === scope && (i.branch_id ?? null) === sourceBranchId,
  );
  if (source.length === 0) return { copied: 0, skipped: 0 };

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const targetId of targetBranchIds) {
    if (targetId === sourceBranchId) continue;

    const existingNames = new Set(
      allItems.filter((i) => i.scope === scope && i.branch_id === targetId).map((i) => i.name),
    );
    const branchCode = codeOfBranch.get(targetId) ?? targetId.slice(0, 4);

    for (const item of source) {
      if (existingNames.has(item.name)) {
        skipped += 1;
        continue;
      }
      rows.push({
        group_id: item.group_id,
        branch_id: targetId,
        code: `${item.code}-${branchCode}`.slice(0, 60),
        name: item.name,
        note: item.note,
        scope: item.scope,
        require_photo: item.require_photo,
        require_photo_on_fail: item.require_photo_on_fail,
        default_priority: item.default_priority,
        sort_order: item.sort_order,
        is_active: item.is_active,
      });
    }
  }

  if (rows.length === 0) return { copied: 0, skipped };

  const { error } = await getSupabase().from("htl_items").insert(rows);
  if (error) throw new Error(`คัดลอกรายการตรวจไม่สำเร็จ: ${error.message}`);

  return { copied: rows.length, skipped };
}

// ---------- ห้องพัก (หน้าจอตั้งค่า) ----------

/** ห้องพักทั้งหมด พร้อมชื่อสาขา — เรียงตามสาขาแล้วตามลำดับห้อง */
export async function listRooms(
  branchId: string | null = null,
  includeInactive = false,
): Promise<HtlRoomRow[]> {
  let q = getSupabase().from("htl_rooms").select("*, branches(name)");
  if (branchId) q = q.eq("branch_id", branchId);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายชื่อห้องพักไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const branch = row.branches as { name?: string } | null;
    delete row.branches;
    return { ...(row as unknown as HtlRoom), branch_name: branch?.name ?? null };
  });
}

export async function createRoom(input: HtlRoomInput): Promise<void> {
  const { error } = await getSupabase().from("htl_rooms").insert(input);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "สาขานี้มีเบอร์ห้องนี้อยู่แล้ว กรุณาใช้เบอร์ห้องอื่น"
        : `บันทึกห้องพักไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** เพิ่มหลายห้องพร้อมกัน — ข้ามห้องที่มีอยู่แล้ว แล้วคืนจำนวนที่เพิ่มได้จริง */
export async function createRooms(
  branchId: string,
  codes: string[],
  startSort = 100,
): Promise<{ added: number; skipped: string[] }> {
  if (codes.length === 0) return { added: 0, skipped: [] };

  const existing = new Set((await listRooms(branchId, true)).map((r) => r.code));
  const fresh = codes.filter((c) => !existing.has(c));
  const skipped = codes.filter((c) => existing.has(c));
  if (fresh.length === 0) return { added: 0, skipped };

  const { error } = await getSupabase()
    .from("htl_rooms")
    .insert(
      fresh.map((code, index) => ({
        branch_id: branchId,
        code,
        sort_order: startSort + index * 10,
        is_active: true,
      })),
    );
  if (error) throw new Error(`เพิ่มห้องพักไม่สำเร็จ: ${error.message}`);

  return { added: fresh.length, skipped };
}

export async function updateRoom(id: string, patch: Partial<HtlRoomInput>): Promise<void> {
  const { error } = await getSupabase().from("htl_rooms").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "สาขานี้มีเบอร์ห้องนี้อยู่แล้ว กรุณาใช้เบอร์ห้องอื่น"
        : `บันทึกห้องพักไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function deleteRoom(id: string): Promise<void> {
  const { error } = await getSupabase().from("htl_rooms").delete().eq("id", id);
  if (error) throw new Error(`ลบห้องพักไม่สำเร็จ: ${error.message}`);
}

/** จำนวนใบตรวจที่เคยออกให้ห้องนี้ — ใช้เตือนก่อนลบ (ใบเก่ายังอ่านออกเพราะเก็บสำเนาเบอร์ห้องไว้) */
export async function countRoomUsage(roomId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("htl_rounds")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if (error) throw new Error(`ตรวจการใช้งานห้องพักไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

// ---------- ใบตรวจเช็คประจำวัน ----------

function toRoundRow(raw: Record<string, unknown>): HtlRoundRow {
  return {
    ...(raw as unknown as HtlRoundRow),
    total_items: num(raw.total_items),
    checked_count: num(raw.checked_count),
    pass_count: num(raw.pass_count),
    fail_count: num(raw.fail_count),
    na_count: num(raw.na_count),
    urgent_count: num(raw.urgent_count),
    soon_count: num(raw.soon_count),
    later_count: num(raw.later_count),
    open_fix_count: num(raw.open_fix_count),
    pass_pct: num(raw.pass_pct),
    photo_count: num(raw.photo_count),
  };
}

/** รายการใบตรวจตามเงื่อนไข — หน้ารายการ สอบถาม dashboard และจอ War Room ใช้ตัวนี้ตัวเดียว */
export async function listRounds(query: HtlRoundQuery = {}): Promise<HtlRoundRow[]> {
  let q = getSupabase().from("v_htl_rounds").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    room_id: query.room_id,
    status: query.status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  // ใบตรวจอาคารคือใบที่ไม่มีห้องผูกอยู่ ส่วนใบตรวจห้องพักคือใบที่มีห้อง
  if (query.scope === "building") q = q.is("room_id", null);
  if (query.scope === "room") q = q.not("room_id", "is", null);

  if (query.from) q = q.gte("check_date", query.from);
  if (query.to) q = q.lte("check_date", query.to);

  const { data, error } = await q
    .order("check_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบตรวจเช็คไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toRoundRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.branch_name, r.room_code, r.company_name, r.inspector_name, r.note]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getRound(id: string): Promise<HtlRoundRow | null> {
  const { data, error } = await getSupabase()
    .from("v_htl_rounds")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบตรวจเช็คไม่สำเร็จ: ${error.message}`);
  return data ? toRoundRow(data as Record<string, unknown>) : null;
}

/** ใบตรวจอาคารของสาขานี้ในวันนั้น (ถ้ามี) — กันเปิดใบซ้ำ และพาไปแก้ใบเดิมแทน */
export async function findRoundByBranchDate(
  branchId: string,
  checkDate: string,
): Promise<HtlRoundRow | null> {
  const { data, error } = await getSupabase()
    .from("v_htl_rounds")
    .select("*")
    .eq("branch_id", branchId)
    .eq("check_date", checkDate)
    .is("room_id", null)
    .maybeSingle();
  if (error) throw new Error(`ตรวจใบซ้ำของสาขาไม่สำเร็จ: ${error.message}`);
  return data ? toRoundRow(data as Record<string, unknown>) : null;
}

/** ใบตรวจของห้องนี้ในวันนั้น (ถ้ามี) — กันเปิดใบซ้ำรายห้อง */
export async function findRoundByRoomDate(
  roomId: string,
  checkDate: string,
): Promise<HtlRoundRow | null> {
  const { data, error } = await getSupabase()
    .from("v_htl_rounds")
    .select("*")
    .eq("room_id", roomId)
    .eq("check_date", checkDate)
    .maybeSingle();
  if (error) throw new Error(`ตรวจใบซ้ำของห้องพักไม่สำเร็จ: ${error.message}`);
  return data ? toRoundRow(data as Record<string, unknown>) : null;
}

/** ผลรายข้อของใบตรวจ พร้อมรูปที่แนบไว้ */
export async function listResults(roundId: string): Promise<HtlResultRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("htl_results")
    .select("*")
    .eq("round_id", roundId)
    .order("group_sort")
    .order("sort_order");
  if (error) throw new Error(`อ่านผลการตรวจรายข้อไม่สำเร็จ: ${error.message}`);

  const results = (data ?? []).map((raw) => ({
    ...(raw as unknown as HtlResultRow),
    photos: [] as string[],
  }));
  if (results.length === 0) return results;

  const { data: photoRows, error: photoError } = await supabase
    .from("htl_result_photos")
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

async function nextDocNo(date: string, scope: HtlScope): Promise<string> {
  const { data, error } = await getSupabase().rpc("htl_next_doc_no", {
    doc_prefix: HTL_DOC_PREFIX[scope],
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่ใบตรวจเช็คไม่สำเร็จ: ${error.message}`);
  return data as string;
}

/** ยอดสรุปที่เก็บลงหัวใบ — คำนวณจากผลรายข้อด้วยสูตรกลางเสมอ */
function headerTotals(results: HtlResultInput[]) {
  const t = totalsOf(results);
  return {
    total_items: t.totalItems,
    checked_count: t.checkedCount,
    pass_count: t.passCount,
    fail_count: t.failCount,
    na_count: t.naCount,
    urgent_count: t.urgentCount,
    soon_count: t.soonCount,
    later_count: t.laterCount,
    open_fix_count: t.openFixCount,
    pass_pct: t.passPct,
  };
}

/** เขียนผลรายข้อทั้งชุดใหม่ (ลบของเดิมทิ้งก่อน) พร้อมรูปของแต่ละข้อ */
async function replaceResults(roundId: string, results: HtlResultInput[]): Promise<void> {
  const supabase = getSupabase();

  // ลบไฟล์ที่ถูกเอาออกจากฟอร์ม ไม่ให้ค้างในถัง
  const keep = new Set(results.flatMap((r) => r.photos));
  const old = await listResults(roundId);
  const orphans = old.flatMap((r) => r.photos).filter((p) => !keep.has(p));
  if (orphans.length > 0) await removeHotelFiles(orphans);

  const { error: delError } = await supabase.from("htl_results").delete().eq("round_id", roundId);
  if (delError) throw new Error(`ล้างผลการตรวจเดิมไม่สำเร็จ: ${delError.message}`);

  if (results.length === 0) return;

  const { data, error } = await supabase
    .from("htl_results")
    .insert(
      results.map((r) => ({
        round_id: roundId,
        item_id: r.item_id,
        group_name: r.group_name,
        group_sort: r.group_sort,
        item_name: r.item_name,
        sort_order: r.sort_order,
        result: r.result,
        note: r.note,
        priority: r.result === "fail" ? (r.priority ?? "soon") : null,
        is_fixed: r.result === "fail" ? r.is_fixed : false,
        fixed_at: r.result === "fail" && r.is_fixed ? new Date().toISOString() : null,
        fixed_note: r.result === "fail" ? r.fixed_note : null,
        repair_id: r.repair_id,
        repair_doc_no: r.repair_doc_no,
      })),
    )
    .select("id");
  if (error) throw new Error(`บันทึกผลการตรวจรายข้อไม่สำเร็จ: ${error.message}`);

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  const photoRows = results.flatMap((r, index) =>
    r.photos.map((path, sort_order) => ({ result_id: ids[index], path, sort_order })),
  );
  if (photoRows.length === 0) return;

  const { error: photoError } = await supabase.from("htl_result_photos").insert(photoRows);
  if (photoError) throw new Error(`บันทึกรูปประกอบไม่สำเร็จ: ${photoError.message}`);
}

export async function createRound(
  input: HtlRoundInput,
  results: HtlResultInput[],
  createdBy: string | null,
): Promise<HtlRoundRow> {
  const scope = scopeOf(input);
  const doc_no = await nextDocNo(input.check_date, scope);

  const { data, error } = await getSupabase()
    .from("htl_rounds")
    .insert({ ...input, doc_no, created_by: createdBy, ...headerTotals(results) })
    .select("id")
    .single();

  if (error) {
    // ชนกับ unique index = มีคนเปิดใบของจุดนี้ในวันนั้นไว้แล้ว
    if (error.code === "23505") {
      throw new Error(
        scope === "room"
          ? "ห้องนี้มีใบตรวจเช็คของวันนั้นอยู่แล้ว กรุณาเปิดใบเดิมแล้วแก้ไขต่อ แทนการเปิดใบใหม่"
          : "สาขานี้มีใบตรวจเช็คอาคารของวันนั้นอยู่แล้ว กรุณาเปิดใบเดิมแล้วแก้ไขต่อ แทนการเปิดใบใหม่",
      );
    }
    throw new Error(`บันทึกใบตรวจเช็คไม่สำเร็จ: ${error.message}`);
  }

  const id = (data as Pick<HtlRound, "id">).id;
  await replaceResults(id, results);

  return (await getRound(id)) as HtlRoundRow;
}

export async function updateRound(
  id: string,
  input: Partial<HtlRoundInput>,
  results: HtlResultInput[],
): Promise<void> {
  const { error } = await getSupabase()
    .from("htl_rounds")
    .update({ ...input, ...headerTotals(results) })
    .eq("id", id);
  if (error) throw new Error(`บันทึกใบตรวจเช็คไม่สำเร็จ: ${error.message}`);

  await replaceResults(id, results);
}

/** เปลี่ยนเฉพาะสถานะใบ (ส่งผล / ยกเลิก) โดยไม่แตะผลรายข้อ */
export async function setRoundStatus(id: string, status: HtlRoundStatus): Promise<void> {
  const { error } = await getSupabase().from("htl_rounds").update({ status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะใบตรวจเช็คไม่สำเร็จ: ${error.message}`);
}

/** ลบใบตรวจ พร้อมรูปทั้งหมดของใบนั้น (ไม่ให้ไฟล์ค้างในถัง) */
export async function deleteRound(id: string): Promise<{ filesDeleted: number }> {
  const paths = (await listResults(id)).flatMap((r) => r.photos);
  await removeHotelFiles(paths);

  const { error } = await getSupabase().from("htl_rounds").delete().eq("id", id);
  if (error) throw new Error(`ลบใบตรวจเช็คไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

// ---------- ข้อที่ต้องแก้ไข (หน้าจอ 2) ----------

export async function listIssues(query: HtlIssueQuery = {}): Promise<HtlIssueRow[]> {
  let q = getSupabase().from("v_htl_issues").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    room_id: query.room_id,
    group_name: query.group_name,
    priority: query.priority,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.fixed === true) q = q.eq("is_fixed", true);
  if (query.fixed === false) q = q.eq("is_fixed", false);
  if (query.from) q = q.gte("check_date", query.from);
  if (query.to) q = q.lte("check_date", query.to);

  const { data, error } = await q
    .order("check_date", { ascending: false })
    .order("group_sort")
    .order("sort_order")
    .limit(query.limit ?? 1000);
  if (error) throw new Error(`อ่านรายการที่ต้องแก้ไขไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((raw) => ({
    ...(raw as unknown as HtlIssueRow),
    photo_count: num((raw as Record<string, unknown>).photo_count),
  }));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [
      r.doc_no,
      r.item_name,
      r.group_name,
      r.branch_name,
      r.room_code,
      r.note,
      r.repair_doc_no,
      r.repair_ref_no,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getIssue(resultId: string): Promise<HtlIssueRow | null> {
  const { data, error } = await getSupabase()
    .from("v_htl_issues")
    .select("*")
    .eq("result_id", resultId)
    .maybeSingle();
  if (error) throw new Error(`อ่านรายการที่ต้องแก้ไขไม่สำเร็จ: ${error.message}`);
  return data ? ({ ...(data as unknown as HtlIssueRow) } as HtlIssueRow) : null;
}

/**
 * อัปเดตข้อที่ไม่ปกติหนึ่งข้อจากหน้า "รายการที่ต้องแก้ไข"
 * แล้วคำนวณยอดสรุปบนหัวใบใหม่ ให้ dashboard/War Room ตรงกับผลรายข้อเสมอ
 */
export async function updateIssue(
  resultId: string,
  patch: {
    priority?: HtlResultInput["priority"];
    is_fixed?: boolean;
    fixed_note?: string | null;
    repair_id?: string | null;
    repair_doc_no?: string | null;
  },
): Promise<string> {
  const supabase = getSupabase();

  const { data: current, error: readError } = await supabase
    .from("htl_results")
    .select("round_id, is_fixed")
    .eq("id", resultId)
    .maybeSingle();
  if (readError) throw new Error(`อ่านข้อที่ต้องแก้ไขไม่สำเร็จ: ${readError.message}`);
  if (!current) throw new Error("ไม่พบรายการที่ต้องแก้ไขนี้");

  const row = current as { round_id: string; is_fixed: boolean };
  const next: Record<string, unknown> = { ...patch };

  // ประทับเวลาที่ปิดงานด้วยเวลา server เสมอ ไม่รับค่าจาก browser
  if (patch.is_fixed !== undefined && patch.is_fixed !== row.is_fixed) {
    next.fixed_at = patch.is_fixed ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("htl_results").update(next).eq("id", resultId);
  if (error) throw new Error(`บันทึกการแก้ไขไม่สำเร็จ: ${error.message}`);

  await refreshRoundTotals(row.round_id);
  return row.round_id;
}

/** คิดยอดสรุปบนหัวใบใหม่จากผลรายข้อที่มีอยู่จริงในฐานข้อมูล */
export async function refreshRoundTotals(roundId: string): Promise<void> {
  const results = await listResults(roundId);
  const totals = headerTotals(
    results.map((r) => ({
      ...r,
      photos: r.photos,
    })) as unknown as HtlResultInput[],
  );

  const { error } = await getSupabase().from("htl_rounds").update(totals).eq("id", roundId);
  if (error) throw new Error(`ปรับยอดสรุปของใบตรวจไม่สำเร็จ: ${error.message}`);
}

// ---------- ไฟล์รูปประกอบ ----------

export function newHotelFilePath(originalName = ""): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `hotel/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadHotelFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "image/jpeg", upsert: false });
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
}

export async function removeHotelFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await getSupabase().storage.from(MEMO_BUCKET).remove(paths);
}

export async function hotelFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

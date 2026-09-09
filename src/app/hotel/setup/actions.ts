"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { parseRoomCodes, validateItem, validateRoom } from "@/lib/hotel";
import {
  copyItemsToBranches,
  countGroupItems,
  countItemUsage,
  countRoomUsage,
  createGroup,
  createItem,
  createRoom,
  createRooms,
  deleteGroup,
  deleteItem,
  deleteRoom,
  listGroups,
  listItems,
  listRooms,
  updateGroup,
  updateItem,
  updateRoom,
} from "@/lib/hotel-db";
import {
  HTL_PRIORITY_ORDER,
  HTL_SCOPE_ORDER,
  HTL_SCOPE_SHORT,
  type HtlPriority,
  type HtlScope,
} from "@/lib/hotel-types";
import { requirePermission } from "@/lib/session";

/**
 * หน้าจอ 5 — ตั้งค่ารายการที่ตรวจเช็ค
 * แอดมินเพิ่ม/ลด/แก้ได้ 2 ชั้น: ประเภทงาน → รายการตรวจ
 * ทุกครั้งที่แก้ต้องเขียน audit_logs เพราะกระทบใบตรวจที่จะเปิดต่อจากนี้ทั้งหมด
 */

const PATH = "/hotel/setup";
const ROOM_PATH = "/hotel/setup/rooms";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function bool(form: FormData, key: string): boolean {
  const value = str(form, key);
  return value === "on" || value === "1";
}

function numOf(form: FormData, key: string, fallback = 100): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) && str(form, key) !== "" ? value : fallback;
}

function priorityOf(form: FormData, key: string): HtlPriority {
  const value = str(form, key);
  return (HTL_PRIORITY_ORDER as string[]).includes(value) ? (value as HtlPriority) : "soon";
}

function scopeOfForm(form: FormData, key = "scope"): HtlScope {
  const value = str(form, key);
  return (HTL_SCOPE_ORDER as string[]).includes(value) ? (value as HtlScope) : "building";
}

/**
 * กลับหน้าตั้งค่า โดยคงมุมมองเดิมไว้ทั้งหมด
 * (ขอบเขตงาน · สาขาที่กำลังดู · ประเภทงานที่เปิดอยู่) ไม่งั้นแอดมินต้องเลือกใหม่ทุกครั้งที่กดบันทึก
 */
function back(form: FormData, message: string, isError = false): never {
  const query = new URLSearchParams();
  for (const key of ["scope", "branch", "tab"]) {
    const value = str(form, key);
    if (value) query.set(key, value);
  }
  query.set(isError ? "err" : "msg", message);
  redirect(`${str(form, "back") || PATH}?${query}`);
}

function done(form: FormData, message: string): never {
  revalidatePath(PATH);
  revalidatePath(ROOM_PATH);
  revalidatePath("/hotel/rounds/new");
  revalidatePath("/hotel/rooms/new");
  back(form, message);
}

async function audit(
  actorId: string,
  action: string,
  table: string,
  id: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  await logAudit({ actor_id: actorId, action, target_table: table, target_id: id, after: detail });
}

// ---------- ประเภทงาน ----------

export async function saveGroupForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("HTL_SETUP", id ? "edit" : "write");

  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");
  if (!code) back(form, "กรุณาใส่รหัสประเภทงาน", true);
  if (!name) back(form, "กรุณาใส่ชื่อประเภทงาน", true);

  const existing = await listGroups(true);
  if (existing.some((g) => g.id !== id && g.code === code)) {
    back(form, `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`, true);
  }

  const input = {
    code,
    name,
    note: optText(form, "note"),
    scope: scopeOfForm(form),
    sort_order: numOf(form, "sort_order"),
    is_active: bool(form, "is_active"),
  };

  try {
    if (id) await updateGroup(id, input);
    else await createGroup(input);
    await audit(
      user.id,
      id ? "แก้ไขประเภทงานตรวจเช็คโรงแรม" : "เพิ่มประเภทงานตรวจเช็คโรงแรม",
      "htl_groups",
      id || null,
      input,
    );
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกประเภทงานไม่สำเร็จ", true);
  }

  done(form, id ? `แก้ไขประเภทงาน ${name} แล้ว` : `เพิ่มประเภทงาน ${name} แล้ว`);
}

export async function deleteGroupForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") {
    back(form, "กรุณาติ๊กยืนยันก่อนลบประเภทงาน", true);
  }

  const groups = await listGroups(true);
  const group = groups.find((g) => g.id === id);
  if (!group) back(form, "ไม่พบประเภทงานที่ต้องการลบ", true);

  const itemCount = await countGroupItems(id);

  try {
    await deleteGroup(id);
    await audit(user.id, "ลบประเภทงานตรวจเช็คโรงแรม", "htl_groups", id, {
      code: group.code,
      name: group.name,
      items_deleted: itemCount,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบประเภทงานไม่สำเร็จ", true);
  }

  done(
    form,
    itemCount > 0
      ? `ลบประเภทงาน ${group.name} พร้อมรายการตรวจ ${itemCount} รายการแล้ว`
      : `ลบประเภทงาน ${group.name} แล้ว`,
  );
}

// ---------- รายการตรวจ ----------

export async function saveItemForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("HTL_SETUP", id ? "edit" : "write");

  const input = {
    group_id: str(form, "group_id"),
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    note: optText(form, "note"),
    branch_id: optText(form, "branch_id"),
    scope: scopeOfForm(form),
    require_photo: bool(form, "require_photo"),
    require_photo_on_fail: bool(form, "require_photo_on_fail"),
    default_priority: priorityOf(form, "default_priority"),
    sort_order: numOf(form, "sort_order"),
    is_active: bool(form, "is_active"),
  };

  const existing = await listItems(true);
  const usedCodes = existing.filter((i) => i.id !== id).map((i) => i.code);

  const problem = validateItem(input, usedCodes);
  if (problem) back(form, problem, true);

  try {
    if (id) await updateItem(id, input);
    else await createItem(input);
    await audit(
      user.id,
      id ? "แก้ไขรายการตรวจเช็คโรงแรม" : "เพิ่มรายการตรวจเช็คโรงแรม",
      "htl_items",
      id || null,
      input,
    );
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกรายการตรวจไม่สำเร็จ", true);
  }

  done(form, id ? `แก้ไขรายการ ${input.name} แล้ว` : `เพิ่มรายการ ${input.name} แล้ว`);
}

export async function deleteItemForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") {
    back(form, "กรุณาติ๊กยืนยันก่อนลบรายการตรวจ", true);
  }

  const items = await listItems(true);
  const item = items.find((i) => i.id === id);
  if (!item) back(form, "ไม่พบรายการตรวจที่ต้องการลบ", true);

  // ผลเก่ายังอ่านออกเพราะ htl_results เก็บสำเนาชื่อรายการไว้ตอนตรวจ
  const usage = await countItemUsage(id);

  try {
    await deleteItem(id);
    await audit(user.id, "ลบรายการตรวจเช็คโรงแรม", "htl_items", id, {
      code: item.code,
      name: item.name,
      used_in_results: usage,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบรายการตรวจไม่สำเร็จ", true);
  }

  done(
    form,
    usage > 0
      ? `ลบรายการ ${item.name} แล้ว — ใบตรวจเก่า ${usage} ข้อยังอ่านผลได้เหมือนเดิม`
      : `ลบรายการ ${item.name} แล้ว`,
  );
}

// ---------- คัดลอกชุดรายการตรวจไปสาขาอื่น ----------

/**
 * แต่ละสาขาตรวจไม่เหมือนกัน แต่ส่วนใหญ่ต่างกันแค่ไม่กี่ข้อ
 * ปุ่มนี้ก๊อปชุดของสาขาต้นทางไปให้สาขาปลายทางทีเดียวหลายสาขา แล้วค่อยไปลบข้อที่ไม่ใช้ทีหลัง
 */
export async function copyItemsForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_SETUP", "write");

  const scope = scopeOfForm(form);
  const sourceBranchId = optText(form, "source_branch_id");
  const targetBranchIds = form
    .getAll("target_branch_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (targetBranchIds.length === 0) back(form, "กรุณาเลือกสาขาปลายทางอย่างน้อยหนึ่งสาขา", true);

  try {
    const { copied, skipped } = await copyItemsToBranches({
      sourceBranchId,
      targetBranchIds,
      scope,
    });

    if (copied === 0) {
      back(
        form,
        skipped > 0
          ? "สาขาปลายทางมีรายการชื่อเดียวกันครบอยู่แล้ว จึงไม่ได้คัดลอกเพิ่ม"
          : "สาขาต้นทางยังไม่มีรายการตรวจให้คัดลอก",
        true,
      );
    }

    await audit(user.id, "คัดลอกรายการตรวจเช็คไปสาขาอื่น", "htl_items", null, {
      scope,
      source_branch_id: sourceBranchId,
      target_branch_ids: targetBranchIds,
      copied,
      skipped,
    });

    done(
      form,
      `คัดลอกรายการตรวจ${HTL_SCOPE_SHORT[scope]} ${copied} รายการ ไปยัง ${targetBranchIds.length} สาขาแล้ว` +
        (skipped > 0 ? ` (ข้ามที่มีชื่อซ้ำอยู่แล้ว ${skipped} รายการ)` : ""),
    );
  } catch (err) {
    if (err instanceof Error && !/NEXT_REDIRECT/.test(err.message)) {
      back(form, err.message, true);
    }
    throw err;
  }
}

// ---------- ห้องพัก ----------

export async function saveRoomForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("HTL_SETUP", id ? "edit" : "write");

  const branchId = str(form, "branch_id");
  const code = str(form, "code");

  const usedCodes = (await listRooms(branchId, true))
    .filter((r) => r.id !== id)
    .map((r) => r.code);

  const problem = validateRoom({ branch_id: branchId, code }, usedCodes);
  if (problem) back(form, problem, true);

  const input = {
    branch_id: branchId,
    code,
    name: optText(form, "name"),
    note: optText(form, "note"),
    sort_order: numOf(form, "sort_order"),
    is_active: bool(form, "is_active"),
  };

  try {
    if (id) await updateRoom(id, input);
    else await createRoom(input);
    await audit(
      user.id,
      id ? "แก้ไขห้องพัก (ตรวจเช็คโรงแรม)" : "เพิ่มห้องพัก (ตรวจเช็คโรงแรม)",
      "htl_rooms",
      id || null,
      input,
    );
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกห้องพักไม่สำเร็จ", true);
  }

  done(form, id ? `แก้ไขห้อง ${code} แล้ว` : `เพิ่มห้อง ${code} แล้ว`);
}

/** เพิ่มหลายห้องพร้อมกัน — พิมพ์ "V1, V2, V3, 801" รวดเดียวได้เลย */
export async function addRoomsForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_SETUP", "write");

  const branchId = str(form, "branch_id");
  if (!branchId) back(form, "กรุณาเลือกสาขาที่จะเพิ่มห้อง", true);

  const codes = parseRoomCodes(str(form, "codes"));
  if (codes.length === 0) back(form, "กรุณาพิมพ์เบอร์ห้องอย่างน้อยหนึ่งห้อง", true);

  try {
    const existing = await listRooms(branchId, true);
    const startSort = existing.reduce((max, r) => Math.max(max, r.sort_order), 0) + 10;

    const { added, skipped } = await createRooms(branchId, codes, startSort);
    if (added === 0) back(form, "ห้องที่พิมพ์มามีอยู่ในสาขานี้แล้วทั้งหมด", true);

    await audit(user.id, "เพิ่มห้องพักหลายห้อง (ตรวจเช็คโรงแรม)", "htl_rooms", null, {
      branch_id: branchId,
      added,
      skipped,
    });

    done(
      form,
      `เพิ่มห้องพัก ${added} ห้องแล้ว` +
        (skipped.length > 0 ? ` (ข้ามห้องที่มีอยู่แล้ว: ${skipped.join(", ")})` : ""),
    );
  } catch (err) {
    if (err instanceof Error && !/NEXT_REDIRECT/.test(err.message)) {
      back(form, err.message, true);
    }
    throw err;
  }
}

export async function deleteRoomForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนลบห้องพัก", true);

  const room = (await listRooms(null, true)).find((r) => r.id === id);
  if (!room) back(form, "ไม่พบห้องพักที่ต้องการลบ", true);

  // ใบตรวจเก่ายังอ่านออกเพราะ htl_rounds เก็บสำเนาเบอร์ห้องไว้ตอนตรวจ
  const usage = await countRoomUsage(id);

  try {
    await deleteRoom(id);
    await audit(user.id, "ลบห้องพัก (ตรวจเช็คโรงแรม)", "htl_rooms", id, {
      branch_id: room.branch_id,
      code: room.code,
      used_in_rounds: usage,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบห้องพักไม่สำเร็จ", true);
  }

  done(
    form,
    usage > 0
      ? `ลบห้อง ${room.code} แล้ว — ใบตรวจเก่า ${usage} ใบยังอ่านผลได้เหมือนเดิม`
      : `ลบห้อง ${room.code} แล้ว`,
  );
}

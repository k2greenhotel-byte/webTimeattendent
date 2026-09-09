"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listCompanies } from "@/lib/core-db";
import { getBranchById, logAudit } from "@/lib/db";
import { validateResult, validateRound } from "@/lib/hotel";
import {
  createRound,
  deleteRound,
  getChecklist,
  getRound,
  listResults,
  listRooms,
  setRoundStatus,
  updateIssue,
  updateRound,
} from "@/lib/hotel-db";
import {
  HTL_PRIORITY_ORDER,
  HTL_RESULT_ORDER,
  type HtlPriority,
  type HtlResultInput,
  type HtlResultValue,
  type HtlRoundInput,
  type HtlRoundStatus,
  type HtlScope,
} from "@/lib/hotel-types";
import { requirePermission } from "@/lib/session";

/** เส้นทางหน้ารายการของแต่ละงาน — งานอาคารกับงานห้องพักแยกหน้ากัน */
const LIST_PATH: Record<HtlScope, string> = {
  building: "/hotel/rounds",
  room: "/hotel/rooms",
};

/** ใบตรวจทุกใบเปิดดูที่หน้าเดียวกัน ไม่ว่าจะเป็นงานอาคารหรืองานห้องพัก */
const DOC_PATH = "/hotel/rounds";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

/** ต่อ msg/err เข้ากับปลายทาง — บางเส้นทางมี query อยู่ก่อนแล้ว (เช่น ?branch=&date=) ต้องใช้ & ไม่ใช่ ? */
function back(path: string, message: string, isError = false): never {
  const joiner = path.includes("?") ? "&" : "?";
  redirect(`${path}${joiner}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function statusOf(form: FormData): HtlRoundStatus {
  return str(form, "status") === "submitted" ? "submitted" : "draft";
}

/** ทุกหน้าที่อ่านยอดสรุปของโปรแกรมนี้ ต้องถูกล้าง cache พร้อมกันเสมอ */
function revalidateAll(roundId?: string): void {
  revalidatePath(LIST_PATH.building);
  revalidatePath(LIST_PATH.room);
  revalidatePath("/hotel/issues");
  revalidatePath("/hotel/search");
  revalidatePath("/hotel/dashboard");
  if (roundId) revalidatePath(`${DOC_PATH}/${roundId}`);
}

/**
 * ประกอบผลรายข้อจากฟอร์ม โดย **อ่านโครงรายการจากฐานข้อมูลเสมอ**
 * ไม่เชื่อชื่อรายการ/ลำดับที่ browser ส่งมา (ผู้ใช้แก้ค่าในหน้าเว็บได้)
 */
async function readResults(
  form: FormData,
  branchId: string,
  scope: HtlScope,
): Promise<{ results: HtlResultInput[]; problem: string | null }> {
  const checklist = await getChecklist(branchId, false, scope);

  const results: HtlResultInput[] = [];
  let problem: string | null = null;

  for (const group of checklist.groups) {
    for (const item of group.items) {
      const photos = form
        .getAll(`photo_${item.id}`)
        .map((v) => String(v).trim())
        .filter(Boolean);

      const rawResult = str(form, `res_${item.id}`);
      const result = (HTL_RESULT_ORDER as string[]).includes(rawResult)
        ? (rawResult as HtlResultValue)
        : null;

      const rawPriority = str(form, `prio_${item.id}`);
      const priority = (HTL_PRIORITY_ORDER as string[]).includes(rawPriority)
        ? (rawPriority as HtlPriority)
        : item.default_priority;

      const row: HtlResultInput = {
        item_id: item.id,
        group_name: group.name,
        group_sort: group.sort_order,
        item_name: item.name,
        sort_order: item.sort_order,
        result,
        // หมายเหตุมีความหมายเฉพาะข้อที่ไม่ปกติ ข้ออื่นไม่ต้องเก็บให้รก
        note: result === "fail" ? optText(form, `note_${item.id}`) : null,
        priority: result === "fail" ? priority : null,
        is_fixed: result === "fail" && str(form, `fixed_${item.id}`) === "on",
        fixed_note: null,
        repair_id: null,
        repair_doc_no: result === "fail" ? optText(form, `repairno_${item.id}`) : null,
        photos,
      };

      if (!problem) problem = validateResult(row, item);
      results.push(row);
    }
  }

  return { results, problem };
}

/** เมนูที่คุมงานนี้ — งานอาคารอยู่ใต้ HTL_ENTRY ส่วนงานห้องพักอยู่ใต้ HTL_ROOM */
const MENU_OF: Record<HtlScope, string> = { building: "HTL_ENTRY", room: "HTL_ROOM" };

/** บันทึกใบตรวจเช็คใหม่ หรือแก้ไขใบเดิม (ปุ่ม "เก็บฉบับร่าง" / "ส่งผลการตรวจเช็ค") */
export async function saveRoundForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const branchId = str(form, "branch_id");
  const roomId = optText(form, "room_id");
  const scope: HtlScope = roomId ? "room" : "building";

  const user = await requirePermission(MENU_OF[scope], id ? "edit" : "write");

  const companyId = optText(form, "company_id");
  const checkDate = str(form, "check_date");
  const status = statusOf(form);

  const newQuery = new URLSearchParams({ branch: branchId, date: checkDate });
  if (roomId) newQuery.set("room", roomId);
  const backPath = id
    ? `${DOC_PATH}/${id}`
    : `${LIST_PATH[scope]}/new?${newQuery}`;

  const { results, problem } = await readResults(form, branchId, scope);

  const headerProblem = validateRound({
    branch_id: branchId,
    room_id: roomId,
    check_date: checkDate,
    results,
    scope,
  });
  if (headerProblem) back(backPath, headerProblem, true);

  // ฉบับร่างยอมให้ยังตรวจไม่ครบ — ตรวจครบเมื่อกดส่งผลเท่านั้น
  if (status === "submitted" && problem) back(backPath, problem, true);

  // เบอร์ห้องอ่านจากฐานข้อมูลเสมอ ไม่เชื่อค่าที่ browser ส่งมา
  const [branch, companies, rooms] = await Promise.all([
    getBranchById(branchId),
    companyId ? listCompanies() : Promise.resolve([]),
    roomId ? listRooms(branchId, true) : Promise.resolve([]),
  ]);
  const company = companies.find((c) => c.id === companyId) ?? null;
  const room = rooms.find((r) => r.id === roomId) ?? null;

  if (roomId && !room) back(backPath, "ไม่พบห้องพักที่เลือก กรุณาเลือกใหม่", true);

  const input: HtlRoundInput = {
    check_date: checkDate,
    company_id: companyId,
    company_name: company?.name ?? null,
    branch_id: branchId,
    branch_name: branch?.name ?? null,
    room_id: room?.id ?? null,
    room_code: room?.code ?? null,
    inspector_id: user.id,
    inspector_name: optText(form, "inspector_name") ?? user.full_name,
    status,
    note: optText(form, "note"),
  };

  let savedId = id;
  try {
    if (id) {
      await updateRound(id, input, results);
    } else {
      savedId = (await createRound(input, results, user.id)).id;
    }

    await logAudit({
      actor_id: user.id,
      action: id ? "แก้ไขใบตรวจเช็คโรงแรม" : "บันทึกใบตรวจเช็คโรงแรม",
      target_table: "htl_rounds",
      target_id: savedId || null,
      after: {
        branch: branch?.name ?? null,
        room: room?.code ?? null,
        date: checkDate,
        status,
      },
    });
  } catch (err) {
    back(backPath, err instanceof Error ? err.message : "บันทึกใบตรวจเช็คไม่สำเร็จ", true);
  }

  revalidateAll(savedId);
  back(
    `${DOC_PATH}/${savedId}`,
    status === "submitted" ? "ส่งผลการตรวจเช็คเรียบร้อยแล้ว" : "เก็บฉบับร่างเรียบร้อยแล้ว",
  );
}

/** เปลี่ยนสถานะใบ (ส่งผล / กลับเป็นฉบับร่าง / ยกเลิกใบ) */
export async function setRoundStatusForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const status = str(form, "to") as HtlRoundStatus;

  const round = await getRound(id);
  if (!round) back(DOC_PATH, "ไม่พบใบตรวจเช็คนี้", true);

  const scope: HtlScope = round.room_id ? "room" : "building";
  const user = await requirePermission(MENU_OF[scope], "edit");

  if (!["draft", "submitted", "cancelled"].includes(status)) {
    back(`${DOC_PATH}/${id}`, "สถานะที่ส่งมาไม่ถูกต้อง", true);
  }

  // ส่งผลได้ต่อเมื่อตรวจครบทุกข้อที่บังคับแล้ว
  if (status === "submitted") {
    const [results, checklist] = await Promise.all([
      listResults(id),
      getChecklist(round.branch_id, false, scope),
    ]);
    const items = checklist.groups.flatMap((g) => g.items);

    for (const r of results) {
      const item = items.find((i) => i.id === r.item_id);
      const problem = validateResult(
        { result: r.result, note: r.note, photos: r.photos },
        item ?? { name: r.item_name, require_photo: false, require_photo_on_fail: false },
      );
      if (problem) back(`${DOC_PATH}/${id}`, problem, true);
    }
  }

  try {
    await setRoundStatus(id, status);
    await logAudit({
      actor_id: user.id,
      action: "เปลี่ยนสถานะใบตรวจเช็คโรงแรม",
      target_table: "htl_rounds",
      target_id: id,
      after: { status },
    });
  } catch (err) {
    back(`${DOC_PATH}/${id}`, err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ", true);
  }

  revalidateAll(id);
  back(`${DOC_PATH}/${id}`, "เปลี่ยนสถานะเรียบร้อยแล้ว");
}

/** ลบใบตรวจเช็คทั้งใบ พร้อมรูปทั้งหมด — ต้องติ๊กยืนยันก่อน */
export async function deleteRoundForm(form: FormData): Promise<void> {
  const id = str(form, "id");

  const round = await getRound(id);
  if (!round) back(DOC_PATH, "ไม่พบใบตรวจเช็คที่ต้องการลบ", true);

  const scope: HtlScope = round.room_id ? "room" : "building";
  const user = await requirePermission(MENU_OF[scope], "delete");

  if (str(form, "confirm") !== "on") {
    back(`${DOC_PATH}/${id}`, "กรุณาติ๊กยืนยันก่อนลบใบตรวจเช็ค", true);
  }

  try {
    const { filesDeleted } = await deleteRound(id);
    await logAudit({
      actor_id: user.id,
      action: "ลบใบตรวจเช็คโรงแรม",
      target_table: "htl_rounds",
      target_id: id,
      before: {
        doc_no: round.doc_no,
        branch: round.branch_name,
        room: round.room_code,
        date: round.check_date,
        photos_deleted: filesDeleted,
      },
    });
  } catch (err) {
    back(`${DOC_PATH}/${id}`, err instanceof Error ? err.message : "ลบใบตรวจเช็คไม่สำเร็จ", true);
  }

  revalidateAll();
  back(LIST_PATH[scope], `ลบใบตรวจเช็ค ${round.doc_no} แล้ว`);
}

/** บันทึกความคืบหน้าของข้อที่ต้องแก้ไข (หน้าจอ 2) */
export async function saveIssueForm(form: FormData): Promise<void> {
  const user = await requirePermission("HTL_ISSUE", "edit");
  const resultId = str(form, "result_id");
  const rawPriority = str(form, "priority");

  const priority = (HTL_PRIORITY_ORDER as string[]).includes(rawPriority)
    ? (rawPriority as HtlPriority)
    : "soon";

  try {
    const roundId = await updateIssue(resultId, {
      priority,
      is_fixed: str(form, "is_fixed") === "on",
      fixed_note: optText(form, "fixed_note"),
      repair_doc_no: optText(form, "repair_doc_no"),
    });

    await logAudit({
      actor_id: user.id,
      action: "บันทึกความคืบหน้าข้อที่ต้องแก้ไข (ตรวจเช็คโรงแรม)",
      target_table: "htl_results",
      target_id: resultId,
      after: {
        priority,
        is_fixed: str(form, "is_fixed") === "on",
        repair_doc_no: optText(form, "repair_doc_no"),
      },
    });

    revalidateAll(roundId);
  } catch (err) {
    back("/hotel/issues", err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  back("/hotel/issues", "บันทึกความคืบหน้าเรียบร้อยแล้ว");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { assertMemoFilePaths, assertMemoPeriod, assertValidDate } from "@/lib/marketing";
import {
  changeMemoStatus,
  createMemo,
  deleteMemo,
  getMemoRow,
  updateMemo,
  type MemoFileInput,
  type MemoInput,
} from "@/lib/memo-db";
import {
  MAX_MEMO_FILES,
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
  type MktActiveStatus,
  type MktMemoStatus,
} from "@/lib/marketing-types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readStatus(value: string, fallback: MktMemoStatus = "not_requested"): MktMemoStatus {
  return MEMO_STATUS_ORDER.includes(value as MktMemoStatus) ? (value as MktMemoStatus) : fallback;
}

/** ช่องไฟล์ส่งมาเป็น JSON บรรทัดละไฟล์ + ค่าว่างปิดท้ายเสมอ */
function readFiles(form: FormData): MemoFileInput[] {
  const raw = form
    .getAll("files")
    .map(String)
    .filter((v) => v.trim() !== "");

  const parsed: MemoFileInput[] = [];
  for (const item of raw) {
    try {
      const f = JSON.parse(item) as {
        path?: string;
        filename?: string;
        mime?: string | null;
        size?: number | null;
      };
      if (!f.path) continue;
      parsed.push({
        path: f.path,
        filename: f.filename || "ไฟล์แนบ",
        mime: f.mime ?? null,
        size_bytes: f.size ?? null,
      });
    } catch {
      throw new Error("ข้อมูลไฟล์แนบไม่ถูกต้อง กรุณาแนบไฟล์ใหม่อีกครั้ง");
    }
  }

  assertMemoFilePaths(
    parsed.map((f) => f.path),
    MAX_MEMO_FILES,
  );
  return parsed;
}

function readForm(form: FormData): { input: MemoInput; files: MemoFileInput[] } {
  const memo_date = assertValidDate(form.get("memo_date"), "วันที่ของ Memo");
  const period = assertMemoPeriod(optText(form, "period_from"), optText(form, "period_to"));

  return {
    input: {
      memo_date,
      company_id: optText(form, "company_id"),
      detail: optText(form, "detail"),
      period_from: period.from,
      period_to: period.to,
      created_by_staff_id: optText(form, "created_by_staff_id"),
      status: readStatus(str(form, "status")),
      active_status: (str(form, "active_status") || "active") as MktActiveStatus,
    },
    files: readFiles(form),
  };
}

export async function createMemoForm(form: FormData): Promise<void> {
  let id = "";
  let docNo = "";

  try {
    const { input, files } = readForm(form);
    const created = await createMemo(input, files);
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: null,
      action: "mkt_create_memo",
      target_table: "mkt_memos",
      target_id: id,
      after: { ...input, files: files.length },
    });
  } catch (err) {
    back("/marketing/memos/new", err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/memos");
  back(`/marketing/memos/${id}`, `บันทึก Memo เรียบร้อยแล้ว เลขที่ ${docNo}`);
}

export async function updateMemoForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  if (!id) back("/marketing/memos", "ไม่พบ Memo", true);

  try {
    const { input, files } = readForm(form);
    // สถานะเปลี่ยนได้จากฟอร์มเปลี่ยนสถานะเท่านั้น จะได้มีประวัติทุกครั้ง
    const { status: _ignored, ...rest } = input;
    void _ignored;

    await updateMemo(id, rest, files);
    await logAudit({
      actor_id: null,
      action: "mkt_update_memo",
      target_table: "mkt_memos",
      target_id: id,
      after: { ...rest, files: files.length },
    });
  } catch (err) {
    back(`/marketing/memos/${id}`, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/memos");
  revalidatePath(`/marketing/memos/${id}`);
  back(`/marketing/memos/${id}`, "บันทึกการแก้ไขเรียบร้อยแล้ว");
}

/** หน้าจอ 8: บันทึกเปลี่ยนสถานะ + เก็บประวัติ */
export async function changeMemoStatusForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  if (!id) back("/marketing/memos", "ไม่พบ Memo", true);

  const page = `/marketing/memos/${id}`;
  const memo = await getMemoRow(id);
  if (!memo) back("/marketing/memos", "ไม่พบ Memo", true);

  if (memo.active_status === "cancelled") {
    back(page, "Memo นี้ถูกยกเลิกแล้ว เปลี่ยนสถานะไม่ได้", true);
  }

  const status = readStatus(str(form, "status"), memo.status);
  const changedOn = str(form, "changed_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(changedOn)) back(page, "กรุณาเลือกวันที่เปลี่ยนสถานะ", true);

  try {
    await changeMemoStatus(id, {
      status,
      changed_on: changedOn,
      changed_by_staff_id: optText(form, "changed_by_staff_id"),
      note: optText(form, "note"),
    });
    await logAudit({
      actor_id: null,
      action: "mkt_change_memo_status",
      target_table: "mkt_memos",
      target_id: id,
      before: { status: memo.status },
      after: { status, changed_on: changedOn },
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/memos");
  revalidatePath(page);
  back(page, `เปลี่ยนสถานะเป็น “${MEMO_STATUS_LABEL[status]}” เรียบร้อยแล้ว`);
}

export async function deleteMemoForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const docNo = str(form, "doc_no");

  if (form.get("confirm") !== "on") back(`/marketing/memos/${id}`, "กรุณาติ๊กยืนยันก่อนลบ", true);

  try {
    await deleteMemo(id);
    await logAudit({
      actor_id: null,
      action: "mkt_delete_memo",
      target_table: "mkt_memos",
      target_id: id,
      before: { doc_no: docNo },
    });
  } catch (err) {
    back(`/marketing/memos/${id}`, err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/memos");
  back("/marketing/memos", `ลบ Memo ${docNo} พร้อมไฟล์แนบเรียบร้อยแล้ว`);
}

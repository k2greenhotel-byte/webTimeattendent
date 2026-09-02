"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { assertPhotoPaths, assertValidDate, parseAmount } from "@/lib/marketing";
import {
  createActivity,
  deleteActivity,
  updateActivity,
  type ActivityInput,
} from "@/lib/marketing-db";
import type { MktActiveStatus } from "@/lib/marketing-types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readForm(form: FormData): { input: ActivityInput; photos: string[] } {
  const activity_date = assertValidDate(form.get("activity_date"), "วันที่จัดกิจกรรม");
  const title = str(form, "title");
  if (!title) throw new Error("กรุณากรอกชื่อกิจกรรม");

  const request_amount = parseAmount(form.get("request_amount"), "จำนวนเงินที่ขอเบิก") ?? 0;
  const approved_amount = parseAmount(form.get("approved_amount"), "จำนวนเงินที่อนุมัติเบิก");

  const photos = assertPhotoPaths(form.getAll("photo_paths").map(String));

  return {
    input: {
      activity_date,
      title,
      activity_type_id: optText(form, "activity_type_id"),
      company_id: optText(form, "company_id"),
      created_by_staff_id: optText(form, "created_by_staff_id"),
      memo: optText(form, "memo"),
      request_amount,
      approved_amount,
      active_status: (str(form, "active_status") || "active") as MktActiveStatus,
    },
    photos,
  };
}

export async function createActivityForm(form: FormData): Promise<void> {
  let id = "";
  let docNo = "";

  try {
    const { input, photos } = readForm(form);
    const created = await createActivity(input, photos);
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: null,
      action: "mkt_create_activity",
      target_table: "mkt_activities",
      target_id: id,
      after: { ...input, photos: photos.length },
    });
  } catch (err) {
    back("/marketing/activities/new", err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/activities");
  back(`/marketing/activities/${id}`, `บันทึกกิจกรรมเรียบร้อยแล้ว เลขที่ ${docNo}`);
}

export async function updateActivityForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  if (!id) back("/marketing/activities", "ไม่พบใบกิจกรรม", true);

  try {
    const { input, photos } = readForm(form);
    await updateActivity(id, input, photos);
    await logAudit({
      actor_id: null,
      action: "mkt_update_activity",
      target_table: "mkt_activities",
      target_id: id,
      after: { ...input, photos: photos.length },
    });
  } catch (err) {
    back(
      `/marketing/activities/${id}`,
      err instanceof Error ? err.message : "บันทึกไม่สำเร็จ",
      true,
    );
  }

  revalidatePath("/marketing/activities");
  revalidatePath(`/marketing/activities/${id}`);
  back(`/marketing/activities/${id}`, "บันทึกการแก้ไขเรียบร้อยแล้ว");
}

export async function deleteActivityForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const docNo = str(form, "doc_no");

  if (form.get("confirm") !== "on") {
    back(`/marketing/activities/${id}`, "กรุณาติ๊กยืนยันก่อนลบ", true);
  }

  try {
    await deleteActivity(id);
    await logAudit({
      actor_id: null,
      action: "mkt_delete_activity",
      target_table: "mkt_activities",
      target_id: id,
      before: { doc_no: docNo },
    });
  } catch (err) {
    back(`/marketing/activities/${id}`, err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/activities");
  back("/marketing/activities", `ลบใบกิจกรรม ${docNo} พร้อมรูปแนบเรียบร้อยแล้ว`);
}

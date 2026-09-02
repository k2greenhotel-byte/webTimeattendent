"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { canReceive, parseAmount } from "@/lib/marketing";
import { getActivityRow, saveReceipt, type ReceiptInput } from "@/lib/marketing-db";
import type { MktActiveStatus } from "@/lib/marketing-types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

export async function saveReceiptForm(form: FormData): Promise<void> {
  const activityId = str(form, "activity_id");
  if (!activityId) back("/marketing/receive", "ไม่พบใบกิจกรรม", true);

  const page = `/marketing/receive/${activityId}`;
  const activity = await getActivityRow(activityId);
  if (!activity) back("/marketing/receive", "ไม่พบใบกิจกรรม", true);

  const gate = canReceive(activity);
  if (!gate.ok) back(page, gate.reason ?? "บันทึกไม่ได้", true);

  const receiveDate = str(form, "receive_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receiveDate)) back(page, "กรุณาเลือกวันที่รับเงิน", true);

  let amount: number;
  try {
    amount = parseAmount(form.get("received_amount"), "จำนวนเงินที่ได้รับ") ?? 0;
  } catch (err) {
    back(page, err instanceof Error ? err.message : "จำนวนเงินไม่ถูกต้อง", true);
  }

  const input: ReceiptInput = {
    received_by_staff_id: str(form, "received_by_staff_id") || null,
    receive_date: receiveDate,
    receipt_no: str(form, "receipt_no") || null,
    received_amount: amount,
    active_status: (str(form, "active_status") || "active") as MktActiveStatus,
  };

  try {
    await saveReceipt(activityId, input);
    await logAudit({
      actor_id: null,
      action: "mkt_save_receipt",
      target_table: "mkt_receipts",
      target_id: activityId,
      after: input,
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/receive");
  revalidatePath(`/marketing/activities/${activityId}`);
  back(page, "บันทึกการรับเงินเรียบร้อยแล้ว · สถานะเปลี่ยนเป็น รับเงินแล้ว");
}

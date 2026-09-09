"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { canReceive, expectedAmount, parseAmount } from "@/lib/marketing";
import {
  addReceipt,
  deleteReceipt,
  getActivityRow,
  setSettledShort,
  type ReceiptInput,
} from "@/lib/marketing-db";
import type { MktActiveStatus } from "@/lib/marketing-types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** บันทึกรับเงินเพิ่ม 1 งวด — ไม่ทับงวดเดิม */
export async function addReceiptForm(form: FormData): Promise<void> {
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
  let wht: number;
  try {
    amount = parseAmount(form.get("received_amount"), "จำนวนเงินก่อนหักภาษี") ?? 0;
    wht = parseAmount(form.get("wht_amount"), "ภาษีหัก ณ ที่จ่าย") ?? 0;
  } catch (err) {
    back(page, err instanceof Error ? err.message : "จำนวนเงินไม่ถูกต้อง", true);
  }

  if (amount <= 0) back(page, "จำนวนเงินก่อนหักภาษีต้องมากกว่า 0", true);
  if (wht > amount) back(page, "ภาษีหัก ณ ที่จ่ายมากกว่ายอดเงินก่อนหัก กรุณาตรวจตัวเลขอีกครั้ง", true);

  // เตือนเมื่อรับเกินยอดที่ควรได้ — ปกติไม่ควรเกิด มักเป็นการกรอกผิดงวด
  const expected = expectedAmount(activity);
  if (activity.received_amount + amount > expected + 0.005) {
    back(
      page,
      `ยอดรวมหลังบันทึกงวดนี้จะเกินยอดที่ควรได้รับ (${expected.toLocaleString("th-TH")} บาท) กรุณาตรวจจำนวนเงินอีกครั้ง`,
      true,
    );
  }

  const input: ReceiptInput = {
    received_by_staff_id: str(form, "received_by_staff_id") || null,
    receive_date: receiveDate,
    receipt_no: str(form, "receipt_no") || null,
    received_amount: amount,
    wht_amount: wht,
    active_status: (str(form, "active_status") || "active") as MktActiveStatus,
  };

  try {
    await addReceipt(activityId, input);
    await logAudit({
      actor_id: null,
      action: "mkt_add_receipt",
      target_table: "mkt_receipts",
      target_id: activityId,
      after: input,
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/receive");
  revalidatePath(`/marketing/activities/${activityId}`);
  back(page, "บันทึกการรับเงินเรียบร้อยแล้ว");
}

export async function deleteReceiptForm(form: FormData): Promise<void> {
  const activityId = str(form, "activity_id");
  const receiptId = str(form, "receipt_id");
  const page = `/marketing/receive/${activityId}`;

  if (!activityId || !receiptId) back("/marketing/receive", "ไม่พบงวดรับเงิน", true);

  try {
    await deleteReceipt(receiptId, activityId);
    await logAudit({
      actor_id: null,
      action: "mkt_delete_receipt",
      target_table: "mkt_receipts",
      target_id: receiptId,
      before: { activity_id: activityId },
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/receive");
  revalidatePath(`/marketing/activities/${activityId}`);
  back(page, "ลบงวดรับเงินเรียบร้อยแล้ว · ระบบคิดสถานะใหม่ให้แล้ว");
}

/**
 * ปิดยอดเพราะบริษัทรถตัดเงิน — ได้น้อยกว่าที่ตกลงและจะไม่จ่ายส่วนที่เหลืออีก
 * กดซ้ำเพื่อยกเลิกการปิดยอดได้ สถานะจะกลับไปเป็น "รับเงินบางส่วน" ตามยอดจริง
 */
export async function settleShortForm(form: FormData): Promise<void> {
  const activityId = str(form, "activity_id");
  const settle = str(form, "settle") === "1";
  const page = `/marketing/receive/${activityId}`;

  if (!activityId) back("/marketing/receive", "ไม่พบใบกิจกรรม", true);

  const activity = await getActivityRow(activityId);
  if (!activity) back("/marketing/receive", "ไม่พบใบกิจกรรม", true);

  if (settle && activity.received_amount <= 0) {
    back(page, "ยังไม่มีการรับเงินเลย ปิดยอดแบบถูกตัดเงินไม่ได้", true);
  }

  try {
    await setSettledShort(activityId, settle, str(form, "settled_note") || null);
    await logAudit({
      actor_id: null,
      action: settle ? "mkt_settle_short" : "mkt_unsettle_short",
      target_table: "mkt_activities",
      target_id: activityId,
      after: { settled_short: settle },
    });
  } catch (err) {
    back(page, err instanceof Error ? err.message : "ปิดยอดไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/receive");
  revalidatePath(`/marketing/activities/${activityId}`);
  back(
    page,
    settle
      ? "ปิดยอดเรียบร้อยแล้ว · สถานะเปลี่ยนเป็น ได้ครบแต่ถูกตัดเงิน"
      : "ยกเลิกการปิดยอดแล้ว · กลับไปคิดยอดค้างตามปกติ",
  );
}

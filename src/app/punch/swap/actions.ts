"use server";

import { redirect } from "next/navigation";
import {
  confirmSwapRequest,
  decideSwapRequest,
  getEmployeeById,
  hasPendingSwapOnDate,
  createSwapRequest as dbCreateSwapRequest,
  logAudit,
} from "@/lib/db";
import { workDateOf } from "@/lib/datetime";
import { requireUser } from "@/lib/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function backToPunch(message: string, isError = false): never {
  redirect(`/punch?${isError ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

function backToNew(message: string): never {
  redirect(`/punch/swap/new?err=${encodeURIComponent(message)}`);
}

/** พนักงานสร้างคำขอสลับกะกับเพื่อนร่วมงาน — ฝั่งตัวเองถือว่ายืนยันแล้ว รออีกฝ่ายยืนยัน */
export async function createSwapRequestForm(form: FormData): Promise<void> {
  const user = await requireUser();

  const requesterDate = str(form, "requester_date");
  const partnerId = str(form, "partner_id");
  const partnerDate = str(form, "partner_date");
  const note = str(form, "note") || null;

  if (!DATE_RE.test(requesterDate) || !DATE_RE.test(partnerDate)) {
    backToNew("กรุณาเลือกวันที่ให้ครบทั้งสองฝั่ง");
  }
  const today = workDateOf();
  if (requesterDate < today || partnerDate < today) {
    backToNew("เลือกได้เฉพาะวันนี้หรือวันข้างหน้า ย้อนหลังไม่ได้");
  }
  if (!partnerId || partnerId === user.id) {
    backToNew("กรุณาเลือกเพื่อนร่วมงานที่จะสลับด้วย");
  }

  const [me, partner] = await Promise.all([getEmployeeById(user.id), getEmployeeById(partnerId)]);
  if (!partner || !partner.is_active) backToNew("ไม่พบพนักงานคนนี้");
  if (!me?.branch_id || me.branch_id !== partner.branch_id) {
    backToNew("สลับกะได้เฉพาะเพื่อนร่วมงานสาขาเดียวกัน");
  }

  const [meBusy, partnerBusy] = await Promise.all([
    hasPendingSwapOnDate(user.id, requesterDate),
    hasPendingSwapOnDate(partnerId, partnerDate),
  ]);
  if (meBusy) backToNew(`วันที่ ${requesterDate} ของคุณมีคำขอสลับกะค้างอยู่แล้ว รอผลก่อนขอวันนี้ซ้ำ`);
  if (partnerBusy) backToNew(`วันที่ ${partnerDate} ของ ${partner.full_name} มีคำขอสลับกะค้างอยู่แล้ว`);

  let requestId = "";
  try {
    const req = await dbCreateSwapRequest({
      requesterId: user.id,
      requesterDate,
      partnerId,
      partnerDate,
      note,
    });
    requestId = req.id;
    await logAudit({
      actor_id: user.id,
      action: "create_shift_swap_request",
      target_table: "shift_swap_requests",
      target_id: req.id,
      after: { partnerId, requesterDate, partnerDate },
    });
  } catch (err) {
    backToNew(err instanceof Error ? err.message : "สร้างคำขอสลับกะไม่สำเร็จ");
  }

  backToPunch(`ส่งคำขอสลับกะให้ ${(await getEmployeeById(partnerId))?.full_name ?? "เพื่อนร่วมงาน"} แล้ว รอเขายืนยัน (คำขอ #${requestId.slice(0, 8)})`);
}

/** อีกฝ่ายกดยืนยัน — สลับตารางเวรจริงทันที */
export async function confirmSwapRequestForm(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(form, "id");
  try {
    await confirmSwapRequest(id, user.id);
    await logAudit({
      actor_id: user.id,
      action: "confirm_shift_swap_request",
      target_table: "shift_swap_requests",
      target_id: id,
    });
  } catch (err) {
    backToPunch(err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ", true);
  }
  backToPunch("ยืนยันสลับกะเรียบร้อยแล้ว ตารางเวรของทั้งสองฝ่ายอัปเดตแล้ว");
}

/** อีกฝ่ายปฏิเสธคำขอ */
export async function rejectSwapRequestForm(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(form, "id");
  try {
    await decideSwapRequest(id, user.id, "rejected");
    await logAudit({
      actor_id: user.id,
      action: "reject_shift_swap_request",
      target_table: "shift_swap_requests",
      target_id: id,
    });
  } catch (err) {
    backToPunch(err instanceof Error ? err.message : "ปฏิเสธไม่สำเร็จ", true);
  }
  backToPunch("ปฏิเสธคำขอสลับกะแล้ว");
}

/** ผู้ขอยกเลิกคำขอของตัวเองก่อนอีกฝ่ายยืนยัน */
export async function cancelSwapRequestForm(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(form, "id");
  try {
    await decideSwapRequest(id, user.id, "cancelled");
    await logAudit({
      actor_id: user.id,
      action: "cancel_shift_swap_request",
      target_table: "shift_swap_requests",
      target_id: id,
    });
  } catch (err) {
    backToPunch(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ", true);
  }
  backToPunch("ยกเลิกคำขอสลับกะแล้ว");
}

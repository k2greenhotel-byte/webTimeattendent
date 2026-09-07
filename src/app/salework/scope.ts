import "server-only";
import type { PermAction } from "@/lib/core-types";
import { canSeeAllWork } from "@/lib/salework";
import { requirePermission } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

/**
 * ด่านสิทธิ์ + ขอบเขตข้อมูลของทุกหน้าในโปรแกรม SALEWORK
 *
 * พนักงานขายทั่วไป (ระดับ user) เห็นเฉพาะใบงานของตัวเอง — บังคับด้วย ownerId ที่ส่งต่อไปยัง query
 * หัวหน้า / ผู้ช่วยแอดมิน / แอดมิน เห็นได้ทั้งหมด และเลือกกรองรายคนเองได้
 */
export async function workScope(
  menuCode: string,
  action: PermAction = "read",
): Promise<{ user: SessionUser; canSeeAll: boolean; ownerId: string | null }> {
  const user = await requirePermission(menuCode, action);
  const canSeeAll = canSeeAllWork(user.level);
  return { user, canSeeAll, ownerId: canSeeAll ? null : user.id };
}

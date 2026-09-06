import "server-only";
import { listBranches } from "@/lib/db";
import { canSeeAllLeads } from "@/lib/lead";
import { listChances, listLeadOwners, listWorkStatuses } from "@/lib/lead-db";
import type { ChanceOption, LeadOption, LeadQuery, WorkStatusOption } from "@/lib/lead-types";
import { listMaster } from "@/lib/moto-db";
import type { MotoOption } from "@/lib/moto-types";
import { requirePermission } from "@/lib/session";
import type { PermAction } from "@/lib/core-types";
import type { Branch, SessionUser } from "@/lib/types";

/**
 * ด่านสิทธิ์ + ขอบเขตข้อมูลของทุกหน้าในโปรแกรม LEAD (ข้อ 2)
 *
 * พนักงานขายทั่วไป (ระดับ user) เห็นเฉพาะ Lead ของตัวเอง — บังคับด้วย ownerId ที่ส่งต่อไปยัง query
 * หัวหน้า / ผู้จัดการ / ผู้ดูแลระบบ เห็นได้ทั้งหมด และเลือกกรองรายคนเองได้
 */
export async function leadScope(
  menuCode: string,
  action: PermAction = "read",
): Promise<{ user: SessionUser; canSeeAll: boolean; ownerId: string | null }> {
  const user = await requirePermission(menuCode, action);
  const canSeeAll = canSeeAllLeads(user.level);
  return { user, canSeeAll, ownerId: canSeeAll ? null : user.id };
}

/** บังคับเงื่อนไขเจ้าของลงใน query — พนักงานทั่วไปเปลี่ยน owner ใน URL แล้วก็ยังเห็นแต่ของตัวเอง */
export function scopedQuery(
  query: LeadQuery,
  scope: { canSeeAll: boolean; ownerId: string | null },
): LeadQuery {
  return scope.canSeeAll ? query : { ...query, owner_id: scope.ownerId };
}

/**
 * ตัวเลือกของช่องกรอง/ฟอร์ม — ดึงครั้งเดียวแล้วส่งต่อให้คอมโพเนนต์
 *
 * สถานะงาน/สถานะโอกาสดึงมาทั้งหมด (รวมที่ปิดใช้งานแล้ว) เพราะใบเก่าที่ใช้สถานะนั้นอยู่
 * ต้องยังแสดงชื่อและกรองหาได้ ส่วนฟอร์มบันทึกจะกรองเฉพาะที่เปิดใช้งานเอง
 */
export async function leadOptions(): Promise<{
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  channels: MotoOption[];
  owners: LeadOption[];
  statuses: WorkStatusOption[];
  chances: ChanceOption[];
}> {
  const [branches, brands, models, channels, owners, statuses, chances] = await Promise.all([
    listBranches(true),
    listMaster("brand"),
    listMaster("model"),
    listMaster("channel"),
    listLeadOwners(),
    listWorkStatuses(true),
    listChances(true),
  ]);
  return { branches, brands, models, channels, owners, statuses, chances };
}

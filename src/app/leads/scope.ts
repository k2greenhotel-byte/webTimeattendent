import "server-only";
import { listBranches } from "@/lib/db";
import { canSeeAllLeads } from "@/lib/lead";
import { listLeadOwners } from "@/lib/lead-db";
import type { LeadOption, LeadQuery } from "@/lib/lead-types";
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

/** ตัวเลือกของช่องกรอง/ฟอร์ม — ดึงครั้งเดียวแล้วส่งต่อให้คอมโพเนนต์ */
export async function leadOptions(): Promise<{
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  channels: MotoOption[];
  owners: LeadOption[];
}> {
  const [branches, brands, models, channels, owners] = await Promise.all([
    listBranches(true),
    listMaster("brand"),
    listMaster("model"),
    listMaster("channel"),
    listLeadOwners(),
  ]);
  return { branches, brands, models, channels, owners };
}

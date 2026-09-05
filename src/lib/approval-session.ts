import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { resolveAuthority } from "./approval";
import { listLimits } from "./approval-db";
import type { ApvLimit, ApvRequestRow, Authority } from "./approval-types";
import { isApproverAuthed, requirePermission } from "./session";
import type { SessionUser } from "./types";

/**
 * ประตูของหน้าจออนุมัติกลาง — เข้มกว่าหน้าปกติสองชั้น
 *   1. ต้องมีสิทธิ์เมนู APV_INBOX (เพิ่ม = ตัดสินเรื่องได้)
 *   2. ต้องยืนยันรหัสผ่านของตัวเองซ้ำภายใน 30 นาทีที่ผ่านมา
 *      (ใช้ cookie ตัวเดียวกับหน้าอนุมัติของโมดูลจัดซื้อ ผ่านที่ไหนใช้ได้ทั้งสองที่)
 */
export async function requireApvApprover(): Promise<SessionUser> {
  const user = await requirePermission("APV_INBOX", "write");
  if (!(await isApproverAuthed())) redirect("/approvals");
  return user;
}

/** กฎอำนาจอนุมัติทั้งหมด — cache ต่อหนึ่ง request เพราะหน้าเดียวถามหลายรอบ */
export const getLimits = cache(async (): Promise<ApvLimit[]> => listLimits(true));

/**
 * อำนาจของผู้ใช้ที่ล็อกอินอยู่ ต่อใบขอหนึ่งใบ
 * ใช้บริษัทของใบขอเป็นเกณฑ์ (กฎอาจผูกบริษัทไว้) ไม่ใช่บริษัทที่ผู้อนุมัติเลือกอยู่
 */
export function authorityFor(limits: ApvLimit[], user: SessionUser, row: ApvRequestRow): Authority {
  return resolveAuthority(limits, {
    userId: user.id,
    level: user.level,
    typeId: row.type_id,
    companyId: row.company_id,
  });
}

/** อำนาจต่อประเภทเรื่อง (ใช้ตอนยังไม่มีใบขอ เช่น กล่องทดสอบกฎ) */
export function authorityForType(
  limits: ApvLimit[],
  user: { id: string; level: SessionUser["level"] },
  typeId: string,
  companyId: string | null,
): Authority {
  return resolveAuthority(limits, { userId: user.id, level: user.level, typeId, companyId });
}

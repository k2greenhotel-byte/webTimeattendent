import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { resolveAuthority } from "./approval";
import { listLimits, listTypes } from "./approval-db";
import type { Authority } from "./approval-types";
import { isApproverAuthed, requirePermission } from "./session";
import type { SessionUser } from "./types";

/**
 * ประตูหน้าจออนุมัติของโปรแกรม HR — เข้มกว่าหน้าปกติสองชั้น
 *   1. ต้องมีสิทธิ์ "เพิ่ม" ของเมนูอนุมัตินั้น (= ตัดสินเรื่องได้)
 *   2. ต้องยืนยันรหัสผ่านของตัวเองซ้ำภายใน 30 นาทีที่ผ่านมา
 *
 * ใช้ cookie ตัวเดียวกับกล่องรออนุมัติกลางและหน้าอนุมัติของโมดูลจัดซื้อ
 * ผ่านที่ไหนแล้วจึงไม่ต้องกรอกรหัสซ้ำอีกในหน้าอื่น
 */
async function requireHrApprover(menuCode: string, backTo: string): Promise<SessionUser> {
  const user = await requirePermission(menuCode, "write");
  if (!(await isApproverAuthed())) redirect(backTo);
  return user;
}

export function requireLeaveApprover(): Promise<SessionUser> {
  return requireHrApprover("HR_LEAVE_APPROVE", "/hr/approvals/leave");
}

export function requireAdvanceApprover(): Promise<SessionUser> {
  return requireHrApprover("HR_ADV_APPROVE", "/hr/approvals/advance");
}

/**
 * อำนาจอนุมัติเงินของผู้ใช้ที่ล็อกอินอยู่ สำหรับเรื่อง "ขอเบิกเงินเดือนล่วงหน้า"
 * ใช้กฎชุดเดียวกับระบบอนุมัติกลาง (apv_limits) จะได้ไม่ต้องตั้งวงเงินสองที่
 * คืน null เมื่อยังไม่มีประเภทเรื่อง SALARY_ADV ในทะเบียน = ไม่คุมวงเงิน
 */
export const getAdvanceAuthorityContext = cache(async () => {
  const [types, limits] = await Promise.all([listTypes(false), listLimits(true)]);
  const type = types.find((t) => t.code === "SALARY_ADV") ?? null;
  return { typeId: type?.id ?? null, limits };
});

export async function advanceAuthorityFor(
  user: SessionUser,
  companyId: string | null,
): Promise<Authority | null> {
  const { typeId, limits } = await getAdvanceAuthorityContext();
  if (!typeId) return null;
  return resolveAuthority(limits, { userId: user.id, level: user.level, typeId, companyId });
}

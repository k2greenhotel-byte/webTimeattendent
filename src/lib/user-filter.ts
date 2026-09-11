/**
 * กรองรายชื่อผู้ใช้ในหน้าตั้งค่าสิทธิ์ (pure function ไม่แตะฐานข้อมูล)
 * ใช้ร่วมกันทั้งหน้า "สิทธิ์เมนูในโปรแกรม" และ "สิทธิ์จอ War Room"
 *
 * บริษัทของคน = บริษัทที่ติ๊กให้เข้าได้ + บริษัทของสาขาที่สังกัด/เข้าได้ (ติ๊ก "ทุกบริษัท" = ตรงทุกบริษัท)
 * สาขาของคน   = สาขาที่สังกัด + สาขาที่ติ๊กให้เข้าได้ (ติ๊ก "ทุกสาขา" = ตรงทุกสาขา)
 */
import type { CoreUser } from "./core-types";

export type UserFilter = {
  q?: string;
  companyId?: string;
  branchId?: string;
  positionId?: string;
};

type BranchLike = { id: string; company_id: string | null };

export function readUserFilter(params: Record<string, string | undefined>): UserFilter {
  return {
    q: (params.q ?? "").trim(),
    companyId: (params.company ?? "").trim(),
    branchId: (params.branch ?? "").trim(),
    positionId: (params.position ?? "").trim(),
  };
}

export function hasUserFilter(filter: UserFilter): boolean {
  return Boolean(filter.q || filter.companyId || filter.branchId || filter.positionId);
}

export function matchesText(user: CoreUser, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [user.full_name, user.username, user.emp_code, user.phone].some((v) =>
    (v ?? "").toLowerCase().includes(needle),
  );
}

export function userBranchIds(user: CoreUser): string[] {
  return [...new Set([user.branch_id, ...user.branch_ids].filter((id): id is string => Boolean(id)))];
}

export function userCompanyIds(user: CoreUser, branches: BranchLike[]): string[] {
  const byBranch = new Map(branches.map((b) => [b.id, b.company_id]));
  const fromBranches = userBranchIds(user).map((id) => byBranch.get(id) ?? null);
  return [...new Set([...user.company_ids, ...fromBranches].filter((id): id is string => Boolean(id)))];
}

export function matchesUserFilter(user: CoreUser, filter: UserFilter, branches: BranchLike[]): boolean {
  if (!matchesText(user, filter.q ?? "")) return false;
  if (filter.companyId && !user.all_companies && !userCompanyIds(user, branches).includes(filter.companyId)) {
    return false;
  }
  if (filter.branchId && !user.all_branches && !userBranchIds(user).includes(filter.branchId)) return false;
  if (filter.positionId && user.position_id !== filter.positionId) return false;
  return true;
}

export function filterUsers(users: CoreUser[], filter: UserFilter, branches: BranchLike[]): CoreUser[] {
  return users.filter((u) => matchesUserFilter(u, filter, branches));
}

/** query string ของตัวกรองสำหรับต่อท้ายลิงก์ ให้ตัวกรองคงอยู่หลังกดชื่อ/บันทึก */
export function userFilterQuery(filter: UserFilter): string {
  const query = new URLSearchParams();
  if (filter.q) query.set("q", filter.q);
  if (filter.companyId) query.set("company", filter.companyId);
  if (filter.branchId) query.set("branch", filter.branchId);
  if (filter.positionId) query.set("position", filter.positionId);
  return query.toString();
}

import "server-only";
import { getSelectableContext, listCompanies } from "./core-db";
import { getSessionUser, isAdminAuthed } from "./session";
import type { Company } from "./core-types";

/**
 * ขอบเขตบริษัทของหน้าจอระบบลงเวลา
 *
 * ระบบมีหลายบริษัท ทุกหน้าจึงต้องรู้ว่ากำลังดูข้อมูลของบริษัทไหน ลำดับการเลือกคือ
 *   1. บริษัทที่เลือกจากช่อง "บริษัท" บนหน้าจอ (query string) — ถ้ามีสิทธิ์เห็น
 *   2. บริษัทที่ผู้ใช้เลือกไว้ตอนล็อกอิน (/select-context)
 *   3. บริษัทแรกที่ผู้ใช้มีสิทธิ์
 *
 * ผู้ที่เข้าหลังบ้านด้วย PIN โดยไม่ได้ล็อกอิน จะเห็นทุกบริษัท เพราะเป็นประตูของผู้ดูแลระบบ
 */
export type CompanyScope = {
  /** บริษัทที่กำลังดูอยู่ (null = ยังไม่มีบริษัทในระบบ) */
  companyId: string | null;
  companyName: string | null;
  /** บริษัททั้งหมดที่ผู้ใช้คนนี้เลือกดูได้ — ใช้สร้างช่องเลือกบริษัท */
  companies: Company[];
};

export async function getCompanyScope(requested?: string | null): Promise<CompanyScope> {
  const user = await getSessionUser();

  const companies = user
    ? (await getSelectableContext(user.id)).companies
    : (await isAdminAuthed())
      ? await listCompanies(true)
      : [];

  // ผู้ดูแลที่ผ่าน PIN เห็นได้ทุกบริษัท แม้บัญชีตัวเองจะผูกไว้บริษัทเดียว
  const all = user && (await isAdminAuthed()) ? await listCompanies(true) : companies;
  const options = all.length > 0 ? all : companies;

  const wanted =
    (requested && options.find((c) => c.id === requested)?.id) ||
    (user?.company_id && options.find((c) => c.id === user.company_id)?.id) ||
    options[0]?.id ||
    null;

  return {
    companyId: wanted,
    companyName: options.find((c) => c.id === wanted)?.name ?? null,
    companies: options,
  };
}

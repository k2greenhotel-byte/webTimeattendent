import { describe, expect, it } from "vitest";
import type { CoreUser } from "../src/lib/core-types";
import { filterUsers, hasUserFilter, readUserFilter, userFilterQuery } from "../src/lib/user-filter";

const branches = [
  { id: "b-k2h", company_id: "c-k2" },
  { id: "b-g9k", company_id: "c-main" },
];

function user(over: Partial<CoreUser>): CoreUser {
  return {
    id: "u",
    username: null,
    emp_code: "E000",
    full_name: "ทดสอบ",
    phone: null,
    access_level: "user",
    is_active: true,
    all_companies: false,
    all_branches: false,
    branch_id: null,
    position_id: null,
    company_ids: [],
    branch_ids: [],
    program_ids: [],
    ...over,
  };
}

const hotel = user({ id: "hotel", full_name: "พนักงานโรงแรม", emp_code: "E010", branch_id: "b-k2h", position_id: "p-front" });
const moto = user({ id: "moto", full_name: "ช่างมอเตอร์ไซค์", emp_code: "E020", branch_id: "b-g9k", position_id: "p-mech" });
const roaming = user({ id: "roam", full_name: "ผู้จัดการทุกที่", emp_code: "M001", all_companies: true, all_branches: true });
const byTick = user({ id: "tick", full_name: "คนติ๊กบริษัท", emp_code: "E030", company_ids: ["c-k2"], branch_ids: ["b-k2h"] });
const all = [hotel, moto, roaming, byTick];

describe("กรองผู้ใช้ตามบริษัท / สาขา / ตำแหน่ง", () => {
  it("บริษัท: ดูจากสาขาที่สังกัด + บริษัทที่ติ๊ก · ทุกบริษัทตรงเสมอ", () => {
    expect(filterUsers(all, { companyId: "c-k2" }, branches).map((u) => u.id)).toEqual(["hotel", "roam", "tick"]);
    expect(filterUsers(all, { companyId: "c-main" }, branches).map((u) => u.id)).toEqual(["moto", "roam"]);
  });

  it("สาขา: สังกัดหรือติ๊กให้เข้าได้ · ทุกสาขาตรงเสมอ", () => {
    expect(filterUsers(all, { branchId: "b-k2h" }, branches).map((u) => u.id)).toEqual(["hotel", "roam", "tick"]);
  });

  it("ตำแหน่ง: ตรงตัว คนไม่มีตำแหน่งไม่ตรง", () => {
    expect(filterUsers(all, { positionId: "p-mech" }, branches).map((u) => u.id)).toEqual(["moto"]);
  });

  it("ค้นคำ + กรอง ใช้ร่วมกัน (และ)", () => {
    expect(filterUsers(all, { q: "e0", companyId: "c-k2" }, branches).map((u) => u.id)).toEqual(["hotel", "tick"]);
    expect(filterUsers(all, { q: "ช่าง", companyId: "c-k2" }, branches)).toEqual([]);
  });

  it("อ่านจาก query string และสร้างกลับ ให้ตัวกรองคงอยู่หลังกดลิงก์", () => {
    const filter = readUserFilter({ q: " ไกร ", company: "c-k2", branch: "", position: undefined });
    expect(filter).toEqual({ q: "ไกร", companyId: "c-k2", branchId: "", positionId: "" });
    expect(hasUserFilter(filter)).toBe(true);
    expect(hasUserFilter(readUserFilter({}))).toBe(false);
    expect(userFilterQuery(filter)).toBe("q=%E0%B9%84%E0%B8%81%E0%B8%A3&company=c-k2");
  });
});

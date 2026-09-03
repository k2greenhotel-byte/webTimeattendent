import { describe, expect, it } from "vitest";
import type { EffectiveMenuPermission, MenuRights } from "../src/lib/core-types";
import {
  accessibleProgramCodes,
  allowsBranch,
  allowsCompany,
  can,
  filterBranches,
  filterCompanies,
  FULL_RIGHTS,
  isCoreAdmin,
  menuForPath,
  NO_RIGHTS,
  resolveRights,
} from "../src/lib/permissions";

const rights = (r: Partial<MenuRights>): MenuRights => ({ ...NO_RIGHTS, ...r });

function perm(
  menu_code: string,
  program_code: string,
  menu_path: string | null,
  r: Partial<MenuRights>,
): EffectiveMenuPermission {
  return {
    program_code,
    program_name: program_code,
    menu_id: menu_code,
    menu_code,
    menu_name: menu_code,
    menu_kind: "entry",
    menu_path,
    is_override: false,
    ...rights(r),
  };
}

describe("รวมสิทธิ์เฉพาะราย + ค่าเริ่มต้นของระดับ", () => {
  it("ระดับ admin ได้ทุกสิทธิ์เสมอ แม้จะตั้ง override เป็นห้ามไว้", () => {
    expect(resolveRights("admin", NO_RIGHTS, NO_RIGHTS)).toEqual(FULL_RIGHTS);
  });

  it("มี override ให้ใช้ override ทับค่าเริ่มต้นของระดับ", () => {
    const result = resolveRights("user", rights({ can_read: true }), FULL_RIGHTS);
    expect(result).toEqual(rights({ can_read: true }));
  });

  it("ไม่มี override ให้ตกไปใช้ค่าเริ่มต้นของระดับ", () => {
    const level = rights({ can_read: true, can_write: true });
    expect(resolveRights("supervisor", null, level)).toEqual(level);
  });

  it("ไม่มีทั้งสองอย่าง = ไม่มีสิทธิ์", () => {
    expect(resolveRights("user", null, null)).toEqual(NO_RIGHTS);
  });

  it("คืนค่าเป็นสำเนาใหม่ ไม่ผูกกับ object ต้นทาง", () => {
    const level = rights({ can_read: true });
    const result = resolveRights("user", null, level);
    result.can_read = false;
    expect(level.can_read).toBe(true);
  });
});

describe("ตรวจสิทธิ์รายเมนู", () => {
  const perms = [
    perm("MKT_ACTIVITY", "MKT", "/marketing/activities", { can_read: true, can_write: true }),
    perm("MKT_DASH", "MKT", "/marketing/dashboard", { can_read: true }),
    perm("CORE_USER", "CORE", "/core/users", {}),
  ];

  it("บอกได้ว่าทำอะไรกับเมนูไหนได้บ้าง", () => {
    expect(can(perms, "MKT_ACTIVITY", "read")).toBe(true);
    expect(can(perms, "MKT_ACTIVITY", "write")).toBe(true);
    expect(can(perms, "MKT_ACTIVITY", "delete")).toBe(false);
    expect(can(perms, "MKT_DASH", "write")).toBe(false);
  });

  it("เมนูที่ไม่มีสิทธิ์อ่านเลย ถือว่าเข้าไม่ได้", () => {
    expect(can(perms, "CORE_USER")).toBe(false);
  });

  it("เมนูที่ไม่รู้จัก = ไม่มีสิทธิ์ (ไม่ใช่เปิดให้ผ่าน)", () => {
    expect(can(perms, "NOT_EXIST", "read")).toBe(false);
  });

  it("สรุปรหัสโปรแกรมที่เข้าถึงได้ ไม่ซ้ำและไม่รวมโปรแกรมที่อ่านไม่ได้", () => {
    expect(accessibleProgramCodes(perms)).toEqual(["MKT"]);
  });
});

describe("จับคู่ path กับเมนู", () => {
  const perms = [
    perm("MKT_MEMO", "MKT", "/marketing/memos", { can_read: true }),
    perm("MKT_MEMO_STATUS", "MKT", "/marketing/memos/status", {}),
    perm("MKT_NOPATH", "MKT", null, { can_read: true }),
  ];

  it("เลือกเมนูที่ path ยาวที่สุดที่ยังตรงกัน", () => {
    expect(menuForPath(perms, "/marketing/memos/status")?.menu_code).toBe("MKT_MEMO_STATUS");
    expect(menuForPath(perms, "/marketing/memos")?.menu_code).toBe("MKT_MEMO");
    expect(menuForPath(perms, "/marketing/memos/123")?.menu_code).toBe("MKT_MEMO");
  });

  it("path ที่ไม่มีเมนูรองรับ คืน null", () => {
    expect(menuForPath(perms, "/punch")).toBeNull();
  });

  it("ไม่จับคู่ path ที่แค่ขึ้นต้นเหมือนกันแต่คนละเส้นทาง", () => {
    expect(menuForPath(perms, "/marketing/memos-extra")).toBeNull();
  });
});

describe("ขอบเขตบริษัทและสาขา", () => {
  const limited = {
    all_companies: false,
    all_branches: false,
    company_ids: ["c1"],
    branch_ids: ["b1"],
  };
  const everything = { all_companies: true, all_branches: true, company_ids: [], branch_ids: [] };

  const companies = [
    { id: "c1", is_active: true },
    { id: "c2", is_active: true },
    { id: "c3", is_active: false },
  ];
  const branches = [
    { id: "b1", is_active: true, company_id: "c1" },
    { id: "b2", is_active: true, company_id: "c1" },
    { id: "b3", is_active: true, company_id: "c2" },
    { id: "b4", is_active: false, company_id: "c1" },
  ];

  it("ผู้ใช้ที่ระบุรายชื่อไว้ เข้าได้เฉพาะที่ระบุ", () => {
    expect(allowsCompany(limited, "c1")).toBe(true);
    expect(allowsCompany(limited, "c2")).toBe(false);
    expect(allowsBranch(limited, "b1")).toBe(true);
    expect(allowsBranch(limited, "b2")).toBe(false);
  });

  it('ติ๊ก "ทุกบริษัท/ทุกสาขา" แล้วเข้าได้หมดโดยไม่ต้องระบุรายตัว', () => {
    expect(allowsCompany(everything, "c9")).toBe(true);
    expect(allowsBranch(everything, "b9")).toBe(true);
  });

  it("รายการที่ปิดใช้งานไม่ถูกนำมาให้เลือก", () => {
    expect(filterCompanies(everything, companies).map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(filterBranches(everything, branches).map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("เลือกบริษัทแล้ว เหลือเฉพาะสาขาของบริษัทนั้น", () => {
    expect(filterBranches(everything, branches, "c1").map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(filterBranches(limited, branches, "c1").map((b) => b.id)).toEqual(["b1"]);
  });
});

describe("ระดับที่เข้าระบบส่วนกลางได้", () => {
  it("admin และผู้ช่วย admin เข้าได้ ระดับอื่นเข้าไม่ได้", () => {
    expect(isCoreAdmin("admin")).toBe(true);
    expect(isCoreAdmin("assistant_admin")).toBe(true);
    expect(isCoreAdmin("supervisor")).toBe(false);
    expect(isCoreAdmin("user")).toBe(false);
  });
});

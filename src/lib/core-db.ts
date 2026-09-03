import "server-only";
import { getSupabase } from "./supabase-server";
import type {
  AccessLevel,
  Company,
  CoreUser,
  EffectiveMenuPermission,
  MenuRights,
  Program,
  ProgramMenu,
} from "./core-types";
import type { Branch } from "./types";

const USER_COLUMNS =
  "id, username, emp_code, full_name, phone, access_level, is_active, all_companies, all_branches, branch_id";

function dup(error: { code?: string }, message: string, fallback: string): string {
  return error.code === "23505" ? message : fallback;
}

// ---------- บริษัท ----------

export async function listCompanies(activeOnly = false): Promise<Company[]> {
  let query = getSupabase().from("companies").select("*").order("code");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านรายชื่อบริษัทไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Company[];
}

export async function insertCompany(row: Omit<Company, "id">): Promise<void> {
  const { error } = await getSupabase().from("companies").insert(row);
  if (error) throw new Error(dup(error, "รหัสบริษัทนี้ถูกใช้แล้ว", `เพิ่มบริษัทไม่สำเร็จ: ${error.message}`));
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<void> {
  const { error } = await getSupabase().from("companies").update(patch).eq("id", id);
  if (error) throw new Error(dup(error, "รหัสบริษัทนี้ถูกใช้แล้ว", `บันทึกบริษัทไม่สำเร็จ: ${error.message}`));
}

/**
 * ลบบริษัท — ปกติไม่ยอมลบถ้ายังมีสาขาสังกัดอยู่
 * ถ้ายืนยัน (force) จะลบให้ และสาขาในบริษัทนั้นจะกลายเป็น "ไม่ระบุบริษัท"
 */
export async function deleteCompany(id: string, force = false): Promise<{ affected: number }> {
  const supabase = getSupabase();
  const { count, error: countError } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id);
  if (countError) throw new Error(`ตรวจสอบสาขาของบริษัทไม่สำเร็จ: ${countError.message}`);

  const branches = count ?? 0;
  if (branches > 0 && !force) {
    throw new Error(
      `ลบไม่ได้ ยังมีสาขา ${branches} สาขาอยู่ในบริษัทนี้ — ย้ายสาขาออกก่อน หรือติ๊ก "ยืนยันลบทั้งที่ยังมีการใช้งาน"`,
    );
  }

  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(`ลบบริษัทไม่สำเร็จ: ${error.message}`);
  return { affected: branches };
}

// ---------- ผู้ใช้งาน ----------

async function idsByUser(
  table: "user_companies" | "user_branches" | "user_programs",
  column: "company_id" | "branch_id" | "program_id",
): Promise<Map<string, string[]>> {
  const { data, error } = await getSupabase().from(table).select(`user_id, ${column}`);
  if (error) throw new Error(`อ่านสิทธิ์การเข้าถึงไม่สำเร็จ: ${error.message}`);

  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as Record<string, string>[]) {
    const list = map.get(row.user_id) ?? [];
    list.push(row[column]);
    map.set(row.user_id, list);
  }
  return map;
}

export async function listCoreUsers(): Promise<CoreUser[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select(USER_COLUMNS)
    .order("emp_code");
  if (error) throw new Error(`อ่านรายชื่อผู้ใช้งานไม่สำเร็จ: ${error.message}`);

  const [companies, branches, programs] = await Promise.all([
    idsByUser("user_companies", "company_id"),
    idsByUser("user_branches", "branch_id"),
    idsByUser("user_programs", "program_id"),
  ]);

  return (data ?? []).map((u) => ({
    ...(u as Omit<CoreUser, "company_ids" | "branch_ids" | "program_ids">),
    company_ids: companies.get(u.id) ?? [],
    branch_ids: branches.get(u.id) ?? [],
    program_ids: programs.get(u.id) ?? [],
  }));
}

export async function getCoreUser(id: string): Promise<CoreUser | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("employees")
    .select(USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลผู้ใช้งานไม่สำเร็จ: ${error.message}`);
  if (!data) return null;

  const [companies, branches, programs] = await Promise.all([
    supabase.from("user_companies").select("company_id").eq("user_id", id),
    supabase.from("user_branches").select("branch_id").eq("user_id", id),
    supabase.from("user_programs").select("program_id").eq("user_id", id),
  ]);

  return {
    ...(data as Omit<CoreUser, "company_ids" | "branch_ids" | "program_ids">),
    company_ids: (companies.data ?? []).map((r: { company_id: string }) => r.company_id),
    branch_ids: (branches.data ?? []).map((r: { branch_id: string }) => r.branch_id),
    program_ids: (programs.data ?? []).map((r: { program_id: string }) => r.program_id),
  };
}

type UserPatch = Partial<
  Pick<CoreUser, "username" | "full_name" | "phone" | "access_level" | "is_active" | "all_companies" | "all_branches" | "branch_id">
> & { pin_hash?: string; role?: "employee" | "admin" };

export async function updateCoreUser(id: string, patch: UserPatch): Promise<void> {
  const { error } = await getSupabase().from("employees").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "User ID หรือเบอร์มือถือนี้ถูกใช้แล้ว"
        : `บันทึกผู้ใช้งานไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** แทนที่รายการทั้งชุด (ลบของเดิมทิ้งแล้วใส่ใหม่) — ใช้กับตารางความสัมพันธ์ทุกตัว */
async function replaceLinks(
  table: "user_companies" | "user_branches" | "user_programs",
  column: "company_id" | "branch_id" | "program_id",
  userId: string,
  ids: string[],
): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase.from(table).delete().eq("user_id", userId);
  if (delError) throw new Error(`บันทึกสิทธิ์ไม่สำเร็จ: ${delError.message}`);

  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;

  const { error } = await supabase
    .from(table)
    .insert(unique.map((id) => ({ user_id: userId, [column]: id })));
  if (error) throw new Error(`บันทึกสิทธิ์ไม่สำเร็จ: ${error.message}`);
}

export function setUserCompanies(userId: string, ids: string[]): Promise<void> {
  return replaceLinks("user_companies", "company_id", userId, ids);
}

export function setUserBranches(userId: string, ids: string[]): Promise<void> {
  return replaceLinks("user_branches", "branch_id", userId, ids);
}

export function setUserPrograms(userId: string, ids: string[]): Promise<void> {
  return replaceLinks("user_programs", "program_id", userId, ids);
}

// ---------- โปรแกรม / เมนู ----------

export async function listPrograms(activeOnly = false): Promise<Program[]> {
  let query = getSupabase().from("programs").select("*").order("sort_order").order("code");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านทะเบียนโปรแกรมไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Program[];
}

export async function insertProgram(row: Omit<Program, "id">): Promise<void> {
  const { error } = await getSupabase().from("programs").insert(row);
  if (error) throw new Error(dup(error, "รหัสโปรแกรมนี้ถูกใช้แล้ว", `เพิ่มโปรแกรมไม่สำเร็จ: ${error.message}`));
}

export async function updateProgram(id: string, patch: Partial<Program>): Promise<void> {
  const { error } = await getSupabase().from("programs").update(patch).eq("id", id);
  if (error) throw new Error(dup(error, "รหัสโปรแกรมนี้ถูกใช้แล้ว", `บันทึกโปรแกรมไม่สำเร็จ: ${error.message}`));
}

/** ลบโปรแกรม (เมนูและสิทธิ์ที่ผูกอยู่ถูกลบตามด้วย on delete cascade) */
export async function deleteProgram(id: string, force = false): Promise<{ affected: number }> {
  const supabase = getSupabase();
  const { count, error: countError } = await supabase
    .from("program_menus")
    .select("id", { count: "exact", head: true })
    .eq("program_id", id);
  if (countError) throw new Error(`ตรวจสอบเมนูของโปรแกรมไม่สำเร็จ: ${countError.message}`);

  const menus = count ?? 0;
  if (menus > 0 && !force) {
    throw new Error(
      `ลบไม่ได้ โปรแกรมนี้มี ${menus} เมนู — ลบเมนูก่อน หรือติ๊ก "ยืนยันลบทั้งเมนูและสิทธิ์ที่ผูกอยู่"`,
    );
  }

  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) throw new Error(`ลบโปรแกรมไม่สำเร็จ: ${error.message}`);
  return { affected: menus };
}

export async function listMenus(): Promise<ProgramMenu[]> {
  const { data, error } = await getSupabase()
    .from("program_menus")
    .select("*")
    .order("sort_order")
    .order("code");
  if (error) throw new Error(`อ่านรายการเมนูไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as ProgramMenu[];
}

export async function insertMenu(row: Omit<ProgramMenu, "id">): Promise<void> {
  const { error } = await getSupabase().from("program_menus").insert(row);
  if (error) throw new Error(dup(error, "รหัสเมนูนี้ถูกใช้แล้ว", `เพิ่มเมนูไม่สำเร็จ: ${error.message}`));
}

export async function updateMenu(id: string, patch: Partial<ProgramMenu>): Promise<void> {
  const { error } = await getSupabase().from("program_menus").update(patch).eq("id", id);
  if (error) throw new Error(dup(error, "รหัสเมนูนี้ถูกใช้แล้ว", `บันทึกเมนูไม่สำเร็จ: ${error.message}`));
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await getSupabase().from("program_menus").delete().eq("id", id);
  if (error) throw new Error(`ลบเมนูไม่สำเร็จ: ${error.message}`);
}

// ---------- สิทธิ์ ----------

/** สิทธิ์ที่มีผลจริงของผู้ใช้หนึ่งคน (รวม override + ค่าเริ่มต้นของระดับแล้ว) */
export async function getEffectivePermissions(userId: string): Promise<EffectiveMenuPermission[]> {
  const { data, error } = await getSupabase()
    .from("v_user_permissions")
    .select("*")
    .eq("user_id", userId);
  if (error) throw new Error(`อ่านสิทธิ์ผู้ใช้งานไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as EffectiveMenuPermission[];
}

/** ค่า override รายเมนูของผู้ใช้ (เฉพาะเมนูที่ตั้งค่าเฉพาะรายไว้) */
export async function getUserOverrides(userId: string): Promise<Map<string, MenuRights>> {
  const { data, error } = await getSupabase()
    .from("user_menu_permissions")
    .select("menu_id, can_read, can_write, can_edit, can_delete")
    .eq("user_id", userId);
  if (error) throw new Error(`อ่านสิทธิ์เฉพาะรายไม่สำเร็จ: ${error.message}`);

  return new Map(
    (data ?? []).map((r: MenuRights & { menu_id: string }) => [
      r.menu_id,
      { can_read: r.can_read, can_write: r.can_write, can_edit: r.can_edit, can_delete: r.can_delete },
    ]),
  );
}

/** บันทึก override ทั้งชุดของผู้ใช้ — เมนูที่ไม่ได้ส่งมาถือว่า "ใช้ค่าตามระดับ" */
export async function setUserOverrides(
  userId: string,
  rights: Map<string, MenuRights>,
): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase
    .from("user_menu_permissions")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(`บันทึกสิทธิ์ไม่สำเร็จ: ${delError.message}`);

  const rows = [...rights.entries()].map(([menu_id, r]) => ({ user_id: userId, menu_id, ...r }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("user_menu_permissions").insert(rows);
  if (error) throw new Error(`บันทึกสิทธิ์ไม่สำเร็จ: ${error.message}`);
}

export async function getLevelPermissions(level: AccessLevel): Promise<Map<string, MenuRights>> {
  const { data, error } = await getSupabase()
    .from("level_menu_permissions")
    .select("menu_id, can_read, can_write, can_edit, can_delete")
    .eq("level", level);
  if (error) throw new Error(`อ่านสิทธิ์ตามระดับไม่สำเร็จ: ${error.message}`);

  return new Map(
    (data ?? []).map((r: MenuRights & { menu_id: string }) => [
      r.menu_id,
      { can_read: r.can_read, can_write: r.can_write, can_edit: r.can_edit, can_delete: r.can_delete },
    ]),
  );
}

export async function setLevelPermissions(
  level: AccessLevel,
  rights: Map<string, MenuRights>,
): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase
    .from("level_menu_permissions")
    .delete()
    .eq("level", level);
  if (delError) throw new Error(`บันทึกสิทธิ์ตามระดับไม่สำเร็จ: ${delError.message}`);

  const rows = [...rights.entries()].map(([menu_id, r]) => ({ level, menu_id, ...r }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("level_menu_permissions").insert(rows);
  if (error) throw new Error(`บันทึกสิทธิ์ตามระดับไม่สำเร็จ: ${error.message}`);
}

// ---------- ขอบเขตบริษัท/สาขาที่ผู้ใช้เลือกได้ตอนล็อกอิน ----------

export type UserScope = {
  all_companies: boolean;
  all_branches: boolean;
  company_ids: string[];
  branch_ids: string[];
  access_level: AccessLevel;
};

export async function getUserScope(userId: string): Promise<UserScope> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("employees")
    .select("access_level, all_companies, all_branches")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`อ่านขอบเขตการทำงานไม่สำเร็จ: ${error.message}`);

  const [companies, branches] = await Promise.all([
    supabase.from("user_companies").select("company_id").eq("user_id", userId),
    supabase.from("user_branches").select("branch_id").eq("user_id", userId),
  ]);

  return {
    access_level: (data?.access_level ?? "user") as AccessLevel,
    all_companies: data?.all_companies ?? false,
    all_branches: data?.all_branches ?? false,
    company_ids: (companies.data ?? []).map((r: { company_id: string }) => r.company_id),
    branch_ids: (branches.data ?? []).map((r: { branch_id: string }) => r.branch_id),
  };
}

/** บริษัทและสาขาที่ผู้ใช้คนนี้เลือกเข้าทำงานได้จริง (เปิดใช้งานอยู่ + อยู่ในขอบเขต) */
export async function getSelectableContext(userId: string): Promise<{
  scope: UserScope;
  companies: Company[];
  branches: Branch[];
}> {
  const supabase = getSupabase();
  const [scope, companiesRes, branchesRes] = await Promise.all([
    getUserScope(userId),
    supabase.from("companies").select("*").eq("is_active", true).order("code"),
    supabase.from("branches").select("*").eq("is_active", true).order("code"),
  ]);

  if (companiesRes.error) throw new Error(`อ่านรายชื่อบริษัทไม่สำเร็จ: ${companiesRes.error.message}`);
  if (branchesRes.error) throw new Error(`อ่านรายชื่อสาขาไม่สำเร็จ: ${branchesRes.error.message}`);

  const companies = (companiesRes.data ?? []).filter(
    (c: Company) => scope.all_companies || scope.company_ids.includes(c.id),
  ) as Company[];
  const allowedCompanyIds = new Set(companies.map((c) => c.id));

  const branches = (branchesRes.data ?? []).filter(
    (b: Branch) =>
      (scope.all_branches || scope.branch_ids.includes(b.id)) &&
      (!b.company_id || allowedCompanyIds.has(b.company_id)),
  ) as Branch[];

  return { scope, companies, branches };
}

// ---------- สร้าง / รีเซ็ตบัญชีผู้ใช้ ----------

export type NewCoreUser = {
  emp_code: string;
  username: string | null;
  full_name: string;
  phone: string | null;
  pin_hash: string;
  access_level: AccessLevel;
  is_active: boolean;
  all_companies: boolean;
  all_branches: boolean;
  branch_id: string | null;
};

export async function insertCoreUser(row: NewCoreUser): Promise<string> {
  const { data, error } = await getSupabase()
    .from("employees")
    .insert({ ...row, role: row.access_level === "admin" ? "admin" : "employee" })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "รหัสพนักงาน User ID หรือเบอร์มือถือนี้ถูกใช้แล้ว"
        : `เพิ่มผู้ใช้งานไม่สำเร็จ: ${error.message}`,
    );
  }
  return data.id as string;
}

/** แอดมินตั้งรหัสผ่านใหม่ให้ผู้ใช้ (ใช้ตอนผู้ใช้ลืมรหัส) พร้อมปลดล็อกบัญชี */
export async function resetUserPin(userId: string, pinHash: string): Promise<void> {
  const { error } = await getSupabase()
    .from("employees")
    .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null })
    .eq("id", userId);
  if (error) throw new Error(`ตั้งรหัสผ่านใหม่ไม่สำเร็จ: ${error.message}`);
}

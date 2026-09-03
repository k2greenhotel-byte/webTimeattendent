import "server-only";
import { nextCustomerCode, type GeoRow } from "./customers";
import { signedPhotoUrl, removePhotos } from "./db";
import { getSupabase } from "./supabase-server";

export type Customer = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  address_detail: string | null;
  geo_code: number | null;
  postal_code: string | null;
  photo_path: string | null;
  national_id: string | null;
  birth_date: string | null;
  facebook_url: string | null;
  line_url: string | null;
  note: string | null;
  branch_id: string | null;
  company_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  /** มาจาก view v_customers (join ตารางตำบลและสาขาให้แล้ว) */
  subdistrict_name?: string | null;
  district_name?: string | null;
  province_name?: string | null;
  branch_name?: string | null;
};

export type CustomerInput = Omit<Customer, "id" | "created_at" | "subdistrict_name" | "district_name" | "province_name" | "branch_name">;

// ---------- ตำบล/อำเภอ/จังหวัด ----------

/** ค้นด้วยรหัสไปรษณีย์ 5 หลัก หรือชื่อตำบล/อำเภอ/จังหวัด — ใช้เติมที่อยู่ให้อัตโนมัติ */
export async function searchGeo(keyword: string, limit = 30): Promise<GeoRow[]> {
  const q = keyword.trim();
  if (q.length < 2) return [];

  const supabase = getSupabase();
  const columns = "subdistrict_code, subdistrict_name, district_name, province_name, postal_code";

  const query = /^\d{3,5}$/.test(q)
    ? supabase.from("thai_geo").select(columns).like("postal_code", `${q}%`)
    : supabase
        .from("thai_geo")
        .select(columns)
        .or(`subdistrict_name.ilike.%${q}%,district_name.ilike.%${q}%,province_name.ilike.%${q}%`);

  const { data, error } = await query
    .order("province_name")
    .order("district_name")
    .order("subdistrict_name")
    .limit(limit);

  if (error) throw new Error(`ค้นหาที่อยู่ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as GeoRow[];
}

export async function getGeo(code: number | null): Promise<GeoRow | null> {
  if (!code) return null;
  const { data, error } = await getSupabase()
    .from("thai_geo")
    .select("subdistrict_code, subdistrict_name, district_name, province_name, postal_code")
    .eq("subdistrict_code", code)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลที่อยู่ไม่สำเร็จ: ${error.message}`);
  return (data as GeoRow) ?? null;
}

// ---------- ลูกค้า ----------

export async function listCustomers(options: {
  keyword?: string;
  branchId?: string | null;
  limit?: number;
} = {}): Promise<Customer[]> {
  let query = getSupabase().from("v_customers").select("*").order("code");

  const q = (options.keyword ?? "").trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const clauses = [`full_name.ilike.%${q}%`, `code.ilike.%${q}%`];
    if (digits.length >= 3) {
      clauses.push(`phone.ilike.%${digits}%`, `national_id.ilike.%${digits}%`);
    }
    query = query.or(clauses.join(","));
  }
  if (options.branchId) query = query.eq("branch_id", options.branchId);

  const { data, error } = await query.limit(options.limit ?? 200);
  if (error) throw new Error(`อ่านรายชื่อลูกค้าไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as Customer[];
}

export async function countCustomers(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("customers")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`นับจำนวนลูกค้าไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await getSupabase()
    .from("v_customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านประวัติลูกค้าไม่สำเร็จ: ${error.message}`);
  return (data as Customer) ?? null;
}

/** รหัสลูกค้าถัดไป — ดูจากรหัสล่าสุดในระบบ */
export async function suggestCustomerCode(): Promise<string> {
  const { data, error } = await getSupabase()
    .from("customers")
    .select("code")
    .order("code", { ascending: false })
    .limit(1);
  if (error) throw new Error(`ออกรหัสลูกค้าไม่สำเร็จ: ${error.message}`);
  return nextCustomerCode(data?.[0]?.code ?? null);
}

function describe(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return error.message.includes("national_id")
      ? "เลขบัตรประชาชนนี้มีในระบบแล้ว (ลูกค้าซ้ำ)"
      : "รหัสลูกค้านี้ถูกใช้แล้ว";
  }
  return error.message;
}

export async function insertCustomer(row: CustomerInput): Promise<string> {
  const { data, error } = await getSupabase().from("customers").insert(row).select("id").single();
  if (error) throw new Error(`บันทึกลูกค้าไม่สำเร็จ: ${describe(error)}`);
  return data.id as string;
}

export async function updateCustomer(id: string, patch: Partial<CustomerInput>): Promise<void> {
  const { error } = await getSupabase().from("customers").update(patch).eq("id", id);
  if (error) throw new Error(`บันทึกลูกค้าไม่สำเร็จ: ${describe(error)}`);
}

/** ลบลูกค้า พร้อมลบรูปถ่ายออกจาก storage ด้วย (ไม่ให้ไฟล์ค้าง) */
export async function deleteCustomer(id: string): Promise<{ photoDeleted: boolean }> {
  const supabase = getSupabase();
  const { data } = await supabase.from("customers").select("photo_path").eq("id", id).maybeSingle();

  const photo = (data as { photo_path: string | null } | null)?.photo_path ?? null;
  if (photo) await removePhotos([photo]);

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(`ลบลูกค้าไม่สำเร็จ: ${error.message}`);
  return { photoDeleted: Boolean(photo) };
}

// ---------- รูปถ่าย ----------

export function newCustomerPhotoPath(): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `cust/${ym}/customer-${crypto.randomUUID()}.jpg`;
}

export function customerPhotoUrl(path: string | null): Promise<string | null> {
  return signedPhotoUrl(path, 600);
}

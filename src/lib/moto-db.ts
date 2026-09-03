import "server-only";
import { MOTO_MASTERS, specOf, type MotoMasterSpec } from "./moto";
import type { MotoMasterInput, MotoMasterKind, MotoOption } from "./moto-types";
import { getSupabase } from "./supabase-server";

/**
 * ทุก query ของระบบข้อมูลเบื้องต้นรถจักรยานยนต์อยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

function requireSpec(kind: MotoMasterKind): MotoMasterSpec {
  const spec = specOf(kind);
  if (!spec) throw new Error("ไม่รู้จักชนิดข้อมูลหลักนี้");
  return spec;
}

function columnsOf(spec: MotoMasterSpec): string {
  return spec.parent ? `id, code, name, is_active, ${spec.parent.column}` : "id, code, name, is_active";
}

/** รายการข้อมูลหลักหนึ่งชุด เรียงตามรหัส */
export async function listMaster(
  kind: MotoMasterKind,
  options: { includeInactive?: boolean } = {},
): Promise<MotoOption[]> {
  const spec = requireSpec(kind);
  let q = getSupabase().from(spec.table).select(columnsOf(spec));
  if (!options.includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("code");
  if (error) throw new Error(`อ่านข้อมูล${spec.title}ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as MotoOption[];
}

/** ตัวเลือกของข้อมูลหลักตัวแม่ (ยี่ห้อสำหรับรุ่น / รุ่นสำหรับแบบ) — ไม่มีตัวแม่คืนอาร์เรย์ว่าง */
export async function listParentOptions(spec: MotoMasterSpec): Promise<MotoOption[]> {
  if (!spec.parent) return [];
  return listMaster(spec.parent.kind, { includeInactive: true });
}

/** จำนวนรายการทั้งหมด/ที่เปิดใช้งาน ของข้อมูลหลักทุกชุด — ใช้บนหน้าแรกของโปรแกรม */
export async function countAllMasters(): Promise<
  Record<MotoMasterKind, { total: number; active: number }>
> {
  const supabase = getSupabase();
  const entries = await Promise.all(
    MOTO_MASTERS.map(async (spec) => {
      const { data, error } = await supabase.from(spec.table).select("is_active");
      if (error) throw new Error(`นับข้อมูล${spec.title}ไม่สำเร็จ: ${error.message}`);
      const rows = (data ?? []) as { is_active: boolean }[];
      return [
        spec.kind,
        { total: rows.length, active: rows.filter((r) => r.is_active).length },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<MotoMasterKind, { total: number; active: number }>;
}

function payload(spec: MotoMasterSpec, input: MotoMasterInput) {
  return {
    code: input.code,
    name: input.name,
    is_active: input.is_active,
    ...(spec.parent ? { [spec.parent.column]: input.parent_id } : {}),
  };
}

function duplicateMessage(spec: MotoMasterSpec, code: string): string {
  return `${spec.codeLabel} ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`;
}

export async function insertMaster(kind: MotoMasterKind, input: MotoMasterInput): Promise<void> {
  const spec = requireSpec(kind);
  const { error } = await getSupabase().from(spec.table).insert(payload(spec, input));
  if (error) {
    throw new Error(
      error.code === "23505"
        ? duplicateMessage(spec, input.code)
        : `เพิ่ม${spec.title}ไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateMaster(
  kind: MotoMasterKind,
  id: string,
  input: MotoMasterInput,
): Promise<void> {
  const spec = requireSpec(kind);
  const { error } = await getSupabase().from(spec.table).update(payload(spec, input)).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? duplicateMessage(spec, input.code)
        : `บันทึก${spec.title}ไม่สำเร็จ: ${error.message}`,
    );
  }
}

/**
 * นับจำนวนข้อมูลลูกที่อ้างถึงแถวนี้ — ใช้เตือนก่อนลบ
 * (ยี่ห้อถูกอ้างโดยรุ่น, รุ่นถูกอ้างโดยแบบ ส่วนชุดอื่นยังไม่มีใครอ้าง)
 */
export async function countMasterUsage(kind: MotoMasterKind, id: string): Promise<number> {
  const child = MOTO_MASTERS.find((m) => m.parent?.kind === kind);
  if (!child?.parent) return 0;

  const { count, error } = await getSupabase()
    .from(child.table)
    .select("id", { count: "exact", head: true })
    .eq(child.parent.column, id);

  if (error) throw new Error(`ตรวจสอบการใช้งานไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/** ลบข้อมูลหลัก — แถวลูกที่อ้างถึงจะเหลือค่าว่าง (on delete set null) ไม่ถูกลบตาม */
export async function deleteMaster(kind: MotoMasterKind, id: string): Promise<void> {
  const spec = requireSpec(kind);
  const { error } = await getSupabase().from(spec.table).delete().eq("id", id);
  if (error) throw new Error(`ลบ${spec.title}ไม่สำเร็จ: ${error.message}`);
}

/** อ่านหนึ่งแถว — ใช้เก็บค่าเดิมลง audit log ก่อนแก้ไข/ลบ */
export async function getMaster(kind: MotoMasterKind, id: string): Promise<MotoOption | null> {
  const spec = requireSpec(kind);
  const { data, error } = await getSupabase()
    .from(spec.table)
    .select(columnsOf(spec))
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`อ่านข้อมูล${spec.title}ไม่สำเร็จ: ${error.message}`);
  return (data as unknown as MotoOption) ?? null;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db2Officers } from "@/lib/db2-api";
import { logAudit } from "@/lib/db";
import { normalizeSalcod, validateMapping } from "@/lib/salework";
import { deleteMapping, listMappings, saveMapping } from "@/lib/salework-db";
import { requirePermission } from "@/lib/session";

const PATH = "/salework/mapping";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/**
 * จับคู่บัญชีผู้ใช้ในเว็บกับรหัสพนักงานขายในระบบขาย (Db2)
 * รับได้ทั้งจาก dropdown (ที่ดึงรายชื่อสดจากระบบขาย) และช่องพิมพ์เอง — พิมพ์เองมาก่อน
 */
export async function saveMappingForm(form: FormData): Promise<void> {
  const user = await requirePermission("SW_MAP", "write");

  const employeeId = str(form, "employee_id");
  const salcod = normalizeSalcod(str(form, "salcod_text") || str(form, "salcod_select"));
  const employeeName = str(form, "employee_name");

  const existing = await listMappings();
  const problem = validateMapping(employeeId, salcod, existing);
  if (problem) back(problem, true);

  // เก็บชื่อในทะเบียนพนักงานของระบบขายไว้ด้วย เพื่อให้หน้าจอยังอ่านออกตอนเครื่องในบริษัทปิด
  // ถามระบบขายก่อน (ถามเฉพาะรหัสเดียว ไม่ต้องนับยอดขาย จึงเร็ว) ต่อไม่ติดค่อยใช้ชื่อที่หน้าจอส่งมา
  let db2Name = str(form, "db2_name") || null;
  try {
    const res = await db2Officers({ codes: [salcod], status: "all", units: false, limit: 1 });
    const found = res.officers.find((o) => o.code === salcod);
    if (found?.name) db2Name = found.name;
  } catch {
    // แอป Db2 ยังไม่มี endpoint นี้ หรือต่อไม่ติดตอนนี้ — จับคู่ต่อได้ ใช้ชื่อเท่าที่หน้าจอส่งมา
  }

  try {
    await saveMapping({
      employee_id: employeeId,
      db2_salcod: salcod,
      db2_name: db2Name,
      note: str(form, "note") || null,
      mapped_by: user.id,
    });
    await logAudit({
      actor_id: user.id,
      action: "จับคู่พนักงานขายกับระบบขาย (Db2)",
      target_table: "sw_salesman_map",
      target_id: employeeId,
      after: { employee: employeeName, salcod },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกการจับคู่ไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  revalidatePath("/salework/dashboard");
  back(`จับคู่ ${employeeName || "บัญชีนี้"} กับรหัส ${salcod} เรียบร้อยแล้ว`);
}

/** ยกเลิกการจับคู่ของบัญชีหนึ่ง */
export async function deleteMappingForm(form: FormData): Promise<void> {
  const user = await requirePermission("SW_MAP", "delete");
  const employeeId = str(form, "employee_id");
  const employeeName = str(form, "employee_name");

  try {
    await deleteMapping(employeeId);
    await logAudit({
      actor_id: user.id,
      action: "ยกเลิกการจับคู่พนักงานขายกับระบบขาย (Db2)",
      target_table: "sw_salesman_map",
      target_id: employeeId,
      before: { employee: employeeName },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ยกเลิกการจับคู่ไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  revalidatePath("/salework/dashboard");
  back(`ยกเลิกการจับคู่ของ ${employeeName || "บัญชีนี้"} แล้ว`);
}

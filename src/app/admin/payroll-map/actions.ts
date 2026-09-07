"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMenuAccess } from "@/lib/att-access";
import { listEmployees, logAudit, setPayrollCodes } from "@/lib/db";
import { matchByName, parsePastedCodes } from "@/lib/thai-name";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** พารามิเตอร์มุมมองที่ต้องส่งกลับหน้าเดิมหลังบันทึก */
function viewParams(form: FormData): string {
  const q = new URLSearchParams();
  for (const k of ["company", "branch", "only"]) {
    const v = str(form, `view_${k}`);
    if (v) q.set(k, v);
  }
  return q.toString();
}

function back(form: FormData, message: string, isError = false): never {
  const view = viewParams(form);
  redirect(
    `/admin/payroll-map?${view ? `${view}&` : ""}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`,
  );
}

/** บันทึกรหัสเงินเดือนทุกช่องที่แก้บนหน้าจอ (ช่องว่าง = ล้างรหัสออก) */
export async function savePayrollCodesForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_PAYROLL_MAP", "edit");
  const companyId = str(form, "view_company") || null;

  // ทุกแถวส่ง code_<id> มาพร้อม original_<id> จะได้บันทึกเฉพาะช่องที่เปลี่ยนจริง
  const changed: { employee_id: string; payroll_code: string | null }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("code_")) continue;
    const employeeId = key.slice("code_".length);
    const next = String(value).trim();
    const before = str(form, `original_${employeeId}`);
    if (next !== before) changed.push({ employee_id: employeeId, payroll_code: next || null });
  }

  if (changed.length === 0) back(form, "ไม่มีช่องไหนถูกแก้ไข");

  let result = { saved: 0, cleared: 0 };
  try {
    result = await setPayrollCodes(changed, companyId);
    await logAudit({
      actor_id: access.user?.id ?? null,
      action: "set_payroll_codes",
      target_table: "employees",
      after: { companyId, changed: changed.length, ...result },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/payroll-map");
  back(
    form,
    `บันทึกรหัสเงินเดือน ${result.saved} คน${result.cleared > 0 ? ` · ล้างออก ${result.cleared} คน` : ""}`,
  );
}

/**
 * วางข้อมูลจาก Excel (รหัส + ชื่อ [+ ชื่อเล่น]) แล้วให้ระบบจับคู่ชื่อให้เอง
 * จับคู่เฉพาะที่ "ตรงคนเดียว" เท่านั้น ที่เหลือรายงานกลับให้คีย์เอง
 */
export async function importPastedForm(form: FormData): Promise<void> {
  const access = await requireMenuAccess("ATT_PAYROLL_MAP", "write");
  const companyId = str(form, "view_company") || null;
  const text = String(form.get("pasted") ?? "");
  const overwrite = form.get("overwrite") === "on";

  const rows = parsePastedCodes(text);
  if (rows.length === 0) back(form, "ไม่พบข้อมูลที่วางมา (ต้องมีอย่างน้อย 2 คอลัมน์: รหัส และชื่อ)", true);

  const employees = await listEmployees({ activeOnly: true, companyId });
  const updates: { employee_id: string; payroll_code: string | null }[] = [];
  const unmatched: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const hit = matchByName(row.name, row.nickname, employees);
    if (!hit) {
      unmatched.push(`${row.code} ${row.name}`);
      continue;
    }
    if (hit.employee.payroll_code && !overwrite) {
      skipped.push(`${row.code} ${row.name}`);
      continue;
    }
    updates.push({ employee_id: hit.employee.id, payroll_code: row.code });
  }

  if (updates.length === 0) {
    back(form, `จับคู่ไม่ได้เลย จาก ${rows.length} แถว — ตรวจว่าเลือกบริษัทถูกหรือยัง`, true);
  }

  try {
    await setPayrollCodes(updates, companyId);
    await logAudit({
      actor_id: access.user?.id ?? null,
      action: "import_payroll_codes",
      target_table: "employees",
      after: { companyId, rows: rows.length, matched: updates.length, unmatched: unmatched.length },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/admin/payroll-map");
  const parts = [`จับคู่สำเร็จ ${updates.length} จาก ${rows.length} แถว`];
  if (skipped.length > 0) parts.push(`ข้ามที่มีรหัสอยู่แล้ว ${skipped.length}`);
  if (unmatched.length > 0) {
    parts.push(`จับคู่ไม่ได้ ${unmatched.length}: ${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? " …" : ""}`);
  }
  back(form, parts.join(" · "));
}

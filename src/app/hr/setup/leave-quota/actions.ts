"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { listLeaveTypes, upsertEntitlement } from "@/lib/leave-db";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(path: string, message: string, isError = false): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** บันทึกสิทธิ์การลารายบุคคลของพนักงานคนหนึ่ง ทุกประเภทพร้อมกัน — เว้นว่างช่องไหน = ลบค่าตั้งเฉพาะคน กลับไปใช้โควตาเริ่มต้นของประเภทนั้น */
export async function saveEntitlementsForm(form: FormData): Promise<void> {
  const actor = await requirePermission("HR_LEAVE_QUOTA", "edit");
  const employeeId = str(form, "employee_id");
  const year = Number(str(form, "year"));
  const backTo = str(form, "back") || "/hr/setup/leave-quota";

  if (!employeeId || !Number.isFinite(year)) back(backTo, "ข้อมูลไม่ครบถ้วน", true);

  const types = await listLeaveTypes();
  const changes: { typeId: string; typeName: string; granted: number | null }[] = [];

  for (const type of types) {
    const raw = str(form, `granted_${type.id}`);
    if (raw === "") {
      changes.push({ typeId: type.id, typeName: type.name, granted: null });
      continue;
    }
    const granted = Number(raw);
    if (!Number.isFinite(granted) || granted < 0) {
      back(backTo, `ค่าที่กรอกของ "${type.name}" ไม่ถูกต้อง`, true);
    }
    changes.push({ typeId: type.id, typeName: type.name, granted });
  }

  try {
    await Promise.all(changes.map((c) => upsertEntitlement(employeeId, c.typeId, year, c.granted)));
    await logAudit({
      actor_id: actor.id,
      action: "hr_leave_entitlement_save",
      target_table: "hr_leave_entitlements",
      target_id: employeeId,
      after: { year, entitlements: changes },
    });
  } catch (err) {
    back(backTo, err instanceof Error ? err.message : "บันทึกสิทธิ์การลาไม่สำเร็จ", true);
  }

  revalidatePath("/hr/setup/leave-quota");
  revalidatePath("/hr/approvals/leave");
  revalidatePath("/hr/manage/leave");
  back(backTo, "บันทึกสิทธิ์การลาเรียบร้อยแล้ว");
}

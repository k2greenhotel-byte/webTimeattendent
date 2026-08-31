"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAttendanceRange, logAudit } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(query: string, message: string, isError = false): never {
  const key = isError ? "err" : "msg";
  redirect(`/admin/data?${query}${query ? "&" : ""}${key}=${encodeURIComponent(message)}`);
}

/** ลบข้อมูลการลงเวลาตามช่วงวันที่/สาขา/พนักงาน (ลบรูปใน storage ด้วย) */
export async function deleteAttendanceForm(form: FormData): Promise<void> {
  await requireAdmin();

  const from = str(form, "from");
  const to = str(form, "to");
  const employeeId = str(form, "employeeId");
  const branchId = str(form, "branch");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (employeeId) params.set("employeeId", employeeId);
  if (branchId) params.set("branch", branchId);
  const query = params.toString();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    back(query, "กรุณาเลือกช่วงวันที่ให้ครบ", true);
  }
  if (from > to) back(query, "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด", true);
  if (form.get("confirm") !== "on") {
    back(query, "กรุณาติ๊กยืนยันก่อนลบ (การลบย้อนกลับไม่ได้)", true);
  }

  const filter = {
    from,
    to,
    employeeId: employeeId || undefined,
    branchId: branchId || undefined,
  };

  let result = { deleted: 0, photosDeleted: 0 };
  try {
    result = await deleteAttendanceRange(filter);
    await logAudit({
      actor_id: null,
      action: "delete_attendance_range",
      target_table: "attendance_records",
      before: filter,
      after: result,
    });
  } catch (err) {
    // redirect() โยน error เช่นกัน จึงเรียก back() นอก try เท่านั้น
    back(query, err instanceof Error ? err.message : "ลบข้อมูลไม่สำเร็จ", true);
  }

  revalidatePath("/admin/data");
  back(
    query,
    result.deleted === 0
      ? "ไม่พบข้อมูลที่ตรงเงื่อนไข ไม่มีอะไรถูกลบ"
      : `ลบข้อมูลการลงเวลา ${result.deleted} รายการ และรูป ${result.photosDeleted} ไฟล์เรียบร้อยแล้ว`,
  );
}

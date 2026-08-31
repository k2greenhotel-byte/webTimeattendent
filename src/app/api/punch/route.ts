import { NextResponse } from "next/server";
import { canPunch, effectiveSettings } from "@/lib/attendance";
import {
  getBranchById,
  getEmployeeById,
  getPunchesOfDay,
  getWorkSettings,
  insertPunch,
  uploadPhoto,
} from "@/lib/db";
import { workDateOf } from "@/lib/datetime";
import { distanceMeters } from "@/lib/geo";
import { getSessionUser } from "@/lib/session";
import { PUNCH_ORDER, type PunchType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail("กรุณาเข้าสู่ระบบใหม่", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }

  const type = String(form.get("punch_type") ?? "") as PunchType;
  if (!PUNCH_ORDER.includes(type)) return fail("ประเภทการลงเวลาไม่ถูกต้อง");

  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("ไม่พบรูปถ่าย กรุณาถ่ายรูปใหม่อีกครั้ง");
  if (photo.type !== "image/jpeg") return fail("รูปต้องเป็นไฟล์ JPEG จากกล้องเท่านั้น");
  if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) return fail("ขนาดรูปไม่ถูกต้อง (ต้องไม่เกิน 3MB)");

  // เวลาจาก server เท่านั้น
  const now = new Date();
  const workDate = workDateOf(now);

  const [globalSettings, todayPunches, employee] = await Promise.all([
    getWorkSettings(),
    getPunchesOfDay(user.id, workDate),
    getEmployeeById(user.id),
  ]);

  // ใช้ค่าของสาขาที่พนักงานสังกัด (ถ้ามี) แทนค่ากลาง
  const branch = await getBranchById(employee?.branch_id ?? null);
  const settings = effectiveSettings(globalSettings, branch);

  const done = todayPunches.map((p) => p.punch_type);
  const check = canPunch(type, done);
  if (!check.ok) return fail(check.reason ?? "ไม่สามารถลงเวลาได้");

  // ---- พิกัด ----
  const lat = form.get("lat") ? Number(form.get("lat")) : null;
  const lng = form.get("lng") ? Number(form.get("lng")) : null;
  const accuracy = form.get("accuracy") ? Number(form.get("accuracy")) : null;

  let distance: number | null = null;
  if (settings.site_lat !== null && settings.site_lng !== null && lat !== null && lng !== null) {
    distance = distanceMeters(lat, lng, settings.site_lat, settings.site_lng);
  }

  if (settings.require_gps) {
    if (lat === null || lng === null) {
      return fail("ระบบกำหนดให้ต้องเปิด GPS ก่อนลงเวลา กรุณาอนุญาตการเข้าถึงตำแหน่ง");
    }
    if (distance !== null && distance > settings.radius_m) {
      return fail(
        `คุณอยู่ห่างจากที่ทำงาน ${distance} เมตร (อนุญาตไม่เกิน ${settings.radius_m} เมตร)`,
      );
    }
  }

  // ---- อัปโหลดรูป ----
  const month = workDate.slice(0, 7);
  const unique = globalThis.crypto.randomUUID();
  const path = `${user.emp_code}/${month}/${workDate}_${type}_${unique}.jpg`;

  try {
    await uploadPhoto(path, await photo.arrayBuffer());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ", 500);
  }

  try {
    const record = await insertPunch({
      employee_id: user.id,
      work_date: workDate,
      punch_type: type,
      punched_at: now.toISOString(),
      photo_path: path,
      lat,
      lng,
      accuracy_m: accuracy,
      distance_m: distance,
      device_info: req.headers.get("user-agent"),
      branch_id: branch?.id ?? null,
    });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "บันทึกการลงเวลาไม่สำเร็จ", 500);
  }
}

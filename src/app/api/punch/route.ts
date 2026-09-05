import { NextResponse } from "next/server";
import { canErrand, canPunch } from "@/lib/attendance";
import {
  getBranchById,
  getEmployeeById,
  getFieldTask,
  getOrgSettings,
  getPunchesOfDay,
  getResolvedDay,
  getSiteById,
  insertErrandPunch,
  insertFieldPunch,
  insertPunch,
  listErrandRounds,
  resolveWorkDateForPunch,
  uploadPhoto,
} from "@/lib/db";
import { workDateOf } from "@/lib/datetime";
import { distanceMeters } from "@/lib/geo";
import { getSessionUser } from "@/lib/session";
import {
  PUNCH_ORDER,
  type ErrandPunchType,
  type FieldPunchType,
  type PunchType,
  type SessionUser,
} from "@/lib/types";

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

  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("ไม่พบรูปถ่าย กรุณาถ่ายรูปใหม่อีกครั้ง");
  if (photo.type !== "image/jpeg") return fail("รูปต้องเป็นไฟล์ JPEG จากกล้องเท่านั้น");
  if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) return fail("ขนาดรูปไม่ถูกต้อง (ต้องไม่เกิน 3MB)");

  // ---- พิกัด ----
  const lat = form.get("lat") ? Number(form.get("lat")) : null;
  const lng = form.get("lng") ? Number(form.get("lng")) : null;
  const accuracy = form.get("accuracy") ? Number(form.get("accuracy")) : null;
  const geo = { lat, lng, accuracy, device: req.headers.get("user-agent") };

  // เวลาจาก server เท่านั้น
  const now = new Date();

  // ภารกิจนอกสถานที่ (เริ่ม/จบ) แยกจากการลงเวลาปกติ 4 ครั้ง
  const taskId = String(form.get("task_id") ?? "").trim();
  if (taskId) return punchFieldTask(user, taskId, form, photo, now, geo);

  // ออกไปทำธุระระหว่างวัน (ออก/กลับ ได้หลายรอบ) แยกจากการลงเวลาปกติเช่นกัน
  const rawType = String(form.get("punch_type") ?? "");
  if (rawType === "errand_out" || rawType === "errand_in") {
    return punchErrand(user, rawType === "errand_out" ? "out" : "in", form, photo, now, geo);
  }

  const type = rawType as PunchType;
  if (!PUNCH_ORDER.includes(type)) return fail("ประเภทการลงเวลาไม่ถูกต้อง");

  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);

  // กะดึกที่กดออกงานตอนเช้า ต้องผูกกับวันที่เริ่มกะ ไม่ใช่วันปฏิทินปัจจุบัน
  const workDate = await resolveWorkDateForPunch(user.id, branch?.id ?? null, now);

  // กะและพิกัด: ตารางเวรของคนนี้วันนี้ (รวมสถานที่ที่ไปประจำ) → กะสาขา → กะเริ่มต้น
  const [todayPunches, { settings, assignment }] = await Promise.all([
    getPunchesOfDay(user.id, workDate),
    getResolvedDay(branch?.id ?? null, user.id, workDate),
  ]);

  const done = todayPunches.map((p) => p.punch_type);
  const check = canPunch(type, done);
  if (!check.ok) return fail(check.reason ?? "ไม่สามารถลงเวลาได้");

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
        `คุณอยู่ห่างจาก${settings.site_name ?? "ที่ทำงาน"} ${distance} เมตร (อนุญาตไม่เกิน ${settings.radius_m} เมตร)`,
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
      site_id: assignment?.site_id ?? null,
    });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "บันทึกการลงเวลาไม่สำเร็จ", 500);
  }
}

/**
 * ลงเวลาออกไปทำธุระระหว่างวัน (ออก → กลับ ได้หลายรอบ)
 * ใช้พิกัด/รัศมีชุดเดียวกับการลงเวลาปกติ เพราะทั้งตอนออกและตอนกลับพนักงานอยู่ที่ทำงาน
 * เวลาที่ใช้จะถูกรวมกับพักเที่ยงเทียบโควตาเดียวกันตอนคำนวณรายงาน
 */
async function punchErrand(
  user: SessionUser,
  type: ErrandPunchType,
  form: FormData,
  photo: File,
  now: Date,
  geo: { lat: number | null; lng: number | null; accuracy: number | null; device: string | null },
) {
  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);
  const workDate = await resolveWorkDateForPunch(user.id, branch?.id ?? null, now);

  const [punches, rounds, { settings }] = await Promise.all([
    getPunchesOfDay(user.id, workDate),
    listErrandRounds(user.id, workDate),
    getResolvedDay(branch?.id ?? null, user.id, workDate),
  ]);

  const open = rounds.find((r) => r.isOpen) ?? null;
  const check = canErrand(
    type,
    punches.map((p) => p.punch_type),
    Boolean(open),
  );
  if (!check.ok) return fail(check.reason ?? "ลงเวลาไม่ได้");

  // ---- พิกัด: เกณฑ์เดียวกับการลงเวลาปกติ ----
  let distance: number | null = null;
  if (settings.site_lat !== null && settings.site_lng !== null && geo.lat !== null && geo.lng !== null) {
    distance = distanceMeters(geo.lat, geo.lng, settings.site_lat, settings.site_lng);
  }
  if (settings.require_gps) {
    if (geo.lat === null || geo.lng === null) {
      return fail("ระบบกำหนดให้ต้องเปิด GPS ก่อนลงเวลา กรุณาอนุญาตการเข้าถึงตำแหน่ง");
    }
    if (distance !== null && distance > settings.radius_m) {
      return fail(
        `คุณอยู่ห่างจาก${settings.site_name ?? "ที่ทำงาน"} ${distance} เมตร (อนุญาตไม่เกิน ${settings.radius_m} เมตร)`,
      );
    }
  }

  const round = type === "out" ? Math.max(0, ...rounds.map((r) => r.round)) + 1 : open!.round;
  const reason = String(form.get("reason") ?? "").trim() || null;

  const month = workDate.slice(0, 7);
  const path = `${user.emp_code}/${month}/${workDate}_errand${round}_${type}_${globalThis.crypto.randomUUID()}.jpg`;
  try {
    await uploadPhoto(path, await photo.arrayBuffer());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ", 500);
  }

  try {
    const record = await insertErrandPunch({
      employee_id: user.id,
      work_date: workDate,
      round,
      punch_type: type,
      punched_at: now.toISOString(),
      reason: type === "out" ? reason : null,
      photo_path: path,
      lat: geo.lat,
      lng: geo.lng,
      accuracy_m: geo.accuracy,
      distance_m: distance,
      device_info: geo.device,
      branch_id: branch?.id ?? null,
    });
    return NextResponse.json({ ok: true, record, workDate });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "บันทึกการลงเวลาไม่สำเร็จ", 500);
  }
}

/**
 * ลงเวลาเริ่ม/จบภารกิจนอกสถานที่ (ออกบูธ ส่งรถ ฯลฯ)
 * - ต้องเป็นสมาชิกของภารกิจ และภารกิจไม่ถูกยกเลิก
 * - ลำดับ เริ่ม → จบ กดซ้ำไม่ได้
 * - GPS: ภารกิจที่ระบุสถานที่ซึ่งมีพิกัด ตรวจรัศมีเมื่อองค์กรบังคับ GPS; ปลายทางที่พิมพ์เอง บันทึกพิกัดอย่างเดียว
 */
async function punchFieldTask(
  user: SessionUser,
  taskId: string,
  form: FormData,
  photo: File,
  now: Date,
  geo: { lat: number | null; lng: number | null; accuracy: number | null; device: string | null },
) {
  const type = String(form.get("punch_type") ?? "") as FieldPunchType;
  if (type !== "start" && type !== "end") return fail("ประเภทการลงเวลาไม่ถูกต้อง");

  const task = await getFieldTask(taskId);
  if (!task) return fail("ไม่พบภารกิจนี้", 404);
  if (task.is_cancelled) return fail("ภารกิจนี้ถูกยกเลิกแล้ว");

  const me = task.members.find((m) => m.employee_id === user.id);
  if (!me) return fail("คุณไม่ได้อยู่ในรายชื่อของภารกิจนี้", 403);
  if (type === "start" && me.start) return fail("คุณกดเริ่มงานนี้ไปแล้ว");
  if (type === "end" && !me.start) return fail("กรุณากดเริ่มงานก่อน");
  if (type === "end" && me.end) return fail("คุณกดจบงานนี้ไปแล้ว");

  const [site, org] = await Promise.all([getSiteById(task.site_id), getOrgSettings(task.company_id)]);

  let distance: number | null = null;
  if (site?.lat != null && site?.lng != null && geo.lat !== null && geo.lng !== null) {
    distance = distanceMeters(geo.lat, geo.lng, site.lat, site.lng);
  }
  if (org.require_gps) {
    if (geo.lat === null || geo.lng === null) {
      return fail("ระบบกำหนดให้ต้องเปิด GPS ก่อนลงเวลา กรุณาอนุญาตการเข้าถึงตำแหน่ง");
    }
    const radius = site?.radius_m ?? org.radius_m;
    if (distance !== null && distance > radius) {
      return fail(`คุณอยู่ห่างจาก${site?.name ?? "สถานที่"} ${distance} เมตร (อนุญาตไม่เกิน ${radius} เมตร)`);
    }
  }

  const month = task.work_date.slice(0, 7);
  const path = `${user.emp_code}/${month}/${task.work_date}_task_${type}_${globalThis.crypto.randomUUID()}.jpg`;
  try {
    await uploadPhoto(path, await photo.arrayBuffer());
  } catch (err) {
    return fail(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ", 500);
  }

  try {
    const record = await insertFieldPunch({
      task_id: task.id,
      employee_id: user.id,
      punch_type: type,
      punched_at: now.toISOString(),
      photo_path: path,
      lat: geo.lat,
      lng: geo.lng,
      accuracy_m: geo.accuracy,
      distance_m: distance,
      device_info: geo.device,
    });
    return NextResponse.json({ ok: true, record, workDate: workDateOf(now) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "บันทึกการลงเวลาไม่สำเร็จ", 500);
  }
}

import { NextResponse } from "next/server";
import { hotelFileUrl, newHotelFilePath, uploadHotelFile } from "@/lib/hotel-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** รูปถูกย่อในเครื่องผู้ใช้มาแล้ว เผื่อไว้ให้ 8 MB สำหรับเครื่องที่ย่อไม่สำเร็จ */
const MAX_BYTES = 8 * 1024 * 1024;

/** อัปโหลดรูปประกอบของรายการตรวจเช็คทีละรูป แล้วคืนเส้นทางไฟล์ให้ฟอร์มเก็บไว้ */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const photo = form.get("photo");

  if (!(photo instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรูปที่จะอัปโหลด" }, { status: 400 });
  }
  if (!(photo.type || "").startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "แนบได้เฉพาะไฟล์รูปภาพ" }, { status: 415 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "รูปใหญ่เกิน 8 MB กรุณาถ่ายใหม่ด้วยความละเอียดต่ำลง" },
      { status: 413 },
    );
  }

  try {
    const path = newHotelFilePath(photo.name || "photo.jpg");
    await uploadHotelFile(path, await photo.arrayBuffer(), photo.type || "image/jpeg");
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** เปิดรูป — ส่งต่อไปยัง signed URL เฉพาะไฟล์ในโฟลเดอร์ hotel/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("hotel/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบรูปนี้" }, { status: 400 });
  }

  const url = await hotelFileUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบรูปนี้ในระบบ" }, { status: 404 });

  return NextResponse.redirect(url);
}

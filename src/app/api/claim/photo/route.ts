import { NextResponse } from "next/server";
import { claimFileUrl, newClaimFilePath, uploadClaimFile } from "@/lib/claim-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * อัปโหลดรูปของใบขอเคลม (1.4.14) / ใบ update งานเคลม (1.5.9) ทีละรูป
 * แล้วคืนเส้นทางไฟล์ให้ฟอร์มเก็บไว้ (รูปถูกย่อขนาดในเครื่องผู้ใช้มาแล้วโดย PhotoUploader)
 */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const photo = form.get("photo");
  const prefix = String(form.get("prefix") ?? "claim");

  if (!(photo instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรูปที่จะอัปโหลด" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "รูปใหญ่เกิน 15 MB กรุณาถ่ายใหม่ด้วยความละเอียดต่ำลง" },
      { status: 413 },
    );
  }

  try {
    const path = newClaimFilePath(prefix, photo.name || "photo.jpg");
    await uploadClaimFile(path, await photo.arrayBuffer(), photo.type || "image/jpeg");
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** เปิดรูป — ส่งต่อไปยัง signed URL เฉพาะไฟล์ในโฟลเดอร์ claim/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("claim/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบรูปนี้" }, { status: 400 });
  }

  const url = await claimFileUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบรูปนี้ในระบบ" }, { status: 404 });

  return NextResponse.redirect(url);
}

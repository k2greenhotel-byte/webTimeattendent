import { NextResponse } from "next/server";
import { customerPhotoUrl, newCustomerPhotoPath } from "@/lib/customer-db";
import { uploadPhoto } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/** อัปโหลดรูปถ่ายลูกค้า แล้วคืนเส้นทางไฟล์ให้ฟอร์มเก็บไว้ */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่พบไฟล์รูป" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "ไฟล์ใหญ่เกิน 5 MB กรุณาถ่ายใหม่หรือย่อรูปก่อน" },
      { status: 413 },
    );
  }

  try {
    const path = newCustomerPhotoPath();
    await uploadPhoto(path, await file.arrayBuffer());
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** ส่งต่อไปยัง signed URL ของรูป — เปิดได้เฉพาะไฟล์ในโฟลเดอร์ cust/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("cust/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบรูป" }, { status: 400 });
  }

  const url = await customerPhotoUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 404 });

  return NextResponse.redirect(url);
}

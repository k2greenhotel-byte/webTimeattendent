import { NextResponse } from "next/server";
import { signedPhotoUrl } from "@/lib/db";
import { getSessionUser, isAdminAuthed } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ส่งต่อไปยัง signed URL ของรูป — พนักงานดูได้เฉพาะรูปของตัวเอง แอดมินดูได้ทั้งหมด */
export async function GET(req: Request) {
  const [user, isAdmin] = await Promise.all([getSessionUser(), isAdminAuthed()]);
  if (!user && !isAdmin) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const path = new URL(req.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "ไม่พบรูป" }, { status: 400 });

  // แอดมินดูได้ทุกคน พนักงานดูได้เฉพาะรูปของตัวเอง
  if (!isAdmin && !path.startsWith(`${user!.emp_code}/`)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูรูปนี้" }, { status: 403 });
  }

  const url = await signedPhotoUrl(path, 600);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 404 });

  return NextResponse.redirect(url);
}

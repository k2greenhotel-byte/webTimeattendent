import { NextResponse } from "next/server";
import { hrFileUrl, newHrFilePath, uploadHrFile } from "@/lib/leave-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/** อัปโหลดเอกสารแนบของใบแจ้งลา (ใบรับรองแพทย์ / เอกสารประกอบ) ทีละไฟล์ */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่พบไฟล์ที่จะอัปโหลด" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "ไฟล์ใหญ่เกิน 15 MB กรุณาย่อรูปหรือแยกไฟล์ก่อน" },
      { status: 413 },
    );
  }

  try {
    const prefix = String(form.get("prefix") ?? "attach");
    const path = newHrFilePath(prefix, file.name);
    await uploadHrFile(path, await file.arrayBuffer(), file.type);

    return NextResponse.json({
      ok: true,
      path,
      filename: file.name,
      mime: file.type || null,
      size: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** เปิดไฟล์แนบ — ส่งต่อไปยัง signed URL เฉพาะไฟล์ในโฟลเดอร์ hr/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("hr/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  const url = await hrFileUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์นี้ในระบบ" }, { status: 404 });

  return NextResponse.redirect(url);
}

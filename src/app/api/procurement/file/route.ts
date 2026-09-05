import { NextResponse } from "next/server";
import {
  newProcurementFilePath,
  procurementFileUrl,
  uploadProcurementFile,
} from "@/lib/procurement-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/** อัปโหลดไฟล์เอกสารประกอบใบเบิกจ่าย (ใบเสร็จ ใบรับสินค้า) ทีละไฟล์ — ข้อ 4.6 */
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
    const path = newProcurementFilePath("payment", file.name);
    await uploadProcurementFile(path, await file.arrayBuffer(), file.type);

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

/** เปิดไฟล์แนบ — ส่งต่อไปยัง signed URL เฉพาะไฟล์ในโฟลเดอร์ pr/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("pr/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  const url = await procurementFileUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์นี้ในระบบ" }, { status: 404 });

  return NextResponse.redirect(url);
}

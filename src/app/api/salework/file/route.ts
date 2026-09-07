import { NextResponse } from "next/server";
import { mediaKindOf } from "@/lib/salework";
import { newMediaPath, uploadWorkMedia, workMediaUrl } from "@/lib/salework-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** รูปย่อฝั่งเบราว์เซอร์แล้วมักไม่ถึง 1 MB ส่วนคลิปสั้นจากมือถือให้เผื่อไว้ 25 MB */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/** อัปโหลดรูปหรือคลิปประกอบงานประจำวัน (ทีละไฟล์) แล้วคืนเส้นทางไฟล์ให้ฟอร์มเก็บไว้ */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่พบไฟล์ที่จะอัปโหลด" }, { status: 400 });
  }

  const mime = file.type || "";
  const kind = mediaKindOf(mime);
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return NextResponse.json(
      { ok: false, error: "แนบได้เฉพาะไฟล์รูปภาพหรือคลิปวิดีโอเท่านั้น" },
      { status: 415 },
    );
  }

  const limit = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return NextResponse.json(
      {
        ok: false,
        error:
          kind === "video"
            ? `คลิปใหญ่เกิน ${mb} MB กรุณาตัดคลิปให้สั้นลงหรือลดความละเอียดก่อนอัปโหลด`
            : `รูปใหญ่เกิน ${mb} MB กรุณาถ่ายใหม่หรือย่อรูปก่อน`,
      },
      { status: 413 },
    );
  }

  try {
    const path = newMediaPath(file.name);
    await uploadWorkMedia(path, await file.arrayBuffer(), mime);

    return NextResponse.json({
      ok: true,
      path,
      kind,
      filename: file.name || null,
      mime: mime || null,
      size: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** เปิดไฟล์แนบ — ส่งต่อไปยัง signed URL เฉพาะไฟล์ในโฟลเดอร์ sw/ เท่านั้น */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("sw/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  const url = await workMediaUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์นี้ในระบบ" }, { status: 404 });

  return NextResponse.redirect(url);
}

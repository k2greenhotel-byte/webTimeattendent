import { NextResponse } from "next/server";
import { marketingPhotoUrl, newPhotoPath, uploadMarketingPhoto } from "@/lib/marketing-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/** อัปโหลดรูปของโมดูลการตลาด (ทีละไฟล์) แล้วคืนเส้นทางไฟล์ให้ฟอร์มเก็บไว้ */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("photo");
  const prefix = String(form.get("prefix") ?? "activity").replace(/[^a-z]/g, "") || "activity";

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
    const path = newPhotoPath(prefix);
    await uploadMarketingPhoto(path, await file.arrayBuffer());
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** ส่งต่อไปยัง signed URL ของรูป — เปิดได้เฉพาะไฟล์ในโฟลเดอร์ mkt/ เท่านั้น */
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("mkt/") || path.includes("..")) {
    return NextResponse.json({ error: "ไม่พบรูป" }, { status: 400 });
  }

  const url = await marketingPhotoUrl(path);
  if (!url) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 404 });

  return NextResponse.redirect(url);
}

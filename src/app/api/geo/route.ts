import { NextResponse } from "next/server";
import { searchGeo } from "@/lib/customer-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ค้นตำบล/อำเภอ/จังหวัด สำหรับเติมที่อยู่ให้อัตโนมัติ
 * ใส่รหัสไปรษณีย์ (เช่น 71000) หรือชื่อตำบล/อำเภอ/จังหวัดก็ได้
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const keyword = new URL(req.url).searchParams.get("q") ?? "";

  try {
    return NextResponse.json({ ok: true, rows: await searchGeo(keyword) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ค้นหาที่อยู่ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

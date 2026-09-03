import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/customer-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ค้นลูกค้าสำหรับช่อง "ชื่อลูกค้า" บนใบจอง (ข้อ 1.1.5-1.1.6)
 * ค้นด้วยชื่อ รหัสลูกค้า เบอร์โทร หรือเลขบัตรประชาชน แล้วคืนเบอร์โทรมาให้เติมช่อง 1.1.6 อัตโนมัติ
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const keyword = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (keyword.length < 2) return NextResponse.json({ ok: true, rows: [] });

  try {
    const rows = await listCustomers({ keyword, limit: 20 });
    return NextResponse.json({
      ok: true,
      rows: rows.map((c) => ({
        id: c.id,
        code: c.code,
        full_name: c.full_name,
        phone: c.phone,
        province_name: c.province_name ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ค้นหาลูกค้าไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

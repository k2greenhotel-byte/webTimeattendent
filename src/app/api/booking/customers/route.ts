import { NextResponse } from "next/server";
import { getCustomer, listCustomers } from "@/lib/customer-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Brief = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  province_name: string | null;
};

function toBrief(c: {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  province_name?: string | null;
}): Brief {
  return {
    id: c.id,
    code: c.code,
    full_name: c.full_name,
    phone: c.phone,
    province_name: c.province_name ?? null,
  };
}

/**
 * ลูกค้าสำหรับช่อง "ชื่อลูกค้า" บนใบจอง (ข้อ 1.1.5-1.1.6)
 *   ?q=คำค้น  ค้นด้วยชื่อ รหัสลูกค้า เบอร์โทร หรือเลขบัตรประชาชน
 *   ?id=uuid  ดึงรายเดียว — ใช้ตอนกลับมาจากหน้าเพิ่มลูกค้า เพื่อแสดงชื่อคนที่เพิ่งเพิ่ม
 * ทั้งสองแบบคืนเบอร์โทรมาด้วย เพื่อเติมช่อง 1.1.6 ให้อัตโนมัติ
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const id = (params.get("id") ?? "").trim();
  const keyword = (params.get("q") ?? "").trim();

  try {
    if (id) {
      const customer = await getCustomer(id);
      return NextResponse.json({ ok: true, rows: customer ? [toBrief(customer)] : [] });
    }

    if (keyword.length < 2) return NextResponse.json({ ok: true, rows: [] });

    const rows = await listCustomers({ keyword, limit: 20 });
    return NextResponse.json({ ok: true, rows: rows.map(toBrief) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ค้นหาลูกค้าไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

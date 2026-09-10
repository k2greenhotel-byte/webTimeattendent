import { NextResponse, type NextRequest } from "next/server";
import { Db2Unreachable, db2Configured, db2Fetch } from "@/lib/db2-fetch";
import { checkPermission, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Proxy ให้หน้าฝั่ง client (war room / cross tab) เรียกแอป Db2 ได้โดยไม่เห็น API key
 *
 *   GET /api/db2/wall?period=mtd            → DB2_API_URL/api/wall?period=mtd
 *   GET /api/db2/stock/pivot?row=model&…    → DB2_API_URL/api/stock/pivot?…
 *
 * เปิดเฉพาะ path ที่กำหนด และตรวจสิทธิ์รายเมนูของผู้ใช้ที่ล็อกอินอยู่
 */
const ALLOWED: Record<string, string> = {
  wall: "DB2_WALL",
  receivables: "DB2_WALL", // ลูกหนี้ไฟแนนซ์/ขายเครดิต — ส่วนล่างของจอ war room
  "stock/pivot": "DB2_PIVOT",
  "stock/list": "BOOK_STOCK",
  masters: "BOOK_ENTRY",
  // ค้นรถของลูกค้าจากเลขตัวถัง (INVTRAN + SALEALL + CUSTMAST) — popup ของใบขอเคลม
  vehicles: "CLM_CLAIM",
  customers: "BOOK_ENTRY",
  jobs: "DB2_JOB_WALL", // งานซ่อม — จอ War Room เรียกเอง (หน้า dashboard ดึงฝั่ง server)
  dashboard: "DB2_DASH",
  stock: "DB2_STOCK",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  const menuCode = ALLOWED[path];
  if (!menuCode) {
    return NextResponse.json({ ok: false, error: "ไม่รู้จัก endpoint นี้" }, { status: 404 });
  }

  if (!(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
  }
  if (!(await checkPermission(menuCode))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูข้อมูลนี้" }, { status: 403 });
  }

  if (!db2Configured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า DB2_API_URL / DB2_API_KEY" }, { status: 500 });
  }

  // db2Fetch ลอง URL หลักแล้วถอยไป URL สำรองเอง และคัดหน้า HTML error ของตัวกลาง (52x) ออกให้แล้ว
  // จึงการันตีว่า body ที่ได้เป็น JSON — หน้า client จะไม่พังเป็น "The string did not match the expected pattern" บน Safari
  try {
    const { res, text } = await db2Fetch(`/api/${path}${req.nextUrl.search}`, 25_000);
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ต่อระบบขาย (Db2) ไม่ได้" },
      // 404 = แอป Db2 ยังไม่มี endpoint นี้ (ยังไม่ได้ build) · 502 = ต่อไม่ถึงจริง ๆ
      { status: err instanceof Db2Unreachable && err.status === 404 ? 404 : 502, headers: { "cache-control": "no-store" } },
    );
  }
}

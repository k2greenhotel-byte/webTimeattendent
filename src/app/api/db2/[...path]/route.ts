import { NextResponse, type NextRequest } from "next/server";
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

  const base = process.env.DB2_API_URL;
  const key = process.env.DB2_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า DB2_API_URL / DB2_API_KEY" }, { status: 500 });
  }

  const url = new URL(`/api/${path}`, base);
  url.search = req.nextUrl.search;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: { "x-api-key": key }, signal: ctrl.signal, cache: "no-store" });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "หมดเวลารอ" : (err as Error).message;
    return NextResponse.json(
      { ok: false, error: `ต่อระบบขาย (Db2) ไม่ได้ — เครื่องในบริษัทอาจปิดอยู่ (${reason})` },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

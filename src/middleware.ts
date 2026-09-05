import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE, verifyAdminToken, verifySessionToken } from "@/lib/session-token";

/** เส้นทางใต้ /admin ที่ผู้ใช้ทั่วไปเข้าได้ด้วยสิทธิ์รายเมนู (ไม่ต้องผ่าน PIN) */
const SHARED_ADMIN_PATHS = ["/admin/roster", "/admin/field", "/admin/reports/field"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---------- ระบบหลังบ้าน ----------
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // /admin คือประตูทางเข้า (แสดงจอกรอก PIN เอง)
    if (pathname === "/admin") return NextResponse.next();

    const adminToken = req.cookies.get(ADMIN_COOKIE)?.value;
    if (adminToken && (await verifyAdminToken(adminToken))) return NextResponse.next();

    // หน้าจัดตาราง (ตารางเวร/ตารางบูธ/งานนอกสถานที่/รายงานนอกสถานที่) เปิดให้ผู้ใช้ที่ล็อกอิน
    // และมีสิทธิ์รายเมนูจากระบบส่วนกลางด้วย — ตัวหน้าเป็นคนตรวจสิทธิ์ (requireMenuAccess)
    if (SHARED_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (token && (await verifySessionToken(token))) return NextResponse.next();
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ---------- ฝั่งพนักงาน ----------
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/punch/:path*",
    "/apps",
    "/approvals",
    "/approvals/:path*",
    "/customers",
    "/customers/:path*",
    "/api/customer/:path*",
    "/api/geo",
    "/apps/:path*",
    "/core",
    "/core/:path*",
    "/select-context",
    "/me/:path*",
    "/admin",
    "/admin/:path*",
    "/api/punch",
    "/moto",
    "/moto/:path*",
    "/marketing",
    "/marketing/:path*",
    "/api/marketing/:path*",
    "/booking",
    "/booking/:path*",
    "/api/booking/:path*",
    "/procurement",
    "/procurement/:path*",
    "/api/procurement/:path*",
    "/leads",
    "/leads/:path*",
    "/api/lead/:path*",
    "/hr",
    "/hr/:path*",
    "/api/hr/:path*",
  ],
};

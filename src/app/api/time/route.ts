import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** เวลาอ้างอิงจาก server สำหรับประทับบนรูป (ไม่เชื่อนาฬิกาเครื่องพนักงาน) */
export async function GET() {
  return NextResponse.json({ now: new Date().toISOString() });
}

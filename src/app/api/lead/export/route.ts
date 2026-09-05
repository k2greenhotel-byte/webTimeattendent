import { NextResponse } from "next/server";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { toCsv, toXlsx } from "@/lib/export";
import { canSeeAllLeads, isOverdue, queryFromParams } from "@/lib/lead";
import { listLeads } from "@/lib/lead-db";
import { leadsToTable } from "@/lib/lead-export";
import { checkPermission, getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลดผลการสอบถาม Lead เป็น Excel หรือ CSV
 * /api/lead/export?status=follow_up&from=...&to=...&format=xlsx
 *
 * ใช้เงื่อนไขชุดเดียวกับหน้าสอบถาม และบังคับขอบเขตสิทธิ์ซ้ำอีกครั้ง
 * (พนักงานทั่วไปโหลดได้เฉพาะ Lead ของตัวเอง แม้จะแก้ owner ใน URL)
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  if (!(await checkPermission("LEAD_SEARCH", "read"))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูล Lead" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const params = Object.fromEntries(sp.entries());
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";

  try {
    const today = workDateOf();
    const query = queryFromParams(params);
    const scoped = canSeeAllLeads(user.level) ? query : { ...query, owner_id: user.id };

    const all = await listLeads(scoped);
    const rows = scoped.overdue_only ? all.filter((r) => isOverdue(r, today)) : all;

    const range =
      scoped.from || scoped.to
        ? `ช่วง ${scoped.from ? formatThaiDate(scoped.from) : "เริ่มต้น"} - ${scoped.to ? formatThaiDate(scoped.to) : "ปัจจุบัน"}`
        : null;

    const table = leadsToTable(["รายงานข้อมูล Lead", range].filter(Boolean).join(" · "), rows);
    const filename = `lead-${scoped.from ?? "all"}_${scoped.to ?? "all"}`;

    if (format === "csv") {
      return new NextResponse(toCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return new NextResponse(new Blob([toXlsx(table)]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างรายงานไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

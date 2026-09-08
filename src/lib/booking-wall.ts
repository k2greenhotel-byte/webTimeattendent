import "server-only";
import {
  buildOverview,
  buildRankings,
  daysWaiting,
  deliveryPipeline,
  describeVehicle,
  isOutOfStock,
} from "./booking";
import { listBookings } from "./booking-db";
import { CONTRACT_STATUS_LABEL, type BookingRow } from "./booking-types";
import { monthBounds, workDateOf } from "./datetime";
import { BOOK_SLOW_DAYS, type BookingWall, type WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบจองรถ
 *
 * ตอบคำถามที่หัวหน้าฝ่ายขายต้องรู้ตอนนี้:
 *   1. รับจองไปกี่ใบวันนี้/เดือนนี้ และเงินมัดจำที่ถืออยู่เท่าไหร่
 *   2. ใบไหนรอส่งมอบนานผิดปกติ — โดยเฉพาะที่รถยังไม่มีในสต็อก
 *   3. ใบไหนเลยวันนัดรับรถแล้ว และใบไหนเอกสารยังไม่ครบ
 *
 * ตัวเลขทุกตัวคิดจากฟังก์ชันกลางใน booking.ts ชุดเดียวกับหน้า Dashboard
 */

const TOP_N = 8;

export type { BookingWall };
export { BOOK_SLOW_DAYS };

function rowOf(r: BookingRow, right: string, extra?: string): WallRow {
  const who = r.customer_name ?? r.db2_customer_name ?? "ไม่ระบุลูกค้า";
  return {
    key: r.id,
    title: `${r.doc_no} · ${who}`,
    detail: [describeVehicle(r), r.branch_name, extra].filter(Boolean).join(" · "),
    right,
  };
}

export async function buildBookingWall(input: {
  branchId?: string | null;
}): Promise<BookingWall> {
  const today = workDateOf();
  const month = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const rows = await listBookings(input.branchId ? { branch_id: input.branchId } : {});

  const overview = buildOverview(rows, today);
  const pipeline = deliveryPipeline(rows, today);
  const rankings = buildRankings(rows, today);

  const open = rows.filter((r) => r.doc_status === "active");
  const bookedToday = open.filter((r) => r.booking_date === today).length;
  const bookedThisMonth = open.filter(
    (r) => r.booking_date >= month.from && r.booking_date <= month.to,
  ).length;

  const depositThisMonth = open
    .filter((r) => r.booking_date >= month.from && r.booking_date <= month.to)
    .reduce((sum, r) => sum + (r.deposit_amount ?? 0), 0);

  // ---- รอส่งมอบนานที่สุด (เรียงมาแล้วจาก deliveryPipeline) ----
  const waitingLong = pipeline.rows.slice(0, TOP_N).map((r) => {
    const d = daysWaiting(r, today);
    return rowOf(
      r,
      `${d} วัน`,
      isOutOfStock(r) ? "รถยังไม่มีในสต็อก" : undefined,
    );
  });

  // ---- สัญญายังไม่ผ่าน — ใบที่ค้างอยู่ที่ขั้นตอนเอกสาร ----
  const docPendingRows = open.filter((r) => r.contract_status === "pending");
  const docPending = docPendingRows
    .slice(0, TOP_N)
    .map((r) => rowOf(r, `${daysWaiting(r, today)} วัน`, CONTRACT_STATUS_LABEL[r.contract_status]));

  return {
    generatedAt: new Date().toISOString(),
    today,
    counts: {
      openBookings: overview.open,
      bookedToday,
      bookedThisMonth,
      awaitingDelivery: pipeline.total,
      outOfStock: overview.needOrder,
      docPending: docPendingRows.length,
    },
    money: { total: Math.round(overview.depositOpen), thisMonth: Math.round(depositThisMonth) },
    waitingLong,
    docPending,
    byBranch: rankings.topBranches.map((b) => ({ label: b.label, value: b.count })),
    byStaff: rankings.topStaff.map((s) => ({ label: s.label, value: s.count })),
    byModel: rankings.topModelsOutOfStock.length
      ? rankings.topModelsOutOfStock.map((m) => ({
          label: m.label,
          value: m.count,
          sub: "รถยังไม่มีในสต็อก",
        }))
      : rankings.topModels.map((m) => ({ label: m.label, value: m.count })),
  };
}


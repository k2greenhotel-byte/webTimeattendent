import "server-only";
import {
  buildOverview,
  buildRankings,
  daysWaiting,
  deliveryPipeline,
  describeVehicle,
  isOutOfStock,
  staffNameOf,
} from "./booking";
import { listBookings } from "./booking-db";
import { CONTRACT_STATUS_LABEL, type BookingRow } from "./booking-types";
import { workDateOf } from "./datetime";
import { inPeriod, type WallPeriod } from "./wall-period";
import { BOOK_SLOW_DAYS, type BookingWall, type WallRank, type WallRow } from "./wall-types";

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

/** นับตามป้ายชื่อแล้วเรียงมากไปน้อย — ใช้จัดอันดับเฉพาะใบที่รับจองในช่วงที่เลือก */
function rankBy(rows: BookingRow[], labelOf: (r: BookingRow) => string | null): WallRank[] {
  const tally = new Map<string, number>();
  for (const r of rows) {
    const label = labelOf(r) ?? "ไม่ระบุ";
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

export async function buildBookingWall(input: {
  branchId?: string | null;
  period: WallPeriod;
}): Promise<BookingWall> {
  const today = workDateOf();
  const { period } = input;

  const rows = await listBookings(input.branchId ? { branch_id: input.branchId } : {});

  const overview = buildOverview(rows, today);
  const pipeline = deliveryPipeline(rows, today);
  const rankings = buildRankings(rows, today);

  const open = rows.filter((r) => r.doc_status === "active");
  const bookedToday = open.filter((r) => r.booking_date === today).length;

  // ใบที่รับจองในช่วงที่เลือก — ตัวเลขกลุ่มนี้ขยับตามตัวกรอง
  const inRange = open.filter((r) => inPeriod(r.booking_date, period));
  const depositInPeriod = inRange.reduce((sum, r) => sum + (r.deposit_amount ?? 0), 0);

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
    period,
    counts: {
      openBookings: overview.open,
      bookedToday,
      bookedInPeriod: inRange.length,
      awaitingDelivery: pipeline.total,
      outOfStock: overview.needOrder,
      docPending: docPendingRows.length,
    },
    money: { total: Math.round(overview.depositOpen), inPeriod: Math.round(depositInPeriod) },
    waitingLong,
    docPending,
    byBranch: rankBy(inRange, (r) => r.branch_name),
    byStaff: rankBy(inRange, staffNameOf),
    byModel: rankings.topModelsOutOfStock.length
      ? rankings.topModelsOutOfStock.map((m) => ({
          label: m.label,
          value: m.count,
          sub: "รถยังไม่มีในสต็อก",
        }))
      : rankings.topModels.map((m) => ({ label: m.label, value: m.count })),
  };
}


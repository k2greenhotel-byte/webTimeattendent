import "server-only";
import { workDateOf } from "./datetime";
import {
  countByFlowStatus,
  expectedAmount,
  groupTotals,
  outstandingAmount,
  summarizeMemos,
} from "./marketing";
import { listActivities } from "./marketing-db";
import { listMemos } from "./memo-db";
import { MEMO_STATUS_LABEL, type MktMemoStatus } from "./marketing-types";
import { type WallPeriod } from "./wall-period";
import { MKT_SLOW_DAYS, type MarketingWall } from "./wall-types";

/** จำนวนใบที่แสดงในแต่ละรายการบนจอ */
const TOP_N = 8;

export { MKT_SLOW_DAYS };
export type { MarketingWall };

/**
 * ข้อมูลจอ War Room ของกิจกรรมการตลาด
 *
 * ตอบคำถามที่หัวหน้าต้องรู้ตอนนี้:
 *   1. เงินที่ยังไม่กลับเข้าบริษัทมีเท่าไหร่ และค้างอยู่ขั้นตอนไหน
 *   2. ใบไหนค้างนานผิดปกติ ต้องโทรตามวันนี้
 *   3. Memo ไหนใกล้หมดอายุหรือเลยกำหนดแล้วแต่ยังเบิกไม่ครบ
 *
 * ยอดเงินทั้งหมดคิดจากฟังก์ชันกลางใน marketing.ts ตัวเดียวกับหน้าจอปกติ
 * ตัวเลขบนจอนี้จึงตรงกับหน้าสอบถามและไฟล์ Excel เสมอ
 */

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} ฿`;

export async function buildMarketingWall(input: {
  period: WallPeriod;
  companyId?: string | null;
  activityTypeId?: string | null;
}): Promise<MarketingWall> {
  const today = workDateOf();
  const { period } = input;
  // Memo ไม่มีประเภทกิจกรรม จึงกรองด้วยช่วงวันที่และบริษัทเท่านั้น
  const memoQuery = {
    from: period.from,
    to: period.to,
    company_id: input.companyId || undefined,
  };
  const query = { ...memoQuery, activity_type_id: input.activityTypeId || undefined };

  const [rows, memos] = await Promise.all([listActivities(query), listMemos(memoQuery)]);
  const live = rows.filter((r) => r.active_status === "active");

  const counts = countByFlowStatus(rows);
  const memoTotals = summarizeMemos(memos);

  // ---- ยอดเงินรวม (ใบที่ยกเลิกไม่นับ) ----
  let request = 0;
  let approved = 0;
  let received = 0;
  let outstanding = 0;
  for (const r of live) {
    request += r.request_amount;
    approved += r.approved_amount ?? 0;
    received += r.received_amount ?? 0;
    outstanding += outstandingAmount(r);
  }

  // ---- ส่งเบิกแล้วแต่เงินยังไม่เข้า เรียงค้างนานสุดก่อน ----
  const waiting = live
    .filter((r) => r.flow_status === "submitted")
    .map((r) => {
      const since = r.submit_date ?? r.activity_date;
      const days = Math.max(0, daysBetween(since, today));
      return {
        key: r.id,
        title: `${r.doc_no} · ${r.title}`,
        detail: `${r.company_name ?? "ไม่ระบุบริษัท"} · ค้าง ${days} วัน · ${baht(expectedAmount(r))}`,
        right: `${days} วัน`,
        days,
      };
    })
    .sort((a, b) => b.days - a.days)
    .slice(0, TOP_N)
    .map(({ days: _d, ...row }) => {
      void _d;
      return row;
    });

  // ---- ยังไม่ได้ตั้งเรื่องส่งเบิก ----
  const notSubmitted = live
    .filter((r) => r.flow_status === "draft")
    .map((r) => {
      const days = Math.max(0, daysBetween(r.activity_date, today));
      return {
        key: r.id,
        title: `${r.doc_no} · ${r.title}`,
        detail: `${r.company_name ?? "ไม่ระบุบริษัท"} · จัดงานไปแล้ว ${days} วัน · ${baht(r.request_amount)}`,
        right: `${days} วัน`,
        days,
      };
    })
    .sort((a, b) => b.days - a.days)
    .slice(0, TOP_N)
    .map(({ days: _d, ...row }) => {
      void _d;
      return row;
    });

  // ---- Memo ที่ต้องดูแล ----
  const memoAlerts = memos
    .filter((m) => m.active_status === "active" && m.status !== "closed" && m.period_to)
    .map((m) => {
      const left = daysBetween(today, m.period_to as string);
      return {
        key: m.id,
        title: `${m.doc_no} · ${m.company_name ?? "ไม่ระบุบริษัท"}`,
        detail: `${MEMO_STATUS_LABEL[m.status]} · ${
          left < 0 ? `เลยกำหนด ${-left} วัน` : `เหลืออีก ${left} วัน`
        }`,
        right: left < 0 ? `เลย ${-left} วัน` : `${left} วัน`,
        left,
      };
    })
    .sort((a, b) => a.left - b.left)
    .slice(0, TOP_N)
    .map(({ left: _l, ...row }) => {
      void _l;
      return row;
    });

  // ---- ยอดคงค้างรายบริษัท ----
  const byCompany = groupTotals(rows, (r) => ({
    key: r.company_id ?? "-",
    label: r.company_name ?? "ไม่ระบุบริษัท",
  }))
    .map((g) => ({ label: g.label, value: Math.round(g.outstanding), sub: `ขอเบิก ${baht(g.request)}` }))
    .filter((g) => g.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);

  const memoByStatus = (Object.keys(MEMO_STATUS_LABEL) as MktMemoStatus[]).map((s) => ({
    label: MEMO_STATUS_LABEL[s],
    value: memoTotals.byStatus[s],
  }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    money: {
      request: Math.round(request),
      approved: Math.round(approved),
      received: Math.round(received),
      outstanding: Math.round(outstanding),
    },
    counts: {
      activities: live.length,
      draft: counts.draft,
      submitted: counts.submitted,
      received: counts.received,
      memos: memoTotals.count,
    },
    waiting,
    notSubmitted,
    memoAlerts,
    byCompany,
    memoByStatus,
  };
}

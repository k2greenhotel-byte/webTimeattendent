import "server-only";
import { listPrPending, listRequests } from "./approval-db";
import { daysBetween, workDateOf } from "./datetime";
import { listHrPending } from "./leave-db";
import { inPeriod, type WallPeriod } from "./wall-period";
import { APV_SLOW_DAYS, type ApprovalWall, type WallRank, type WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของกล่องอนุมัติรวม
 *
 * ตอบคำถามที่ผู้บริหารต้องรู้ตอนนี้:
 *   1. ตอนนี้มีเรื่องค้างรออนุมัติกี่เรื่อง คิดเป็นเงินเท่าไหร่
 *   2. เรื่องไหนดองนานที่สุด — ใครต้องเคลียร์ก่อน
 *   3. งานกองอยู่ที่โปรแกรมไหน และใครยื่นเข้ามามากที่สุด
 *
 * รวม 4 แหล่งที่หน้ากล่องรออนุมัติกลางรวมไว้แล้ว: เรื่องส่วนกลาง (APV)
 * ใบขอซ่อม/จัดซื้อ ใบลา และใบขอเบิกเงิน
 *
 * เห็นเฉพาะโปรแกรมที่ผู้ใช้คนนี้มีสิทธิ์ — ส่ง canSee เข้ามาจาก API route
 * ที่ถามสิทธิ์รายเมนูไว้แล้ว จอนี้จึงไม่มีทางโชว์ข้อมูลข้ามสิทธิ์
 *
 * โปรแกรมไหนอ่านไม่ได้ให้ข้ามไปแล้วบอกบนจอ ไม่ทำทั้งจอพังเพราะโมดูลเดียวล่ม
 */

const TOP_N = 8;

export type { ApprovalWall };
export { APV_SLOW_DAYS };

/** หนึ่งเรื่องที่รออนุมัติ ในรูปแบบกลางก่อนแปลงเป็นตัวเลข/รายการบนจอ */
type Pending = {
  key: string;
  docNo: string;
  title: string;
  requester: string;
  where: string | null;
  amount: number;
  since: string;
  module: string;
};

function rank(rows: Pending[], keyOf: (p: Pending) => string): WallRank[] {
  const tally = new Map<string, number>();
  for (const r of rows) {
    const label = keyOf(r) || "ไม่ระบุ";
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

export async function buildApprovalWall(input: {
  period: WallPeriod;
  canSee: { central: boolean; procurement: boolean; leave: boolean; advance: boolean };
}): Promise<ApprovalWall> {
  const today = workDateOf();
  const { period, canSee } = input;

  const [central, pr, hr] = await Promise.all([
    canSee.central
      ? listRequests({ statuses: ["pending", "endorsed"] }).catch(() => null)
      : Promise.resolve([]),
    canSee.procurement ? listPrPending() : Promise.resolve({ rows: [], failed: false }),
    canSee.leave || canSee.advance
      ? listHrPending()
      : Promise.resolve({ leave: [], advance: [], failed: false }),
  ]);

  const unavailable: string[] = [];
  if (central === null) unavailable.push("เรื่องส่วนกลาง");
  if (pr.failed) unavailable.push("จัดซื้อ/แจ้งซ่อม");
  if (hr.failed) unavailable.push("ขอลา/ขอเบิกเงิน");

  const rows: Pending[] = [
    ...(central ?? []).map((r) => ({
      key: `apv-${r.id}`,
      docNo: r.doc_no,
      title: r.subject,
      requester: r.requester_name,
      where: r.branch_name ?? r.company_name,
      amount: r.requested_amount,
      since: r.request_date,
      module: `${r.type_icon ?? "📄"} ${r.type_name}`,
    })),
    ...pr.rows.map((r) => ({
      key: `pr-${r.kind}-${r.id}`,
      docNo: r.doc_no,
      title: r.item_name,
      requester: r.created_by_name ?? "ไม่ระบุผู้ขอ",
      where: r.branch_name,
      amount: r.requested_amount,
      since: r.doc_date,
      module: r.kind === "repair" ? "🛠 ใบขอซ่อม" : "🧾 ใบขอจัดซื้อ",
    })),
    ...(canSee.leave ? hr.leave : []).map((r) => ({
      key: `leave-${r.id}`,
      docNo: r.doc_no,
      title: r.type_name,
      requester: r.employee_name,
      where: r.branch_name ?? r.company_name,
      amount: 0,
      since: r.request_date,
      module: "🌴 ใบลา",
    })),
    ...(canSee.advance ? hr.advance : []).map((r) => ({
      key: `adv-${r.id}`,
      docNo: r.doc_no,
      title: "ขอเบิกเงินเดือนล่วงหน้า",
      requester: r.employee_name,
      where: r.branch_name ?? r.company_name,
      amount: r.amount,
      since: r.request_date,
      module: "💵 ขอเบิกเงิน",
    })),
  ];

  const waited = (p: Pending) => Math.max(0, daysBetween(p.since, today));

  const oldest: WallRow[] = [...rows]
    .sort((a, b) => waited(b) - waited(a))
    .slice(0, TOP_N)
    .map((p) => ({
      key: p.key,
      title: `${p.docNo} · ${p.title}`,
      detail: [p.module, p.requester, p.where].filter(Boolean).join(" · "),
      right: `${waited(p)} วัน`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    counts: {
      pending: rows.length,
      central: (central ?? []).length,
      procurement: pr.rows.length,
      leave: canSee.leave ? hr.leave.length : 0,
      advance: canSee.advance ? hr.advance.length : 0,
      slow: rows.filter((p) => waited(p) >= APV_SLOW_DAYS).length,
      submittedInPeriod: rows.filter((p) => inPeriod(p.since, period)).length,
    },
    money: { pendingAmount: Math.round(rows.reduce((sum, p) => sum + p.amount, 0)) },
    oldest,
    byModule: rank(rows, (p) => p.module),
    byRequester: rank(rows, (p) => p.requester),
    unavailable,
  };
}

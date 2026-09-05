import Link from "next/link";
import DocFilters, { queryFromParams, type PrParams } from "@/components/procurement/DocFilters";
import DocTable, { docHref } from "@/components/procurement/DocTable";
import { HorizontalBarChart } from "@/components/marketing/Charts";
import { countByKey } from "@/lib/booking";
import { listCompanies } from "@/lib/core-db";
import { workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht, isOverdue, summarizeDocs } from "@/lib/procurement";
import { listDocs } from "@/lib/procurement-db";
import {
  APPROVE_STATUS_LABEL,
  APPROVE_STATUS_ORDER,
  JOB_STATUS_LABEL,
  JOB_STATUS_ORDER,
  PR_DOC_STATUS_LABEL,
  PR_DOC_STATUS_ORDER,
  REPAIR_PAY_STATUS_LABEL,
  PAY_STATUS_ORDER,
  URGENCY_LABEL,
  URGENCY_ORDER,
  type PrDocRow,
} from "@/lib/procurement-types";

export const dynamic = "force-dynamic";

const COUNT_SERIES = [{ key: "count", label: "จำนวนเอกสาร", color: "#2f7de1" }];
const countFormat = (v: number) => v.toLocaleString("th-TH");

function toItems<T extends string>(
  order: readonly T[],
  labels: Record<T, string>,
  counts: Record<T, number>,
) {
  return order.map((key) => ({ label: labels[key], count: counts[key] ?? 0 }));
}

/** หน้าจอ 6 — Dashboard: สรุปภาพรวมสถานะงาน ยอดเงิน และงานเกินกำหนด */
export default async function ProcurementDashboardPage({
  searchParams,
}: {
  searchParams: Promise<PrParams>;
}) {
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches] = await Promise.all([
    listDocs(query),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const summary = summarizeDocs(rows, today);
  const overdue: PrDocRow[] = rows
    .filter((r) => isOverdue(r, today))
    .sort((a, b) => a.doc_date.localeCompare(b.doc_date));

  const byBranch = countByKey(rows, (r) => r.branch_name, "— ไม่ระบุสาขา —");
  const byType = countByKey(rows, (r) => r.type_name, "— ไม่ระบุประเภท —").slice(0, 12);

  const statusGroups = [
    { title: "สถานะงาน (เฉพาะงานซ่อม)", items: toItems(JOB_STATUS_ORDER, JOB_STATUS_LABEL, summary.byJobStatus) },
    { title: "สถานะอนุมัติ", items: toItems(APPROVE_STATUS_ORDER, APPROVE_STATUS_LABEL, summary.byApproveStatus) },
    { title: "สถานะการเบิกเงิน", items: toItems(PAY_STATUS_ORDER, REPAIR_PAY_STATUS_LABEL, summary.byPayStatus) },
    { title: "สถานะเอกสาร", items: toItems(PR_DOC_STATUS_ORDER, PR_DOC_STATUS_LABEL, summary.byDocStatus) },
    { title: "ความเร่งด่วน", items: toItems(URGENCY_ORDER, URGENCY_LABEL, summary.byUrgency) },
  ];

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">6. Dashboard ติดตามงานซ่อม</h1>
        <p className="text-sm text-slate-500">ภาพรวมของเอกสารตามเงื่อนไขที่กรองไว้</p>
      </div>

      <DocFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/procurement/dashboard"
      />

      {/* ---------- สรุปยอด ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">เอกสารทั้งหมด</p>
          <p className="text-xl font-bold text-slate-800">{summary.total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ขอเบิก</p>
          <p className="text-xl font-bold text-slate-800">{formatBaht(summary.requested)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">อนุมัติแล้ว</p>
          <p className="text-xl font-bold text-slate-800">{formatBaht(summary.approved)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">เบิกจริง</p>
          <p className="text-xl font-bold text-slate-800">{formatBaht(summary.actual)}</p>
        </div>
      </section>

      {/* ---------- สถานะต่าง ๆ ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statusGroups.map((group) => (
          <div key={group.title} className="card space-y-2">
            <h2 className="font-semibold text-slate-800">{group.title}</h2>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-800">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ---------- แยกตามสาขา / ประเภท ---------- */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card min-w-0 space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามสาขา</h2>
          <HorizontalBarChart
            rows={byBranch.map((b) => ({ label: b.label, values: { count: b.count } }))}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card min-w-0 space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามประเภท (12 อันดับแรก)</h2>
          <HorizontalBarChart
            rows={byType.map((t) => ({ label: t.label, values: { count: t.count } }))}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
      </section>

      {/* ---------- งานเกินกำหนด ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">
            งานเกินกำหนด <span className="text-rose-600">({overdue.length} ใบ)</span>
          </h2>
          <Link href="/procurement/search" className="text-sm text-brand-600 hover:underline">
            ไปหน้าสอบถาม →
          </Link>
        </div>
        <DocTable
          rows={overdue}
          today={today}
          showKind
          hrefOf={docHref}
          emptyText="ไม่มีงานที่เกินกำหนดในเงื่อนไขนี้"
        />
      </section>
    </main>
  );
}

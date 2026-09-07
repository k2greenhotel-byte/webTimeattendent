import ClaimFilters, { queryFromParams, type ClaimParams } from "@/components/claim/ClaimFilters";
import ClaimTable from "@/components/claim/ClaimTable";
import { HorizontalBarChart } from "@/components/marketing/Charts";
import {
  countByKey,
  formatBaht,
  isOverdue,
  makerText,
  overdueDays,
  summarizeClaims,
  vehicleText,
} from "@/lib/claim";
import { listClaims } from "@/lib/claim-db";
import {
  CLAIM_DOC_STATUS_LABEL,
  CLAIM_DOC_STATUS_ORDER,
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_JOB_STATUS_ORDER,
  CLAIM_URGENCY_LABEL,
  CLAIM_URGENCY_ORDER,
  type ClaimRow,
} from "@/lib/claim-types";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const COUNT_SERIES = [{ key: "count", label: "จำนวนใบ", color: "#2f7de1" }];
const countFormat = (v: number) => v.toLocaleString("th-TH");

function toChartRows(items: { label: string; count: number }[]) {
  return items.map((i) => ({ label: i.label, values: { count: i.count } }));
}

function toItems<T extends string>(
  order: readonly T[],
  labels: Record<T, string>,
  counts: Record<T, number>,
) {
  return order.map((key) => ({ label: labels[key], count: counts[key] ?? 0 }));
}

/**
 * หน้าจอ 3 — Dashboard / war room ติดตามงานเคลม
 * ภาพรวมสถานะ งานเกินกำหนด งานรอผลจากผู้ผลิต และรถที่ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งคืนลูกค้า
 */
export default async function ClaimDashboardPage({
  searchParams,
}: {
  searchParams: Promise<ClaimParams>;
}) {
  await requirePermission("CLM_DASH", "read");
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches] = await Promise.all([
    listClaims(query),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const summary = summarizeClaims(rows, today);

  // งานที่ต้องตามด่วนที่สุดขึ้นก่อน
  const overdue: ClaimRow[] = rows
    .filter((r) => isOverdue(r, today))
    .sort((a, b) => overdueDays(b, today) - overdueDays(a, today));

  // ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งมอบรถคืนลูกค้า (ข้อ 1.4.23) — รถจอดค้างที่ร้าน
  const waitingDelivery = rows
    .filter((r) => r.doc_status !== "cancelled" && r.job_status === "done" && !r.delivered_date)
    .sort((a, b) => (a.fixed_date ?? "").localeCompare(b.fixed_date ?? ""));

  // เปิด job ไว้แล้วยังไม่ปิด (ข้อ 1.5.11-1.5.12) — เปิดค้างนานสุดขึ้นก่อน
  const openJobs = rows
    .filter(
      (r) => r.doc_status !== "cancelled" && (r.job_no || r.job_open_date) && !r.job_close_date,
    )
    .sort((a, b) => (a.job_open_date ?? "").localeCompare(b.job_open_date ?? ""));

  const byBranch = countByKey(rows, (r) => r.branch_name, "— ไม่ระบุสาขา —");
  const byCompany = countByKey(rows, (r) => r.company_name, "— ไม่ระบุบริษัท —");
  const byMaker = countByKey(rows, (r) => makerText(r), "— ยังไม่ระบุผู้ผลิต —").slice(0, 12);
  const byModel = countByKey(rows, (r) => r.db2_model_name, "— ไม่ระบุรุ่น —").slice(0, 12);

  const statusGroups = [
    {
      title: "สถานะงาน",
      items: toItems(CLAIM_JOB_STATUS_ORDER, CLAIM_JOB_STATUS_LABEL, summary.byJobStatus),
    },
    {
      title: "ความเร่งด่วน",
      items: toItems(CLAIM_URGENCY_ORDER, CLAIM_URGENCY_LABEL, summary.byUrgency),
    },
    {
      title: "สถานะเอกสาร",
      items: toItems(CLAIM_DOC_STATUS_ORDER, CLAIM_DOC_STATUS_LABEL, summary.byDocStatus),
    },
  ];

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">3. Dashboard ติดตามงานเคลม</h1>
        <p className="text-sm text-slate-500">ภาพรวมของใบขอเคลมตามเงื่อนไขที่กรองไว้</p>
      </div>

      <ClaimFilters
        params={params}
        companies={companies}
        branches={branches}
        resetHref="/claim/dashboard"
      />

      {/* ---------- สรุปยอด ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="card">
          <p className="text-xs text-slate-500">ใบขอเคลมทั้งหมด</p>
          <p className="text-xl font-bold text-slate-800">{summary.total}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">งานที่ยังไม่จบ</p>
          <p className="text-xl font-bold text-slate-800">{summary.open}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">เลยกำหนด</p>
          <p className="text-xl font-bold text-rose-600">{summary.overdue}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">รอผลจากผู้ผลิต</p>
          <p className="text-xl font-bold text-violet-600">{summary.waitingMaker}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ซ่อมเสร็จรอส่งมอบ</p>
          <p className="text-xl font-bold text-amber-600">{summary.waitingDelivery}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">job ที่ยังไม่ปิด</p>
          <p className="text-xl font-bold text-sky-600">{summary.openJobs}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยอดที่ขออนุมัติรวม</p>
          <p className="text-lg font-bold text-slate-800">{formatBaht(summary.requested)}</p>
        </div>
      </section>

      {/* ---------- สถานะต่าง ๆ ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ---------- แยกตามหน่วยงานและรถ ---------- */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามสาขา</h2>
          <HorizontalBarChart
            rows={toChartRows(byBranch)}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามบริษัท</h2>
          <HorizontalBarChart
            rows={toChartRows(byCompany)}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-800">แยกตามบริษัทผู้ผลิต</h2>
          <HorizontalBarChart
            rows={toChartRows(byMaker)}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-800">รุ่นรถที่ขอเคลมบ่อย</h2>
          <HorizontalBarChart
            rows={toChartRows(byModel)}
            series={COUNT_SERIES}
            valueFormat={countFormat}
            unit="ใบ"
          />
        </div>
      </section>

      {/* ---------- งานเกินกำหนด ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-rose-700">
          งานเกินกำหนดที่ต้องตามด่วน ({overdue.length} ใบ)
        </h2>
        <ClaimTable
          rows={overdue}
          today={today}
          emptyText="ไม่มีงานเกินกำหนด — ทุกใบยังอยู่ในกรอบเวลาที่กำหนด"
          actionLabel="เปิดใบ"
        />
      </section>

      {/* ---------- job ที่เปิดค้างไว้ (1.5.10-1.5.12) ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-sky-700">
          Job ที่เปิดไว้แล้วยังไม่ปิด ({openJobs.length} job)
        </h2>
        {openJobs.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มี job ค้าง — job ที่เปิดไว้ปิดครบทุกใบแล้ว</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {openJobs.map((row) => (
              <li key={row.id} className="py-2 text-sm">
                <span className="font-medium text-slate-800">
                  {row.job_no ? `Job ${row.job_no}` : "— ยังไม่ระบุเลขที่ job —"}
                </span>{" "}
                <span className="text-slate-600">
                  {row.doc_no} · {row.chassis_no} · {row.customer_name}
                </span>
                <div className="text-xs text-slate-500">
                  เปิด job {row.job_open_date ? formatThaiDate(row.job_open_date) : "—"} ·{" "}
                  {CLAIM_JOB_STATUS_LABEL[row.job_status]}
                  {row.branch_name ? ` · ${row.branch_name}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- รถที่ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งคืน ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-amber-700">
          ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งมอบรถคืนลูกค้า ({waitingDelivery.length} คัน)
        </h2>
        {waitingDelivery.length === 0 ? (
          <p className="text-sm text-slate-500">ส่งมอบรถคืนลูกค้าครบทุกใบแล้ว</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {waitingDelivery.map((row) => (
              <li key={row.id} className="py-2 text-sm">
                <span className="font-medium text-slate-800">{row.doc_no}</span>{" "}
                <span className="text-slate-600">
                  {row.chassis_no}
                  {vehicleText(row) ? ` · ${vehicleText(row)}` : ""} · {row.customer_name}
                </span>
                <div className="text-xs text-slate-500">
                  ซ่อมเสร็จ {row.fixed_date ? formatThaiDate(row.fixed_date) : "—"}
                  {row.customer_phone ? ` · โทร ${row.customer_phone}` : ""}
                  {row.branch_name ? ` · ${row.branch_name}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { listActivities } from "@/lib/marketing-db";
import { countByFlowStatus, formatBaht, summarize } from "@/lib/marketing";
import { FLOW_STATUS_LABEL } from "@/lib/marketing-types";
import { FlowBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

const MENU = [
  {
    href: "/marketing/activities/new",
    title: "บันทึกงานกิจกรรม",
    desc: "เปิดใบกิจกรรมใหม่ ระบุยอดขอเบิก และแนบรูปได้สูงสุด 10 รูป",
  },
  {
    href: "/marketing/submit",
    title: "บันทึกส่งเรื่องเบิกเงิน",
    desc: "บันทึกวันที่ส่ง เลขที่ไปรษณีย์ และรูปจดหมาย/ใบตอบรับ",
  },
  {
    href: "/marketing/receive",
    title: "บันทึกรับเงิน",
    desc: "บันทึกวันที่รับเงิน เลขที่ใบเสร็จ และจำนวนเงินที่ได้รับจริง",
  },
  {
    href: "/marketing/setup",
    title: "ค่าเริ่มต้น",
    desc: "พนักงาน บริษัทที่ขอเบิก และประเภทกิจกรรม",
  },
  { href: "/marketing/search", title: "สอบถาม", desc: "ค้นตามสถานะ วันที่ และบริษัท พร้อมออก Excel" },
  { href: "/marketing/dashboard", title: "Dashboard", desc: "สรุปยอดเป็นกราฟตามเดือน บริษัท และประเภท" },
];

export default async function MarketingHomePage() {
  const rows = await listActivities();
  const totals = summarize(rows);
  const byStatus = countByFlowStatus(rows);
  const recent = rows.slice(0, 8);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบกิจกรรมการตลาด</h1>
        <p className="text-sm text-slate-500">
          บันทึกกิจกรรม → ส่งเรื่องเบิกเงิน → รับเงิน ครบในที่เดียว
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="ยอดขอเบิกทั้งหมด" value={formatBaht(totals.request)} tone="slate" />
        <SummaryCard label="ยอดอนุมัติเบิก" value={formatBaht(totals.approved)} tone="sky" />
        <SummaryCard label="ได้รับเงินแล้ว" value={formatBaht(totals.received)} tone="emerald" />
        <SummaryCard label="ยอดคงค้าง" value={formatBaht(totals.outstanding)} tone="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(["draft", "submitted", "received"] as const).map((s) => (
          <Link key={s} href={`/marketing/search?flow_status=${s}`} className="card hover:border-brand-300">
            <p className="text-sm text-slate-500">{FLOW_STATUS_LABEL[s]}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{byStatus[s]} ใบ</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href} className="card hover:border-brand-300">
            <p className="font-semibold text-brand-700">{m.title}</p>
            <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
          </Link>
        ))}
      </div>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">กิจกรรมล่าสุด</h2>
          <Link href="/marketing/activities" className="text-sm text-brand-600 hover:underline">
            ดูทั้งหมด
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">
            ยังไม่มีข้อมูล —{" "}
            <Link href="/marketing/activities/new" className="text-brand-600 hover:underline">
              เริ่มบันทึกกิจกรรมแรก
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่</th>
                  <th>ชื่อกิจกรรม</th>
                  <th>บริษัท</th>
                  <th>ขอเบิก</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/marketing/activities/${r.id}`} className="text-brand-600 hover:underline">
                        {r.doc_no}
                      </Link>
                    </td>
                    <td>{formatThaiDate(r.activity_date)}</td>
                    <td className="!text-left">{r.title}</td>
                    <td>{r.company_name ?? "-"}</td>
                    <td className="!text-right">{formatBaht(r.request_amount)}</td>
                    <td>
                      <FlowBadge status={r.flow_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "sky" | "emerald" | "amber";
}) {
  const toneClass = {
    slate: "text-slate-800",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-slate-400">บาท</p>
    </div>
  );
}

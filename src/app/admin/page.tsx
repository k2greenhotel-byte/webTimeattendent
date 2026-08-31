import Link from "next/link";
import AdminPinGate from "@/components/AdminPinGate";
import BranchFilter from "@/components/BranchFilter";
import ReportTable from "@/components/ReportTable";
import { formatDuration, formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { buildDailyReport } from "@/lib/reports";
import { isAdminAuthed } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  // ประตูทางเข้า: ยังไม่ผ่าน PIN 6 หลัก
  if (!(await isAdminAuthed())) return <AdminPinGate />;

  const { branch } = await searchParams;
  const branchId = branch || undefined;

  const today = workDateOf();
  const [branches, { rows, totals, settings }] = await Promise.all([
    listBranches(),
    buildDailyReport(today, branchId),
  ]);

  const notCheckedIn = rows.filter((r) => !r.summary.checkInAt && r.summary.status !== "holiday");
  const lateRows = rows.filter((r) => r.summary.lateMinutes > 0);
  const currentBranch = branches.find((b) => b.id === branchId);

  const cards = [
    { label: "พนักงานทั้งหมด", value: String(rows.length), tone: "text-slate-800" },
    {
      label: "ลงเวลาเข้างานแล้ว",
      value: String(rows.length - notCheckedIn.length),
      tone: "text-emerald-600",
    },
    { label: "มาสาย", value: String(lateRows.length), tone: "text-rose-600" },
    { label: "ลงเวลาไม่ครบ", value: String(totals.incompleteDays), tone: "text-amber-600" },
    { label: "ยังไม่มาทำงาน", value: String(notCheckedIn.length), tone: "text-slate-500" },
    { label: "ชั่วโมงทำงานวันนี้", value: formatDuration(totals.workMinutes), tone: "text-slate-800" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{settings.org_name}</h1>
          <p className="text-sm text-slate-500">
            ภาพรวมวันนี้ · {formatThaiDate(today)} ·{" "}
            {currentBranch ? `สาขา ${currentBranch.name}` : `ทุกสาขา (${branches.length} สาขา)`}
          </p>
        </div>

        <form method="get" className="no-print flex items-end gap-2">
          <BranchFilter branches={branches} value={branchId} />
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">รายละเอียดวันนี้</h2>
          <Link
            href={`/admin/reports/daily?date=${today}${branchId ? `&branch=${branchId}` : ""}`}
            className="text-sm text-brand-600 hover:underline"
          >
            เปิดรายงานรายวัน →
          </Link>
        </div>
        <ReportTable rows={rows} showEmployee editBase="/admin/records" />
      </section>
    </main>
  );
}

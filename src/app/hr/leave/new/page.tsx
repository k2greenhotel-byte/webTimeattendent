import Link from "next/link";
import LeaveForm from "@/components/hr/LeaveForm";
import { workDateOf } from "@/lib/datetime";
import { getHireDate, listLeaveTypes } from "@/lib/leave-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HR_LEAVE_NEW", "write");
  const params = await searchParams;

  // เวลาทั้งหมดมาจาก server — เครื่องผู้ใช้ปรับนาฬิกาได้ และเวลานี้มีผลต่อการหักเงิน
  const now = new Date();
  const [types, hireDate] = await Promise.all([listLeaveTypes(true), getHireDate(user.id)]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">แจ้งลา / หยุดงาน / เข้างานสาย</h1>
          <p className="text-sm text-slate-500">
            ผู้แจ้ง: {user.full_name}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""} · เวลาที่แจ้งใช้เวลาของเซิร์ฟเวอร์
          </p>
        </div>
        <Link href="/hr/leave" className="text-sm text-brand-600 hover:underline">
          ดูใบแจ้งของฉัน →
        </Link>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {types.length === 0 ? (
        <p className="card text-sm text-slate-600">
          ยังไม่มีประเภทการลาที่เปิดใช้งาน — ให้ผู้ดูแลระบบเพิ่มที่เมนู
          &quot;ตั้งค่าประเภทการลา&quot; ก่อน
        </p>
      ) : (
        <LeaveForm
          types={types}
          today={workDateOf(now)}
          serverNow={now.toISOString()}
          hireDate={hireDate}
        />
      )}
    </main>
  );
}

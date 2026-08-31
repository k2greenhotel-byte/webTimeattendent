import Link from "next/link";
import BranchFilter from "@/components/BranchFilter";
import { formatThaiDate, monthBounds, workDateOf } from "@/lib/datetime";
import { countAttendance, listBranches, listEmployees } from "@/lib/db";
import { getSupabase } from "@/lib/supabase-server";
import { deleteAttendanceForm } from "./actions";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  target_table: string;
  created_at: string;
};

async function recentAudit(): Promise<AuditRow[]> {
  const { data } = await getSupabase()
    .from("audit_logs")
    .select("id, action, target_table, created_at")
    .like("action", "delete%")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as AuditRow[];
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    employeeId?: string;
    branch?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  const params = await searchParams;

  const today = workDateOf();
  const bounds = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const from = params.from ?? bounds.from;
  const to = params.to ?? today;
  const employeeId = params.employeeId || undefined;
  const branchId = params.branch || undefined;

  const [branches, employees, matched, audit] = await Promise.all([
    listBranches(),
    listEmployees({ branchId }),
    countAttendance({ from, to, employeeId, branchId }),
    recentAudit(),
  ]);

  const target = employees.find((e) => e.id === employeeId);
  const branch = branches.find((b) => b.id === branchId);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ลบข้อมูล</h1>
        <p className="text-sm text-slate-500">
          พื้นที่สำหรับล้างข้อมูลที่ไม่ต้องการ — <strong>การลบย้อนกลับไม่ได้</strong>{" "}
          และรูปถ่ายใน storage จะถูกลบไปพร้อมกัน
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-4 border-rose-200">
        <div>
          <h2 className="font-semibold text-slate-800">ลบข้อมูลการลงเวลา</h2>
          <p className="text-xs text-slate-500">
            เลือกช่วงวันที่ (และสาขา/พนักงานถ้าต้องการ) ระบบจะบอกจำนวนรายการก่อนลบ
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="from">
              ตั้งแต่
            </label>
            <input id="from" name="from" type="date" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">
              ถึง
            </label>
            <input id="to" name="to" type="date" defaultValue={to} className="input" />
          </div>
          <BranchFilter branches={branches} value={branchId} />
          <div>
            <label className="label" htmlFor="employeeId">
              พนักงาน
            </label>
            <select id="employeeId" name="employeeId" defaultValue={employeeId ?? ""} className="input">
              <option value="">ทุกคน</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emp_code} · {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            ตรวจจำนวน
          </button>
        </form>

        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p>
            เงื่อนไขที่เลือก: <strong>{formatThaiDate(from)}</strong> ถึง{" "}
            <strong>{formatThaiDate(to)}</strong> ·{" "}
            {branch ? `สาขา ${branch.name}` : "ทุกสาขา"} ·{" "}
            {target ? `${target.emp_code} ${target.full_name}` : "ทุกคน"}
          </p>
          <p className="mt-2 text-lg">
            พบข้อมูลที่จะถูกลบ{" "}
            <strong className={matched > 0 ? "text-rose-600" : "text-slate-500"}>
              {matched} รายการ
            </strong>
          </p>
        </div>

        <form action={deleteAttendanceForm} className="space-y-3">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="branch" value={branchId ?? ""} />
          <input type="hidden" name="employeeId" value={employeeId ?? ""} />

          <label className="flex items-center gap-2 text-sm text-rose-700">
            <input type="checkbox" name="confirm" />
            ยืนยันว่าต้องการลบข้อมูล {matched} รายการนี้ถาวร (กู้คืนไม่ได้)
          </label>

          <button type="submit" className="btn-danger" disabled={matched === 0}>
            ลบข้อมูลการลงเวลาตามเงื่อนไข
          </button>
        </form>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">ลบข้อมูลอื่น ๆ</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>
            <Link href="/admin/employees" className="text-brand-600 hover:underline">
              พนักงาน
            </Link>{" "}
            — ลบพนักงานถาวร (ประวัติการลงเวลาและรูปของคนนั้นถูกลบตามไปด้วย)
          </li>
          <li>
            <Link href="/admin/branches" className="text-brand-600 hover:underline">
              สาขา
            </Link>{" "}
            — ลบได้แม้ยังมีพนักงานอยู่ (ต้องติ๊กยืนยัน พนักงานจะกลายเป็นไม่ระบุสาขา)
          </li>
          <li>
            <Link href="/admin/setup" className="text-brand-600 hover:underline">
              กะทำงาน / แผนก / ตำแหน่ง
            </Link>{" "}
            — ลบได้แม้มีการใช้งานอยู่ (ต้องติ๊กยืนยัน)
          </li>
          <li>
            <Link href="/admin/holidays" className="text-brand-600 hover:underline">
              วันหยุด
            </Link>{" "}
            — ลบได้ทันที
          </li>
          <li>
            แก้/ลบการลงเวลาทีละรายการหรือทั้งวัน — กดปุ่ม &quot;แก้ไข&quot; จากตารางในหน้ารายงาน
          </li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold text-slate-800">ประวัติการลบล่าสุด</h2>
        {audit.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-500">ยังไม่มีการลบข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เมื่อ</th>
                  <th>การกระทำ</th>
                  <th>ตาราง</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(row.created_at).toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok",
                        hour12: false,
                      })}
                    </td>
                    <td>{row.action}</td>
                    <td>{row.target_table}</td>
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

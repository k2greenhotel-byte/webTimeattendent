import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { workDateOf } from "@/lib/datetime";
import { getBranchById, getEmployeeById, listEmployees } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { createSwapRequestForm } from "../actions";

export const dynamic = "force-dynamic";

/** พนักงานขอสลับกะ/สลับวันหยุดกับเพื่อนร่วมงาน — ต้องรออีกฝ่ายยืนยันจึงจะมีผลจริง */
export default async function NewShiftSwapPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);
  const today = workDateOf();

  const colleagues = employee?.branch_id
    ? (await listEmployees({ activeOnly: true, branchId: employee.branch_id })).filter(
        (e) => e.id !== user.id,
      )
    : [];

  return (
    <div className="min-h-screen">
      <AppHeader user={user} links={[{ href: "/punch", label: "ลงเวลา" }]} />

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ขอสลับกะ / สลับวันหยุด</h1>
          <p className="text-sm text-slate-500">
            เลือกวันของคุณที่จะยกให้เพื่อนร่วมงาน และวันของเพื่อนร่วมงานที่คุณจะไปแทน — ระบบจะส่งคำขอไปให้เขา
            ยืนยัน เมื่อยืนยันแล้วตารางเวรของทั้งสองฝ่ายจะสลับกันทันที ก่อนหน้านั้นยังไม่มีผลใด ๆ
          </p>
        </div>

        {params.err && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
        )}

        {colleagues.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ไม่พบเพื่อนร่วมงานที่สาขาเดียวกัน (สลับกะได้เฉพาะคนสาขาเดียวกันเท่านั้น)
          </p>
        ) : (
          <form action={createSwapRequestForm} className="card space-y-3">
            <div>
              <label className="label" htmlFor="requester_date">
                วันของคุณ (ที่จะยกให้เพื่อน)
              </label>
              <input
                id="requester_date"
                name="requester_date"
                type="date"
                min={today}
                defaultValue={today}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="partner_id">
                สลับกับ
              </label>
              <select id="partner_id" name="partner_id" className="input" required defaultValue="">
                <option value="" disabled>
                  — เลือกเพื่อนร่วมงาน —
                </option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emp_code} · {c.full_name}
                    {c.nickname ? ` (${c.nickname})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="partner_date">
                วันของเพื่อน (ที่คุณจะไปแทน)
              </label>
              <input
                id="partner_date"
                name="partner_date"
                type="date"
                min={today}
                defaultValue={today}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="note">
                หมายเหตุ (ไม่บังคับ)
              </label>
              <input id="note" name="note" className="input" placeholder="เช่น ติดธุระส่วนตัว" />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-3">
                ส่งคำขอสลับกะ
              </button>
              <Link href="/punch" className="btn-secondary py-3">
                ยกเลิก
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              สลับได้เฉพาะเพื่อนร่วมงานสาขาเดียวกัน · เลือกได้เฉพาะวันนี้หรือวันข้างหน้า · คำขอจะมีผลก็ต่อเมื่อเพื่อน
              กดยืนยันแล้วเท่านั้น
            </p>
          </form>
        )}

        {branch && (
          <p className="text-center text-xs text-slate-400">สาขา {branch.name}</p>
        )}
      </main>
    </div>
  );
}

import Link from "next/link";
import { createAdvanceForm } from "@/app/hr/actions";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewAdvancePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requirePermission("HR_ADV_NEW", "write");
  const params = await searchParams;
  const today = workDateOf();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ขอเบิกเงินเดือน</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · ผู้ขอเบิก: {user.full_name}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>
        </div>
        <Link href="/hr/advance" className="text-sm text-brand-600 hover:underline">
          ดูใบขอเบิกของฉัน →
        </Link>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={createAdvanceForm} className="card space-y-4">
        <div>
          <label className="label" htmlFor="purpose">
            3. รายการขอเบิกเพื่อ *
          </label>
          <input
            id="purpose"
            name="purpose"
            className="input"
            placeholder="เช่น ค่ารักษาพยาบาลลูก / ค่าเทอมลูก / ซ่อมรถ"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="detail">
            รายละเอียดเพิ่มเติม
          </label>
          <textarea
            id="detail"
            name="detail"
            rows={3}
            className="input"
            placeholder="อธิบายเหตุผลและความจำเป็น เพื่อให้ผู้อนุมัติพิจารณาได้เร็วขึ้น"
          />
        </div>

        <div>
          <label className="label" htmlFor="amount">
            5. ยอดเงินที่ขอเบิก (บาท) *
          </label>
          <input
            id="amount"
            name="amount"
            className="input sm:w-64"
            inputMode="decimal"
            placeholder="0"
            required
          />
        </div>

        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          เลขที่ใบขอเบิกและวันที่ระบบออกให้อัตโนมัติ · ผู้อนุมัติอาจอนุมัติเต็มจำนวน
          อนุมัติบางส่วน หรือไม่อนุมัติ และคุณจะเห็นยอดที่อนุมัติจริงที่หน้ารายการ
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            บันทึกและส่งให้ผู้อนุมัติ
          </button>
          <Link href="/hr/advance" className="btn-secondary w-full sm:w-auto">
            ยกเลิก
          </Link>
        </div>
      </form>
    </main>
  );
}

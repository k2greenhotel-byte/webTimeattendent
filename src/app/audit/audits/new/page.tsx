import Link from "next/link";
import { createAuditForm } from "@/app/audit/actions";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { workDateOf } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * เปิดใบคุมงานใหม่
 * ชื่อผู้ตรวจสอบดึงจากบัญชีที่ล็อกอินอยู่เสมอ และเลขที่คุมงานออกให้อัตโนมัติตอนบันทึก
 */
export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("AUD_ENTRY", "write");
  const params = await searchParams;

  const [companies, branches] = await Promise.all([listCompanies(true), listBranches(true)]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">เปิดใบคุมงานใหม่</h1>
          <p className="text-sm text-slate-500">
            หนึ่งใบต่อหนึ่งวันทำงาน — เลขที่คุมงานระบบออกให้อัตโนมัติ (AUD-ปี พ.ศ.-ลำดับ)
          </p>
        </div>
        <Link href="/audit/audits" className="btn-secondary">
          ← กลับรายการใบคุมงาน
        </Link>
      </div>

      {params.err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>}

      <form action={createAuditForm} className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">วันที่ทำงาน *</label>
          <input name="audit_date" type="date" defaultValue={workDateOf()} className="input" required />
        </div>

        <div>
          <label className="label">ผู้ตรวจสอบ</label>
          <input value={user.full_name} className="input bg-slate-50" readOnly />
          <p className="mt-1 text-xs text-slate-400">ดึงจากบัญชีที่เข้าระบบอยู่ แก้ไม่ได้</p>
        </div>

        <div>
          <label className="label">บริษัท</label>
          <select name="company_id" defaultValue={user.company_id ?? ""} className="input">
            <option value="">— ไม่ระบุ —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">สาขาที่ตรวจ</label>
          <select name="branch_id" defaultValue={user.branch_id ?? ""} className="input">
            <option value="">— ทุกสาขา —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">หมายเหตุ</label>
          <input name="note" className="input" maxLength={500} placeholder="เช่น ตรวจงานขายสาขาหลัก" />
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            เปิดใบคุมงาน
          </button>
        </div>
      </form>
    </main>
  );
}

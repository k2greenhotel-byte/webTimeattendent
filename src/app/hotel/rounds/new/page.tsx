import Link from "next/link";
import { redirect } from "next/navigation";
import HotelCheckForm from "@/components/hotel/HotelCheckForm";
import { getSelectableContext } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { findRoundByBranchDate, getChecklist } from "@/lib/hotel-db";
import { requirePermission } from "@/lib/session";
import { saveRoundForm } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * เปิดใบตรวจเช็คใหม่ — สองขั้น
 *   1. เลือกบริษัท/สาขา/วันที่ (เติมให้จากบัญชีที่ล็อกอินอยู่)
 *   2. ประกอบรายการตรวจของสาขานั้นแล้วให้ช่างกดผลทีละข้อ
 *
 * แยกสองขั้นเพราะรายการตรวจขึ้นกับสาขา (บางรายการมีเฉพาะบางสาขา)
 * ต้องดึงจาก server ใหม่ทั้งชุดเมื่อเปลี่ยนสาขา
 */
export default async function NewRoundPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HTL_ENTRY", "write");
  const params = await searchParams;

  const { companies, branches } = await getSelectableContext(user.id);
  const today = workDateOf();
  const checkDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  const branch = params.branch ? branches.find((b) => b.id === params.branch) : null;

  // เลือกสาขาแล้วแต่มีใบของวันนั้นอยู่ก่อน — พาไปแก้ใบเดิม ไม่ให้เปิดใบซ้ำ
  if (branch) {
    const existing = await findRoundByBranchDate(branch.id, checkDate);
    if (existing) {
      redirect(
        `/hotel/rounds/${existing.id}?msg=${encodeURIComponent(
          `สาขานี้มีใบตรวจเช็คของ ${formatThaiDate(checkDate)} อยู่แล้ว (${existing.doc_no}) เปิดใบเดิมให้แก้ไขต่อ`,
        )}`,
      );
    }
  }

  const messages = (
    <>
      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}
    </>
  );

  // ---------- ขั้นที่ 1: เลือกสาขาและวันที่ ----------
  if (!branch) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-800">เปิดใบตรวจเช็คประจำวัน</h1>
          <Link href="/hotel/rounds" className="btn-secondary">
            ← กลับรายการ
          </Link>
        </div>

        {messages}

        <form className="card space-y-3" method="get">
          <p className="text-sm text-slate-500">
            ผู้ตรวจเช็ค: <span className="font-medium text-slate-700">{user.full_name}</span>
            {user.company_name ? ` · ${user.company_name}` : ""}
            {user.branch_name ? ` · สาขา ${user.branch_name}` : ""}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="date">
                วันที่ตรวจเช็ค *
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={checkDate}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="branch">
                สาขา / โรงแรมที่ตรวจ *
              </label>
              <select
                id="branch"
                name="branch"
                defaultValue={user.branch_id ?? ""}
                className="input"
                required
              >
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {branches.length === 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าถึงสาขาใดเลย กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์สาขาก่อน
            </p>
          )}

          <button type="submit" className="btn-primary w-full sm:w-auto">
            เริ่มตรวจเช็ค
          </button>
        </form>
      </main>
    );
  }

  // ---------- ขั้นที่ 2: ลงผลรายข้อ ----------
  const checklist = await getChecklist(branch.id);
  const company = companies.find((c) => c.id === branch.company_id) ?? null;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ตรวจเช็ค {branch.name}</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(checkDate)} · เลขที่ใบระบบออกให้ตอนกดบันทึก
          </p>
        </div>
        <Link href="/hotel/rounds" className="btn-secondary">
          ← กลับรายการ
        </Link>
      </div>

      {messages}

      <HotelCheckForm
        checklist={checklist}
        header={{
          check_date: checkDate,
          company_id: company?.id ?? "",
          company_name: company?.name ?? "",
          branch_id: branch.id,
          branch_name: branch.name,
          inspector_name: user.full_name,
          note: "",
        }}
        changeHeaderHref="/hotel/rounds/new"
        action={saveRoundForm}
      />
    </main>
  );
}

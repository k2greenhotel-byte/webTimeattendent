import { listCompanies, listCoreUsers } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { formatBaht } from "@/lib/procurement";
import { listFunds } from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { createFundForm, deleteFundForm, updateFundForm } from "./actions";

export const dynamic = "force-dynamic";

/**
 * ตั้งค่า วงเงินสำรองจ่าย
 *
 * หนึ่งคนหนึ่งกอง — ตั้งเพดานเงินที่ให้ถือไว้จ่ายหน้างาน
 * ยอดคงเหลือคิดสดจาก เติมเข้า − คืนคืน − ที่จ่ายออกไปแล้ว จึงตรงกับความจริงเสมอ
 */
export default async function FundSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("PR_FUND", "read");
  const params = await searchParams;

  const [canWrite, canEdit, canDelete, funds, users, companies, branches] = await Promise.all([
    checkPermission("PR_FUND", "write"),
    checkPermission("PR_FUND", "edit"),
    checkPermission("PR_FUND", "delete"),
    listFunds({ includeInactive: true }),
    listCoreUsers(),
    listCompanies(true),
    listBranches(true),
  ]);

  // คนที่ยังไม่มีกอง ถึงจะเลือกมาตั้งวงเงินใหม่ได้ (หนึ่งคนหนึ่งกอง)
  const taken = new Set(funds.map((f) => f.holder_id));
  const candidates = users.filter((u) => u.is_active && !taken.has(u.id));

  const totalLimit = funds.reduce((sum, f) => sum + (f.is_active ? f.limit_amount : 0), 0);
  const totalBalance = funds.reduce((sum, f) => sum + (f.is_active ? f.balance : 0), 0);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่า วงเงินสำรองจ่าย</h1>
        <p className="text-sm text-slate-500">
          {funds.length} กอง · วงเงินรวม {formatBaht(totalLimit)} · ถืออยู่จริงรวม{" "}
          {formatBaht(totalBalance)}
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- เพิ่มกองใหม่ ---------- */}
      {canWrite && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่มวงเงินสำรองจ่าย</h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-500">
              พนักงานที่ใช้งานอยู่ทุกคนมีกองเงินสำรองแล้ว — แก้วงเงินได้ที่รายการด้านล่าง
            </p>
          ) : (
            <form action={createFundForm} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <input type="hidden" name="is_active" value="on" />
              <div className="lg:col-span-4">
                <label className="label" htmlFor="holder_id">
                  ผู้ถือเงิน *
                </label>
                <select id="holder_id" name="holder_id" className="input" required>
                  <option value="">— เลือกพนักงาน —</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.emp_code} · {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="label" htmlFor="company_id">
                  บริษัท
                </label>
                <select id="company_id" name="company_id" className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="label" htmlFor="branch_id">
                  สาขา
                </label>
                <select id="branch_id" name="branch_id" className="input">
                  <option value="">— ไม่ระบุ —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="label" htmlFor="limit_amount">
                  วงเงิน *
                </label>
                <input
                  id="limit_amount"
                  name="limit_amount"
                  className="input text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="lg:col-span-10">
                <label className="label" htmlFor="note">
                  หมายเหตุ
                </label>
                <input id="note" name="note" className="input" />
              </div>
              <div className="flex items-end lg:col-span-2">
                <button type="submit" className="btn-primary w-full">
                  เพิ่มกอง
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ---------- กองที่มีอยู่ ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">กองเงินสำรองทั้งหมด ({funds.length} กอง)</h2>

        {funds.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีกองเงินสำรอง — เพิ่มได้จากแบบฟอร์มด้านบน</p>
        ) : (
          <ul className="space-y-3">
            {funds.map((fund) => (
              <li
                key={fund.id}
                className={`rounded-xl border p-3 ${
                  fund.is_active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">
                    {fund.holder_name}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {fund.holder_code}
                    </span>
                  </span>
                  {!fund.is_active && (
                    <span className="badge bg-slate-200 text-slate-600">ปิดใช้งาน</span>
                  )}
                  <span className="ml-auto text-sm text-slate-600">
                    ถืออยู่{" "}
                    <span className="font-semibold text-slate-800">{formatBaht(fund.balance)}</span>{" "}
                    / วงเงิน {formatBaht(fund.limit_amount)}
                    <span className="ml-2 text-xs text-slate-400">
                      (เติม {formatBaht(fund.topup_total)} · คืน {formatBaht(fund.return_total)} ·
                      จ่าย {formatBaht(fund.paid_total)})
                    </span>
                  </span>
                </div>

                {canEdit ? (
                  <form
                    action={updateFundForm}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12"
                  >
                    <input type="hidden" name="id" value={fund.id} />
                    <input type="hidden" name="holder_id" value={fund.holder_id} />

                    <div className="lg:col-span-3">
                      <label className="label">บริษัท</label>
                      <select name="company_id" defaultValue={fund.company_id ?? ""} className="input">
                        <option value="">— ไม่ระบุ —</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-3">
                      <label className="label">สาขา</label>
                      <select name="branch_id" defaultValue={fund.branch_id ?? ""} className="input">
                        <option value="">— ไม่ระบุ —</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="label">วงเงิน *</label>
                      <input
                        name="limit_amount"
                        defaultValue={String(fund.limit_amount)}
                        className="input text-right"
                        inputMode="decimal"
                        required
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="label">หมายเหตุ</label>
                      <input name="note" defaultValue={fund.note ?? ""} className="input" />
                    </div>
                    <div className="flex flex-wrap items-end gap-3 lg:col-span-2">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" name="is_active" defaultChecked={fund.is_active} />
                        ใช้งาน
                      </label>
                      <button type="submit" className="btn-secondary">
                        บันทึก
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-slate-500">บัญชีนี้ไม่มีสิทธิ์แก้วงเงิน (ดูอย่างเดียว)</p>
                )}

                {canDelete && fund.topup_total === 0 && fund.paid_total === 0 && (
                  <form action={deleteFundForm} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="id" value={fund.id} />
                    <button type="submit" className="text-sm text-rose-600 hover:underline">
                      ลบกองนี้ (ยังไม่มีความเคลื่อนไหว)
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

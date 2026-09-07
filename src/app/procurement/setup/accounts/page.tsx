import Link from "next/link";
import { listAccounts } from "@/lib/procurement-db";
import {
  ACCOUNT_CATEGORY_CLASS,
  ACCOUNT_CATEGORY_LABEL,
  ACCOUNT_CATEGORY_ORDER,
  type AccountCategory,
  type PrAccountRow,
} from "@/lib/procurement-types";
import { checkPermission, requirePermission } from "@/lib/session";
import { createAccountForm, deleteAccountForm, updateAccountForm } from "./actions";

export const dynamic = "force-dynamic";

/** ตัวเลือกบัญชีคุม — แสดงรหัสกับชื่อ และบอกหมวดกำกับไว้ให้เลือกไม่ผิดหมวด */
function ParentOptions({ accounts }: { accounts: PrAccountRow[] }) {
  return (
    <>
      <option value="">— ไม่มี (เป็นบัญชีคุม) —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} · {a.name} ({ACCOUNT_CATEGORY_LABEL[a.category]})
        </option>
      ))}
    </>
  );
}

/**
 * ตั้งค่าผังบัญชี — 5 หมวดตามหลักบัญชี พร้อมบัญชีคุมและบัญชีย่อย
 * ใช้เป็นตัวเลือก "ประเภทค่าใช้จ่าย" ในใบเบิกเงินสดย่อย (ข้อ 4)
 */
export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; cat?: string }>;
}) {
  await requirePermission("PR_ACCOUNT", "read");
  const params = await searchParams;

  const [canWrite, canEdit, canDelete, all] = await Promise.all([
    checkPermission("PR_ACCOUNT", "write"),
    checkPermission("PR_ACCOUNT", "edit"),
    checkPermission("PR_ACCOUNT", "delete"),
    listAccounts({ includeInactive: true }),
  ]);

  const filter = (ACCOUNT_CATEGORY_ORDER as string[]).includes(params.cat ?? "")
    ? (params.cat as AccountCategory)
    : null;

  const shown = filter ? all.filter((a) => a.category === filter) : all;

  // จัดกลุ่มตามหมวด แล้วเรียงบัญชีคุมก่อนบัญชีย่อยของมัน
  const groups = ACCOUNT_CATEGORY_ORDER.map((category) => ({
    category,
    rows: shown.filter((a) => a.category === category),
  })).filter((g) => g.rows.length > 0);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-800">ตั้งค่า ผังบัญชี</h1>
          <p className="text-sm text-slate-500">
            {all.length} บัญชี · ใช้เป็นประเภทค่าใช้จ่ายในใบเบิกเงินสดย่อย
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href="/procurement/setup/vendors" className="btn-secondary flex-1 sm:flex-none">
            เจ้าหนี้/ผู้ขาย
          </Link>
          <Link href="/procurement" className="btn-secondary flex-1 sm:flex-none">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- ตัวกรองหมวด ---------- */}
      <div className="no-print -mx-1 flex gap-2 overflow-x-auto px-1">
        <Link
          href="/procurement/setup/accounts"
          className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
            !filter ? "bg-brand-500 text-white" : "border border-slate-300 bg-white text-slate-600"
          }`}
        >
          ทุกหมวด
        </Link>
        {ACCOUNT_CATEGORY_ORDER.map((c) => (
          <Link
            key={c}
            href={`/procurement/setup/accounts?cat=${c}`}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
              filter === c ? "bg-brand-500 text-white" : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            {ACCOUNT_CATEGORY_LABEL[c]}
          </Link>
        ))}
      </div>

      {canWrite && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เพิ่มบัญชีใหม่</h2>
          <form action={createAccountForm} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">รหัสบัญชี *</label>
              <input name="code" className="input" placeholder="5440" maxLength={20} required />
            </div>
            <div>
              <label className="label">ชื่อบัญชี *</label>
              <input name="name" className="input" placeholder="ค่าซ่อมแซมอื่น ๆ" maxLength={120} required />
            </div>
            <div>
              <label className="label">หมวดบัญชี *</label>
              <select name="category" defaultValue={filter ?? "expense"} className="input" required>
                {ACCOUNT_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {ACCOUNT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">บัญชีคุม</label>
              <select name="parent_id" defaultValue="" className="input">
                <ParentOptions accounts={all} />
              </select>
            </div>
            <div>
              <label className="label">ลำดับ</label>
              <input name="sort_order" className="input" inputMode="numeric" placeholder="0" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่มบัญชี
              </button>
            </div>
          </form>
          <p className="text-xs text-slate-500">
            บัญชีย่อยต้องอยู่หมวดเดียวกับบัญชีคุม · ไม่เลือกบัญชีคุม = บัญชีนี้เป็นบัญชีคุมเอง
          </p>
        </section>
      )}

      {groups.length === 0 ? (
        <p className="card text-sm text-slate-500">ยังไม่มีบัญชีในหมวดนี้</p>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <span className={`badge ${ACCOUNT_CATEGORY_CLASS[group.category]}`}>
                {ACCOUNT_CATEGORY_LABEL[group.category]}
              </span>
              <span className="text-sm font-normal text-slate-400">({group.rows.length} บัญชี)</span>
            </h2>

            <ul className="space-y-2">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-xl border p-3 ${
                    row.parent_id ? "border-slate-200 sm:ml-6" : "border-slate-300 bg-slate-50/60"
                  }`}
                >
                  {canEdit ? (
                    <form
                      action={updateAccountForm}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        name="code"
                        defaultValue={row.code}
                        className="input"
                        maxLength={20}
                        required
                        aria-label="รหัสบัญชี"
                      />
                      <input
                        name="name"
                        defaultValue={row.name}
                        className="input lg:col-span-2"
                        maxLength={120}
                        required
                        aria-label="ชื่อบัญชี"
                      />
                      <select
                        name="category"
                        defaultValue={row.category}
                        className="input"
                        aria-label="หมวดบัญชี"
                      >
                        {ACCOUNT_CATEGORY_ORDER.map((c) => (
                          <option key={c} value={c}>
                            {ACCOUNT_CATEGORY_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      <select
                        name="parent_id"
                        defaultValue={row.parent_id ?? ""}
                        className="input"
                        aria-label="บัญชีคุม"
                      >
                        <ParentOptions accounts={all.filter((a) => a.id !== row.id)} />
                      </select>

                      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
                        <input
                          name="sort_order"
                          defaultValue={String(row.sort_order)}
                          className="input w-20"
                          inputMode="numeric"
                          aria-label="ลำดับ"
                        />
                        <label className="flex items-center gap-1 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            name="is_active"
                            defaultChecked={row.is_active}
                            className="h-4 w-4"
                          />
                          ใช้งาน
                        </label>
                        {row.child_count > 0 && (
                          <span className="text-xs text-slate-500">บัญชีย่อย {row.child_count}</span>
                        )}
                        <button type="submit" className="btn-secondary">
                          บันทึก
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                      <span className="w-24 font-medium">{row.code}</span>
                      <span className="min-w-40 flex-1">{row.name}</span>
                      {row.parent_code && (
                        <span className="text-xs text-slate-400">คุมโดย {row.parent_code}</span>
                      )}
                      <span className={row.is_active ? "text-emerald-600" : "text-slate-400"}>
                        {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </div>
                  )}

                  {canDelete && (
                    <form action={deleteAccountForm} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="name" value={`${row.code} ${row.name}`} />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input type="checkbox" name="confirm" className="h-4 w-4" />
                        ยืนยัน
                      </label>
                      <button type="submit" className="btn-danger">
                        ลบ
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

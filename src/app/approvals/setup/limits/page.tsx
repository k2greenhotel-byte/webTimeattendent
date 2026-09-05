import Link from "next/link";
import AuthorityTester from "@/components/approval/AuthorityTester";
import UserAuthorityForm from "@/components/approval/UserAuthorityForm";
import { groupLimitsByUser, userAuthorityFrom } from "@/lib/approval";
import { listLimits, listTypes } from "@/lib/approval-db";
import type { ApvLimit } from "@/lib/approval-types";
import { listCompanies, listCoreUsers } from "@/lib/core-db";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { requirePermission } from "@/lib/session";
import {
  createLimitForm,
  deleteLimitForm,
  revokeUserAuthorityForm,
  updateAutoApproveForm,
  updateLimitForm,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovalLimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; user?: string }>;
}) {
  const user = await requirePermission("APV_LIMITS", "read");
  const params = await searchParams;

  const [limits, types, users, companies] = await Promise.all([
    listLimits(),
    listTypes(),
    listCoreUsers(),
    listCompanies(true),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const selected = params.user ? (userById.get(params.user) ?? null) : null;
  const approvers = groupLimitsByUser(limits);
  const levelRules = limits.filter((l) => !l.user_id);
  const amountTypes = types.filter((t) => t.has_amount);

  const amountText = (value: number | null) =>
    value === null ? "ไม่จำกัด" : `${value.toLocaleString("th-TH")} บาท`;

  /** ป้ายสรุปกฎหนึ่งข้อของคน: "💰 ขอเบิกเงิน ≤ 5,000" */
  const ruleChip = (l: ApvLimit) => {
    const type = l.type_id ? typeById.get(l.type_id) : null;
    const name = l.type_id ? (type?.name ?? "เรื่องที่ถูกลบ") : "ทุกประเภทเรื่อง";
    const amount = type && !type.has_amount ? "" : ` ≤ ${amountText(l.max_amount)}`;
    return `${type?.icon ?? "📋"} ${name}${amount}`;
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าอำนาจอนุมัติ</h1>
        <p className="text-sm text-slate-500">
          เลือกคนที่จะให้อำนาจ → ติ๊กว่าอนุมัติเรื่องใดได้บ้าง → ใส่วงเงิน/ส่วนลดของแต่ละเรื่อง ·
          เกินวงเงินจะกดอนุมัติไม่ได้ ทำได้แค่เสนอขึ้นผู้มีอำนาจสูงกว่า · แก้ได้ตลอด มีผลทันที ·
          ส่วนสิทธิ์ &quot;เข้าหน้าจอไหนได้&quot; ตั้งที่{" "}
          <Link href="/core/program-rights" className="text-brand-600 hover:underline">
            ระบบส่วนกลาง → สิทธิ์เมนูในโปรแกรม
          </Link>
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- ขั้นที่ 1-2: เลือกคน แล้วติ๊กเรื่อง + วงเงิน ---------- */}
      <section id="editor" className="card space-y-4 border-brand-500/40">
        <div>
          <h2 className="font-semibold text-slate-800">ผู้มีอำนาจอนุมัติ</h2>
          <p className="text-sm text-slate-500">
            ขั้นที่ 1 · เลือกผู้ใช้ที่จะให้อำนาจอนุมัติ (กฎเฉพาะคน ชนะ ค่าเริ่มต้นตามระดับเสมอ)
          </p>
        </div>

        <form method="get" action="/approvals/setup/limits#editor" className="grid gap-2 sm:flex sm:items-end">
          <div className="sm:w-96">
            <label className="label">ผู้ใช้งาน</label>
            <select name="user" defaultValue={selected?.id ?? ""} className="input" required>
              <option value="">— เลือกผู้ใช้ —</option>
              {users
                .filter((u) => u.is_active || u.id === selected?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({ACCESS_LEVEL_LABEL[u.access_level]})
                    {approvers.has(u.id) ? " ✓ มีอำนาจแล้ว" : ""}
                  </option>
                ))}
            </select>
          </div>
          <button type="submit" className="btn-primary sm:py-2 sm:text-sm">
            ตั้งค่าอำนาจของคนนี้
          </button>
        </form>

        {selected ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {selected.access_level === "admin" && (
              <p className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-sky-700">
                {selected.full_name} เป็นระดับผู้ดูแลระบบ — อนุมัติได้ทุกเรื่องทุกจำนวนอยู่แล้ว
                กฎที่ตั้งตรงนี้จะไม่มีผล
              </p>
            )}
            <UserAuthorityForm
              userName={selected.full_name}
              initial={userAuthorityFrom(selected.id, limits, types)}
              types={types}
              companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            เลือกผู้ใช้ด้านบนก่อน แล้วรายการประเภทเรื่องให้ติ๊กจะแสดงตรงนี้
          </p>
        )}
      </section>

      {/* ---------- รายชื่อผู้มีอำนาจอนุมัติทั้งหมด ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผู้มีอำนาจอนุมัติทั้งหมด ({approvers.size} คน)</h2>

        {approvers.size === 0 && (
          <p className="text-sm text-slate-500">
            ยังไม่ได้ตั้งผู้มีอำนาจอนุมัติเป็นรายคน — ตอนนี้ใช้ค่าเริ่มต้นตามระดับการทำงานด้านล่าง
          </p>
        )}

        <ul className="space-y-2">
          {[...approvers.entries()].map(([userId, rules]) => {
            const person = userById.get(userId);
            const first = rules[0];
            return (
              <li
                key={userId}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-slate-800">
                    👤 {person?.full_name ?? "ผู้ใช้ที่ถูกลบ"}
                    {person && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {ACCESS_LEVEL_LABEL[person.access_level]}
                      </span>
                    )}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      · {first.company_id ? (companyName.get(first.company_id) ?? "บริษัทที่ถูกลบ") : "ทุกบริษัท"}
                    </span>
                    {first.is_final && <span className="ml-2 badge bg-sky-50 text-sky-700">ตัดสินขั้นสุดท้าย</span>}
                    {!first.can_reject && <span className="ml-2 badge bg-amber-50 text-amber-700">ปฏิเสธไม่ได้</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rules.map((l) => (
                      <span
                        key={l.id}
                        className={`badge ${l.is_active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400 line-through"}`}
                      >
                        {ruleChip(l)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <Link
                    href={`/approvals/setup/limits?user=${userId}#editor`}
                    className="btn-secondary py-1.5 text-xs"
                  >
                    แก้ไข
                  </Link>
                  <form action={revokeUserAuthorityForm} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={userId} />
                    <label className="flex items-center gap-1 text-slate-500">
                      <input type="checkbox" name="confirm" />
                      ยืนยัน
                    </label>
                    <button type="submit" className="text-rose-600 hover:underline">
                      ถอนอำนาจ
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- วงเงินไม่ต้องขออนุมัติ ---------- */}
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">วงเงินไม่ต้องขออนุมัติ</h2>
          <p className="text-sm text-slate-500">
            ยอดที่ไม่เกินตัวเลขนี้ ระบบอนุมัติให้ทันทีตอนยื่น ไม่ต้องรอผู้มีอำนาจ (บันทึกผู้ตัดสินเป็น
            &quot;ระบบอนุมัติอัตโนมัติ&quot;) · ยอดที่มากกว่าเข้ากล่องรออนุมัติตามปกติ · เว้นว่าง = ต้องขออนุมัติทุกใบ
          </p>
        </div>

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {amountTypes.map((t) => (
            <li key={t.id}>
              <form
                action={updateAutoApproveForm}
                className="flex flex-wrap items-center gap-3 px-3 py-2"
              >
                <input type="hidden" name="type_id" value={t.id} />
                <span className="min-w-[12rem] flex-1 text-sm text-slate-800">
                  {t.icon} {t.name}
                  {t.auto_approve_limit !== null && (
                    <span className="ml-2 badge bg-emerald-50 text-emerald-700">
                      ≤ {t.auto_approve_limit.toLocaleString("th-TH")} ไม่ต้องขออนุมัติ
                    </span>
                  )}
                </span>
                <input
                  name="auto_approve_limit"
                  inputMode="decimal"
                  defaultValue={t.auto_approve_limit ?? ""}
                  placeholder="ต้องขออนุมัติทุกใบ"
                  className="input w-40"
                />
                <button type="submit" className="btn-secondary py-1.5 text-xs">
                  บันทึก
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- ค่าเริ่มต้นตามระดับ (ใช้เมื่อยังไม่ได้ตั้งเป็นรายคน) ---------- */}
      <details className="card">
        <summary className="cursor-pointer font-semibold text-slate-800">
          ค่าเริ่มต้นตามระดับการทำงาน ({levelRules.length} กฎ) — ใช้กับคนที่ยังไม่ได้ตั้งเป็นรายคน
        </summary>
        <div className="mt-3 space-y-4">
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <strong>ลำดับการใช้กฎ:</strong> กฎเฉพาะคน (ด้านบน) ชนะ กฎตามระดับ · ในระดับเดียวกัน
            กฎที่ระบุประเภทเรื่อง ชนะ กฎที่ครอบทุกเรื่อง · ระดับผู้ดูแลระบบ (Admin) อนุมัติได้ทุกจำนวนเสมอ
          </p>

          <form action={createLimitForm} className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
            <h3 className="text-sm font-semibold text-slate-700">เพิ่มกฎตามระดับ</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label">ระดับการทำงาน</label>
                <select name="level" defaultValue="supervisor" className="input">
                  {ACCESS_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {ACCESS_LEVEL_LABEL[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ประเภทเรื่อง</label>
                <select name="type_id" defaultValue="" className="input">
                  <option value="">ทุกประเภทเรื่อง</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">บริษัท</label>
                <select name="company_id" defaultValue="" className="input">
                  <option value="">ทุกบริษัท</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">วงเงิน (เว้นว่าง = ไม่จำกัด)</label>
                <input name="max_amount" className="input" inputMode="decimal" placeholder="เช่น 5000" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">หมายเหตุ</label>
                <input name="note" className="input" placeholder="เช่น หัวหน้าสาขา อนุมัติค่าซ่อมย่อย" />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="can_reject" defaultChecked />
                ปฏิเสธเรื่องได้
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_final" />
                ตัดสินขั้นสุดท้ายได้ทุกจำนวน
              </label>
            </div>
            <button type="submit" className="btn-secondary">
              เพิ่มกฎตามระดับ
            </button>
          </form>

          {levelRules.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">
                👥 {l.level ? ACCESS_LEVEL_LABEL[l.level] : "-"}
                {" · "}
                {l.type_id ? (typeById.get(l.type_id)?.name ?? "เรื่องที่ถูกลบ") : "ทุกประเภทเรื่อง"}
                {" · "}
                {l.company_id ? (companyName.get(l.company_id) ?? "บริษัทที่ถูกลบ") : "ทุกบริษัท"}
                {" · "}
                <span className="text-slate-900">{amountText(l.max_amount)}</span>
                {l.is_final && <span className="ml-2 badge bg-sky-50 text-sky-700">ตัดสินขั้นสุดท้าย</span>}
                {!l.is_active && <span className="ml-2 badge bg-slate-100 text-slate-500">ปิดใช้งาน</span>}
              </p>

              <form action={updateLimitForm} className="grid items-end gap-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="target" value="level" />
                <div>
                  <label className="label">ระดับ</label>
                  <select name="level" defaultValue={l.level ?? "supervisor"} className="input">
                    {ACCESS_LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {ACCESS_LEVEL_LABEL[lv]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทเรื่อง</label>
                  <select name="type_id" defaultValue={l.type_id ?? ""} className="input">
                    <option value="">ทุกประเภทเรื่อง</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">บริษัท</label>
                  <select name="company_id" defaultValue={l.company_id ?? ""} className="input">
                    <option value="">ทุกบริษัท</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">วงเงิน (ว่าง = ไม่จำกัด)</label>
                  <input
                    name="max_amount"
                    className="input"
                    inputMode="decimal"
                    defaultValue={l.max_amount ?? ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">หมายเหตุ</label>
                  <input name="note" defaultValue={l.note ?? ""} className="input" />
                </div>
                <div className="flex flex-wrap gap-4 pb-2 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="can_reject" defaultChecked={l.can_reject} />
                    ปฏิเสธได้
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_final" defaultChecked={l.is_final} />
                    ขั้นสุดท้าย
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_active" defaultChecked={l.is_active} />
                    เปิดใช้
                  </label>
                </div>
                <button type="submit" className="btn-secondary">
                  บันทึก
                </button>
              </form>

              <form
                action={deleteLimitForm}
                className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-2"
              >
                <input type="hidden" name="id" value={l.id} />
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="confirm" />
                  ยืนยันลบกฎนี้
                </label>
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบกฎ
                </button>
              </form>
            </div>
          ))}
        </div>
      </details>

      <AuthorityTester
        limits={limits.filter((l) => l.is_active)}
        users={users
          .filter((u) => u.is_active)
          .map((u) => ({ id: u.id, full_name: u.full_name, level: u.access_level }))}
        types={types.filter((t) => t.is_active)}
        companyId={user.company_id ?? null}
      />
    </main>
  );
}

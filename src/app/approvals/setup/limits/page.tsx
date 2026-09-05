import Link from "next/link";
import AuthorityTester from "@/components/approval/AuthorityTester";
import { listLimits, listTypes } from "@/lib/approval-db";
import { listCompanies, listCoreUsers } from "@/lib/core-db";
import { ACCESS_LEVELS, ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { requirePermission } from "@/lib/session";
import { createLimitForm, deleteLimitForm, updateLimitForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovalLimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("APV_LIMITS", "read");
  const params = await searchParams;

  const [limits, types, users, companies] = await Promise.all([
    listLimits(),
    listTypes(),
    listCoreUsers(),
    listCompanies(true),
  ]);

  const userName = new Map(users.map((u) => [u.id, u.full_name]));
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const typeOptions = (
    <>
      <option value="">ทุกประเภทเรื่อง</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.icon} {t.name}
        </option>
      ))}
    </>
  );

  const companyOptions = (
    <>
      <option value="">ทุกบริษัท</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );

  const amountText = (value: number | null) =>
    value === null ? "ไม่จำกัด" : `${value.toLocaleString("th-TH")} บาท`;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าอำนาจอนุมัติ</h1>
        <p className="text-sm text-slate-500">
          กำหนดว่าใครอนุมัติได้ถึงวงเงินเท่าไร · เกินวงเงินจะกดอนุมัติไม่ได้ ทำได้แค่เสนอขึ้นผู้มีอำนาจสูงกว่า ·
          แก้ได้ตลอด มีผลทันทีกับเรื่องที่ยังรออยู่ · ส่วนสิทธิ์ &quot;เข้าหน้าจอไหนได้&quot; ตั้งที่{" "}
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

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong>ลำดับการใช้กฎ:</strong> กฎเจาะจงรายบุคคล ชนะ กฎตามระดับ · ในระดับเดียวกัน
        กฎที่ระบุประเภทเรื่อง ชนะ กฎที่ครอบทุกเรื่อง · ระดับผู้ดูแลระบบ (Admin) อนุมัติได้ทุกจำนวนเสมอ
        ไม่ติดกฎที่ตั้งไว้
      </p>

      {/* ---------- เพิ่มกฎใหม่ ---------- */}
      <form action={createLimitForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มกฎใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">ใช้กับ</label>
            <select name="target" defaultValue="level" className="input">
              <option value="level">ทุกคนในระดับ</option>
              <option value="user">เจาะจงรายบุคคล</option>
            </select>
          </div>
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
          <div className="sm:col-span-2">
            <label className="label">หรือเจาะจงคน (เลือก &quot;เจาะจงรายบุคคล&quot; ด้านซ้ายด้วย)</label>
            <select name="user_id" defaultValue="" className="input">
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({ACCESS_LEVEL_LABEL[u.access_level]})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">ประเภทเรื่อง</label>
            <select name="type_id" defaultValue="" className="input">
              {typeOptions}
            </select>
          </div>
          <div>
            <label className="label">บริษัท</label>
            <select name="company_id" defaultValue="" className="input">
              {companyOptions}
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
        <button type="submit" className="btn-primary">
          เพิ่มกฎ
        </button>
      </form>

      {/* ---------- กฎทั้งหมด ---------- */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-800">กฎทั้งหมด ({limits.length})</h2>

        {limits.length === 0 && (
          <p className="text-sm text-slate-500">ยังไม่มีกฎ — ตอนนี้มีแต่ระดับ Admin ที่อนุมัติได้</p>
        )}

        {limits.map((l) => (
          <div key={l.id} className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">
              {l.user_id
                ? `👤 ${userName.get(l.user_id) ?? "ผู้ใช้ที่ถูกลบ"}`
                : `👥 ${l.level ? ACCESS_LEVEL_LABEL[l.level] : "-"}`}
              {" · "}
              {l.type_id ? (typeName.get(l.type_id) ?? "เรื่องที่ถูกลบ") : "ทุกประเภทเรื่อง"}
              {" · "}
              {l.company_id ? (companyName.get(l.company_id) ?? "บริษัทที่ถูกลบ") : "ทุกบริษัท"}
              {" · "}
              <span className="text-slate-900">{amountText(l.max_amount)}</span>
              {l.is_final && <span className="ml-2 badge bg-sky-50 text-sky-700">ตัดสินขั้นสุดท้าย</span>}
              {!l.is_active && <span className="ml-2 badge bg-slate-100 text-slate-500">ปิดใช้งาน</span>}
            </p>

            <form action={updateLimitForm} className="grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={l.id} />
              <div>
                <label className="label">ใช้กับ</label>
                <select name="target" defaultValue={l.user_id ? "user" : "level"} className="input">
                  <option value="level">ทุกคนในระดับ</option>
                  <option value="user">เจาะจงรายบุคคล</option>
                </select>
              </div>
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
              <div className="sm:col-span-2">
                <label className="label">บุคคล</label>
                <select name="user_id" defaultValue={l.user_id ?? ""} className="input">
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label">ประเภทเรื่อง</label>
                <select name="type_id" defaultValue={l.type_id ?? ""} className="input">
                  {typeOptions}
                </select>
              </div>
              <div>
                <label className="label">บริษัท</label>
                <select name="company_id" defaultValue={l.company_id ?? ""} className="input">
                  {companyOptions}
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
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="can_reject" defaultChecked={l.can_reject} />
                ปฏิเสธได้
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_final" defaultChecked={l.is_final} />
                ตัดสินขั้นสุดท้าย
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked={l.is_active} />
                เปิดใช้งาน
              </label>
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
      </section>

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

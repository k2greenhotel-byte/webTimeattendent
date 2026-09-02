import { listLoginAccounts, listMaster, type MktMasterKind } from "@/lib/marketing-db";
import type { MktOption } from "@/lib/marketing-types";
import { createMasterForm, deleteMasterForm, updateMasterForm } from "./actions";

export const dynamic = "force-dynamic";

const SECTIONS: {
  kind: MktMasterKind;
  title: string;
  codeLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
}[] = [
  {
    kind: "staff",
    title: "4.1 พนักงาน",
    codeLabel: "ID พนักงาน",
    codePlaceholder: "MK001",
    namePlaceholder: "สมชาย ใจดี",
  },
  {
    kind: "company",
    title: "4.2 บริษัทที่ขอเบิก",
    codeLabel: "ID บริษัท",
    codePlaceholder: "CO001",
    namePlaceholder: "โตโยต้า มอเตอร์ ประเทศไทย",
  },
  {
    kind: "activityType",
    title: "4.3 ประเภทกิจกรรม",
    codeLabel: "ID ประเภท",
    codePlaceholder: "AT10",
    namePlaceholder: "ออกบูธแสดงรถ",
  },
];

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const [staff, companies, types, accounts] = await Promise.all([
    listMaster("staff", { includeInactive: true }),
    listMaster("company", { includeInactive: true }),
    listMaster("activityType", { includeInactive: true }),
    listLoginAccounts(),
  ]);

  const data: Record<MktMasterKind, MktOption[]> = {
    staff,
    company: companies,
    activityType: types,
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">4. บันทึกค่าเริ่มต้น</h1>
        <p className="text-sm text-slate-500">
          ข้อมูลหลักที่ใช้เป็นตัวเลือกในหน้าจอบันทึก — ปิด “ใช้งาน” เพื่อซ่อนจาก dropdown โดยไม่ลบของเก่า
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {SECTIONS.map((section) => (
        <section key={section.kind} className="card space-y-3">
          <h2 className="font-semibold text-slate-800">
            {section.title}{" "}
            <span className="text-sm font-normal text-slate-400">
              ({data[section.kind].length} รายการ)
            </span>
          </h2>

          {section.kind === "staff" && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              ผูก “บัญชีเข้าระบบ” ไว้ เพื่อให้หน้าบันทึกเลือกชื่อผู้บันทึกให้อัตโนมัติเมื่อคนนั้นล็อกอินเข้ามา
              — บัญชีมาจากรายชื่อพนักงานในระบบลงเวลา (เข้าด้วยเบอร์มือถือ + รหัสผ่าน)
            </p>
          )}

          <form
            action={createMasterForm}
            className={`grid gap-3 ${
              section.kind === "staff"
                ? "sm:grid-cols-[9rem_1fr_14rem_auto]"
                : "sm:grid-cols-[10rem_1fr_auto]"
            }`}
          >
            <input type="hidden" name="kind" value={section.kind} />
            <div>
              <label className="label">{section.codeLabel} *</label>
              <input name="code" className="input" placeholder={section.codePlaceholder} required />
            </div>
            <div>
              <label className="label">ชื่อ *</label>
              <input name="name" className="input" placeholder={section.namePlaceholder} required />
            </div>
            {section.kind === "staff" && (
              <div>
                <label className="label">บัญชีเข้าระบบ</label>
                <select name="employee_id" defaultValue="" className="input">
                  <option value="">— ยังไม่ผูก —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emp_code} · {a.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่ม
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="w-40">ID</th>
                  <th>ชื่อ</th>
                  <th className="w-24">ใช้งาน</th>
                  <th className="w-56">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data[section.kind].length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  data[section.kind].map((row) => (
                    <tr key={row.id}>
                      <td colSpan={4} className="!p-0">
                        <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                          <form
                            action={updateMasterForm}
                            className="flex flex-1 flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="kind" value={section.kind} />
                            <input type="hidden" name="id" value={row.id} />
                            <input
                              name="code"
                              defaultValue={row.code}
                              className="input w-32"
                              required
                            />
                            <input
                              name="name"
                              defaultValue={row.name}
                              className="input min-w-48 flex-1"
                              required
                            />
                            {section.kind === "staff" && (
                              <select
                                name="employee_id"
                                defaultValue={row.employee_id ?? ""}
                                className="input w-56"
                                title="บัญชีเข้าระบบที่ผูกกับพนักงานคนนี้"
                              >
                                <option value="">— ยังไม่ผูกบัญชี —</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.emp_code} · {a.full_name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <label className="flex items-center gap-1 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                name="is_active"
                                defaultChecked={row.is_active}
                                className="h-4 w-4"
                              />
                              ใช้งาน
                            </label>
                            <button type="submit" className="btn-secondary">
                              บันทึก
                            </button>
                          </form>

                          <form action={deleteMasterForm} className="flex items-center gap-1">
                            <input type="hidden" name="kind" value={section.kind} />
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="name" value={row.name} />
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              <input type="checkbox" name="confirm" className="h-4 w-4" />
                              ยืนยัน
                            </label>
                            <button type="submit" className="btn-danger">
                              ลบ
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}

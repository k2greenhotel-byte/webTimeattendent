import Link from "next/link";
import { deleteMappingForm, saveMappingForm } from "@/app/salework/mapping/actions";
import { loadDb2Salesmen, sortSalesmen } from "@/app/salework/mapping/salesmen";
import { suggestMappings } from "@/lib/salework";
import { listMapRows } from "@/lib/salework-db";
import type { Db2Salesman } from "@/lib/salework-types";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const PATH = "/salework/mapping";

/** เก็บพารามิเตอร์ที่เปิดอยู่ไว้เวลาสลับมุมมอง จะได้ไม่หลุดตัวกรองเดิม */
function withParams(base: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

/**
 * หน้าจอ 5 — จับคู่บัญชีผู้ใช้ในเว็บ (ที่ใช้ทั้งระบบบันทึกงานและระบบรับจอง)
 * กับพนักงานขายในระบบขาย (Db2)
 *
 * รายชื่อฝั่งระบบขายมาจาก **ทะเบียนพนักงาน `ASVSHPV.OFFICER` เฉพาะคนที่ยังทำงานอยู่**
 * (`STATUS = 'Y'` 88 คน จากทั้งตาราง 302 แถว) ซึ่งรหัส `CODE` เป็นตัวเดียวกับ `SALCOD` ในรายการขาย
 *
 * ทะเบียนนี้รวมพนักงานทุกแผนก (และมีรายการที่ไม่ใช่คน เช่น ชื่อบริษัท) จึงแสดง
 * "จำนวนคันที่ขายได้ 365 วัน" กำกับไว้เสมอ ให้แอดมินแยกออกว่ารหัสไหนคือพนักงานขายตัวจริง
 *
 * ข้อยกเว้นเดียวที่ดึงคนที่ออกแล้วมาด้วยคือ "รหัสที่จับคู่ไว้อยู่ก่อนแล้ว" — ดึงมาเพื่อแสดงชื่อ
 * บนแถวของตัวเองเท่านั้น (ติดป้าย "ออกแล้ว") จะไม่ถูกเสนอเป็นตัวเลือกใหม่ให้บัญชีอื่น
 */
export default async function SaleWorkMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string; q?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  await requirePermission("SW_MAP", "read");

  const showAllUsers = params.all === "1";

  const [rows, canWrite, canDelete] = await Promise.all([
    listMapRows(!showAllUsers),
    checkPermission("SW_MAP", "write"),
    checkPermission("SW_MAP", "delete"),
  ]);

  // ต้องรู้ก่อนว่ามีคู่ไหนผูกไว้แล้ว จึงดึงชื่อของคนที่ลาออกไปแล้วมาแสดงได้ครบ
  const db2 = await loadDb2Salesmen({
    mappedCodes: rows.map((r) => r.db2_salcod).filter(Boolean) as string[],
  });

  const salesmen = sortSalesmen(db2.salesmen);

  const keyword = (params.q ?? "").trim().toLowerCase();
  const visible = keyword
    ? rows.filter((r) =>
        [r.emp_code, r.full_name, r.db2_salcod, r.db2_name].join(" ").toLowerCase().includes(keyword),
      )
    : rows;

  const suggestions = suggestMappings(rows, salesmen);
  const usedSalcod = new Set(rows.map((r) => r.db2_salcod).filter(Boolean) as string[]);
  const mappedCount = rows.filter((r) => r.db2_salcod).length;
  const sellers = salesmen.filter((s) => s.units > 0);

  const labelOf = (s: Db2Salesman) =>
    [
      s.salcod,
      s.name ? `— ${s.name}` : "— (ระบบขายไม่มีชื่อ)",
      s.branch ? `· ${s.branch}` : "",
      s.units > 0 ? `· ขาย ${s.units} คัน` : "· ไม่มียอดขายในรอบปี",
      s.active === false ? "· ออกแล้ว" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">5. จับคู่พนักงานขายกับระบบขาย (Db2)</h1>
        <p className="text-sm text-slate-500">
          จับคู่บัญชีผู้ใช้ในเว็บ (ใช้ทั้งระบบบันทึกงานประจำวันและระบบรับจอง) กับพนักงานขายในทะเบียน
          พนักงานของระบบขาย (เฉพาะคนที่ยังทำงานอยู่) เพื่อให้ dashboard เทียบงานประจำวันกับยอดขายจริงได้
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}
      {db2.error && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {db2.error}
          {db2.source === "none" && " — ยังจับคู่ได้โดยพิมพ์รหัสเองในช่อง “พิมพ์รหัสเอง”"}
        </p>
      )}

      <div className="card flex flex-wrap items-end gap-3">
        <form method="get" className="flex grow flex-wrap items-end gap-2">
          {showAllUsers && <input type="hidden" name="all" value="1" />}
          <div className="grow">
            <label className="label" htmlFor="q">
              ค้นชื่อ / รหัสพนักงาน
            </label>
            <input id="q" name="q" defaultValue={params.q ?? ""} className="input w-full sm:w-64" />
          </div>
          <button type="submit" className="btn-secondary">
            ค้นหา
          </button>
        </form>

        <Link
          href={withParams({ q: params.q, all: showAllUsers ? undefined : "1" })}
          className="btn-secondary"
        >
          {showAllUsers ? "แสดงเฉพาะผู้ใช้โปรแกรมนี้" : "แสดงผู้ใช้ทุกคน"}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">บัญชีที่แสดง</p>
          <p className="text-lg font-semibold text-slate-800">{visible.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">จับคู่แล้ว</p>
          <p className="text-lg font-semibold text-emerald-700">{mappedCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">
            {db2.source === "officer" ? "พนักงานที่ยังทำงานอยู่" : "รหัสในระบบขาย"}
          </p>
          <p className="text-lg font-semibold text-slate-800">{salesmen.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">มียอดขายจริงในรอบปี</p>
          <p className="text-lg font-semibold text-slate-800">{sellers.length}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card text-sm text-slate-600">ไม่พบบัญชีผู้ใช้ตามเงื่อนไขที่เลือก</p>
      ) : (
        <div className="space-y-2">
          {visible.map((row) => {
            const guess = suggestions.get(row.employee_id);
            // เลือกได้เฉพาะรหัสที่ยังว่าง บวกรหัสที่แถวนี้จับคู่ไว้อยู่แล้ว
            const options = salesmen.filter(
              (s) => !usedSalcod.has(s.salcod) || s.salcod === row.db2_salcod,
            );
            const current = salesmen.find((s) => s.salcod === row.db2_salcod);

            return (
              <form
                key={row.employee_id}
                action={saveMappingForm}
                className="card grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
              >
                <input type="hidden" name="employee_id" value={row.employee_id} />
                <input type="hidden" name="employee_name" value={row.full_name} />

                <div>
                  <p className="font-medium text-slate-800">
                    {row.full_name}
                    {!row.is_active && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        ปิดบัญชี
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.emp_code}
                    {row.branch_name ? ` · สาขา ${row.branch_name}` : ""}
                  </p>
                  {row.db2_salcod ? (
                    <p className="mt-1 text-sm text-emerald-700">
                      จับคู่แล้ว: {row.db2_salcod}
                      {row.db2_name ? ` — ${row.db2_name}` : ""}
                      {current && current.units > 0 ? ` · ขาย ${current.units} คัน/ปี` : ""}
                    </p>
                  ) : guess ? (
                    <p className="mt-1 text-sm text-amber-700">
                      ระบบเดาให้ว่าน่าจะเป็น {guess.salcod}
                      {guess.name ? ` — ${guess.name}` : ""} (ชื่อตรงกัน) — ตรวจแล้วกดบันทึก
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">ยังไม่ได้จับคู่</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="label" htmlFor={`sel_${row.employee_id}`}>
                      พนักงานขายในระบบขาย
                    </label>
                    <select
                      id={`sel_${row.employee_id}`}
                      name="salcod_select"
                      defaultValue={row.db2_salcod ?? guess?.salcod ?? ""}
                      disabled={!canWrite}
                      className="input w-full"
                    >
                      <option value="">— ยังไม่เลือก —</option>
                      {options.map((s) => (
                        <option key={s.salcod} value={s.salcod}>
                          {labelOf(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      name="salcod_text"
                      placeholder="พิมพ์รหัสเอง (ถ้าไม่มีในรายการ)"
                      disabled={!canWrite}
                      className="input w-full"
                    />
                    <input
                      name="note"
                      defaultValue={row.note ?? ""}
                      placeholder="หมายเหตุ"
                      disabled={!canWrite}
                      className="input w-full"
                    />
                  </div>

                  {/* ชื่อสำรอง เผื่อ action ถามระบบขายไม่ได้ตอนบันทึก */}
                  <input
                    type="hidden"
                    name="db2_name"
                    value={current?.name ?? guess?.name ?? row.db2_name ?? ""}
                  />
                </div>

                <div className="flex items-end gap-2">
                  {canWrite && (
                    <button type="submit" className="btn-primary">
                      บันทึกคู่
                    </button>
                  )}
                </div>

                {row.db2_salcod && canDelete && (
                  <div className="lg:col-span-3">
                    <button
                      type="submit"
                      formAction={deleteMappingForm}
                      className="text-sm text-rose-600 underline"
                    >
                      ยกเลิกการจับคู่ของบัญชีนี้
                    </button>
                  </div>
                )}
              </form>
            );
          })}
        </div>
      )}
    </main>
  );
}

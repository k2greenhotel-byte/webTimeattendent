import Link from "next/link";
import { notFound } from "next/navigation";
import CheckCard from "@/components/audit/CheckCard";
import {
  addManualCheckForm,
  deleteAuditForm,
  deleteCheckForm,
  pullPaymentsForm,
  pullSalesForm,
  saveCheckForm,
  setAuditStatusForm,
  updateAuditForm,
} from "@/app/audit/actions";
import { formatBaht, isAuditEditable, summarizeChecks } from "@/lib/audit";
import { listChecks, findCheckedRefs, getAudit, listCheckTypes, listDocTypes } from "@/lib/audit-db";
import {
  AUD_STATUS_CLASS,
  AUD_STATUS_LABEL,
  type AudCheckType,
} from "@/lib/audit-types";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate } from "@/lib/datetime";
import { db2Sales, type Db2Sale } from "@/lib/db2-api";
import { listBranches } from "@/lib/db";
import { listPayments } from "@/lib/procurement-db";
import type { PaymentRow } from "@/lib/procurement-types";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = { id: string };
type Search = {
  msg?: string;
  err?: string;
  /** id ของรายการตรวจที่กำลังเปิดแผงดึงข้อมูล */
  pull?: string;
  from?: string;
  to?: string;
  locat?: string;
  branch_id?: string;
  source?: string;
};

/** หน้าจอ 1 — ใบคุมงานหนึ่งใบ: หัวใบ + ดึงรายการที่ต้องตรวจ + ลงผลตรวจรายรายการ */
export default async function AuditDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  await requirePermission("AUD_ENTRY", "read");
  const { id } = await params;
  const sp = await searchParams;

  const audit = await getAudit(id);
  if (!audit) notFound();

  const [checks, types, docTypes, companies, branches, canEdit, canWrite, canDelete] =
    await Promise.all([
      listChecks(id),
      listCheckTypes(),
      listDocTypes(),
      listCompanies(true),
      listBranches(true),
      checkPermission("AUD_ENTRY", "edit"),
      checkPermission("AUD_ENTRY", "write"),
      checkPermission("AUD_ENTRY", "delete"),
    ]);

  const editable = isAuditEditable(audit.status) && canEdit;
  const summary = summarizeChecks(checks);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const pullType = sp.pull ? (typeById.get(sp.pull) ?? null) : null;

  const from = sp.from || audit.audit_date;
  const to = sp.to || audit.audit_date;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            ใบคุมงาน {audit.doc_no}{" "}
            <span className={`badge align-middle ${AUD_STATUS_CLASS[audit.status]}`}>
              {AUD_STATUS_LABEL[audit.status]}
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            วันที่ทำงาน {formatThaiDate(audit.audit_date)} · ผู้ตรวจสอบ {audit.auditor_name}
          </p>
        </div>
        <Link href="/audit/audits" className="btn-secondary">
          ← กลับรายการใบคุมงาน
        </Link>
      </div>

      {sp.msg && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sp.msg}</p>}
      {sp.err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{sp.err}</p>}

      {/* ---------- สรุปยอดของใบนี้ ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="รายการที่ตรวจ" value={String(summary.count)} sub={`ยังไม่ลงผล ${summary.pending}`} />
        <Stat label="ถูกต้อง" value={String(summary.correct)} tone="text-emerald-600" />
        <Stat label="ไม่ถูกต้อง" value={String(summary.wrong)} tone="text-rose-600" />
        <Stat label="เอกสารไม่ครบ" value={String(summary.docIncomplete)} tone="text-amber-600" />
        <Stat label="ติดต่อไม่ได้" value={String(summary.noContact)} tone="text-slate-600" />
        <Stat
          label="ข้อมูลไม่ตรง"
          value={String(summary.abnormal + summary.branchError)}
          sub={`ผิดปกติ ${summary.abnormal} · สาขาสื่อสารผิด ${summary.branchError}`}
          tone="text-rose-600"
        />
      </div>

      {/* ---------- หัวใบคุมงาน ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">หัวใบคุมงาน</h2>
        <form action={updateAuditForm} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input type="hidden" name="id" value={audit.id} />
          <div>
            <label className="label">เลขที่คุมงาน</label>
            <input value={audit.doc_no} className="input bg-slate-50" readOnly />
          </div>
          <div>
            <label className="label">วันที่ทำงาน *</label>
            <input
              name="audit_date"
              type="date"
              defaultValue={audit.audit_date}
              className="input"
              required
              disabled={!editable}
            />
          </div>
          <div>
            <label className="label">บริษัท</label>
            <select name="company_id" defaultValue={audit.company_id ?? ""} className="input" disabled={!editable}>
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
            <select name="branch_id" defaultValue={audit.branch_id ?? ""} className="input" disabled={!editable}>
              <option value="">— ทุกสาขา —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">หมายเหตุของใบคุมงาน</label>
            <input name="note" defaultValue={audit.note ?? ""} className="input" maxLength={500} disabled={!editable} />
          </div>
          <div className="flex items-end">
            {editable && (
              <button type="submit" className="btn-primary w-full">
                บันทึกหัวใบ
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {audit.status === "draft" && canEdit && (
            <>
              <form action={setAuditStatusForm}>
                <input type="hidden" name="id" value={audit.id} />
                <input type="hidden" name="status" value="submitted" />
                <button type="submit" className="btn-primary">
                  ส่งผลการตรวจ
                </button>
              </form>
              <form action={setAuditStatusForm}>
                <input type="hidden" name="id" value={audit.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button type="submit" className="btn-secondary">
                  ยกเลิกใบนี้
                </button>
              </form>
            </>
          )}
          {audit.status !== "draft" && canEdit && (
            <form action={setAuditStatusForm}>
              <input type="hidden" name="id" value={audit.id} />
              <input type="hidden" name="status" value="draft" />
              <button type="submit" className="btn-secondary">
                เปิดกลับมาแก้ไข
              </button>
            </form>
          )}
          {canDelete && (
            <form action={deleteAuditForm} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="id" value={audit.id} />
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" name="confirm" className="h-4 w-4" />
                ยืนยันลบทั้งใบ ({audit.check_count} รายการ)
              </label>
              <button type="submit" className="btn-danger">
                ลบใบคุมงาน
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ---------- เพิ่มรายการที่ต้องตรวจ ---------- */}
      {editable && canWrite && (
        <section className="card space-y-3">
          <div>
            <h2 className="font-semibold text-slate-800">เพิ่มรายการที่ต้องตรวจ</h2>
            <p className="text-sm text-slate-500">
              เลือกรายการตรวจที่ต้องการ — รายการที่ดึงจากระบบอื่นจะข้ามเอกสารที่เคยตรวจไปแล้วให้เอง
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <Link
                key={t.id}
                href={`/audit/audits/${id}?pull=${t.id}&from=${from}&to=${to}`}
                className={sp.pull === t.id ? "btn-primary" : "btn-secondary"}
              >
                {t.name}
              </Link>
            ))}
            {types.length === 0 && (
              <p className="text-sm text-rose-600">
                ยังไม่มีรายการตรวจในระบบ — ไปตั้งค่าที่เมนู “5. ตั้งค่ารายการตรวจสอบ” ก่อน
              </p>
            )}
          </div>

          {pullType?.kind === "sale" && (
            <SalePullPanel auditId={id} type={pullType} from={from} to={to} locat={sp.locat ?? ""} />
          )}
          {pullType?.kind === "payment" && (
            <PaymentPullPanel
              auditId={id}
              type={pullType}
              from={from}
              to={to}
              branchId={sp.branch_id ?? ""}
              source={sp.source ?? "petty"}
              branches={branches}
            />
          )}
          {pullType && (pullType.kind === "cash" || pullType.kind === "custom") && (
            <ManualCheckForm auditId={id} type={pullType} defaultDate={audit.audit_date} />
          )}
        </section>
      )}

      {/* ---------- รายการที่ตรวจ ---------- */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">
          รายการที่ตรวจในใบนี้ ({checks.length} รายการ)
        </h2>

        {checks.length === 0 ? (
          <p className="card text-sm text-slate-500">
            ยังไม่มีรายการที่ต้องตรวจ — กดเลือกรายการตรวจด้านบนเพื่อดึงเอกสารเข้ามาตรวจ
          </p>
        ) : (
          checks.map((c) => (
            <CheckCard
              key={c.id}
              check={c}
              type={c.type_id ? (typeById.get(c.type_id) ?? null) : null}
              docTypes={docTypes}
              saveAction={saveCheckForm}
              deleteAction={deleteCheckForm}
              editable={editable}
              canDelete={canDelete}
            />
          ))
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-slate-800",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* แผงดึงใบสั่งขายจากระบบขาย (Db2)                                              */
/* -------------------------------------------------------------------------- */

async function SalePullPanel({
  auditId,
  type,
  from,
  to,
  locat,
}: {
  auditId: string;
  type: AudCheckType;
  from: string;
  to: string;
  locat: string;
}) {
  let sales: Db2Sale[] = [];
  let error: string | null = null;
  let branches: string[] = [];

  try {
    const result = await db2Sales({ from, to, locat: locat || undefined, limit: 500 });
    sales = result.sales;
    branches = result.branches;
  } catch (err) {
    error = err instanceof Error ? err.message : "ต่อระบบขาย (Db2) ไม่ได้";
  }

  const checked = await findCheckedRefs("sale", sales.map((s) => s.contno));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <input type="hidden" name="pull" value={type.id} />
        <div>
          <label className="label">ขายตั้งแต่วันที่</label>
          <input name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input name="to" type="date" defaultValue={to} className="input" />
        </div>
        <div>
          <label className="label">สาขาที่ขาย (รหัสในระบบขาย)</label>
          <input name="locat" defaultValue={locat} className="input" list="db2-branches" placeholder="ทุกสาขา" />
          <datalist id="db2-branches">
            {branches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" className="btn-secondary w-full sm:w-auto">
            ดึงรายการขาย
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          ดึงข้อมูลจากระบบขายไม่สำเร็จ: {error}
          <span className="mt-1 block text-xs">
            ถ้าขึ้นว่าไม่พบ endpoint /api/sales แปลว่าแอปข้อมูลระบบขาย (Db2) ที่เครื่องบริษัท
            ยังไม่ได้อัปเดตเป็นเวอร์ชันที่มีเอนด์พอยต์นี้ — ต้อง build แอป Db2 ใหม่ก่อนหนึ่งครั้ง
          </span>
        </p>
      )}

      {!error && sales.length === 0 && (
        <p className="text-sm text-slate-500">ไม่พบรายการขายในช่วงวันที่นี้</p>
      )}

      {sales.length > 0 && (
        <form action={pullSalesForm} className="space-y-2">
          <input type="hidden" name="audit_id" value={auditId} />
          <input type="hidden" name="type_id" value={type.id} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="locat" value={locat} />

          <div className="max-h-96 overflow-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>เลขที่สัญญาขาย</th>
                  <th className="w-28">วันที่ขาย</th>
                  <th>ชื่อลูกค้า</th>
                  <th className="w-24">สาขา</th>
                  <th>พนักงานขาย</th>
                  <th>ยี่ห้อ / รุ่นรถ</th>
                  <th>บริษัทไฟแนนซ์</th>
                  <th className="w-28 text-right">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const already = checked.get(s.contno);
                  return (
                    <tr key={`${s.locat}-${s.contno}`} className={already ? "bg-slate-100 text-slate-400" : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          name="ref"
                          value={s.contno}
                          disabled={Boolean(already)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="text-left font-medium">
                        {s.contno}
                        {already && <span className="block text-xs">ตรวจแล้วในใบ {already}</span>}
                      </td>
                      <td>{s.saleDate ? formatThaiDate(s.saleDate) : "—"}</td>
                      <td className="text-left">{s.customer || "—"}</td>
                      <td>{s.locat}</td>
                      <td className="text-left">{s.salesman || s.salcod || "—"}</td>
                      <td className="text-left">{[s.brand, s.modelName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="text-left">{s.finance || (s.channel === "F" ? s.fincod : "—")}</td>
                      <td className="text-right tabular-nums">{formatBaht(s.gross ?? s.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="submit" className="btn-primary">
            เพิ่มใบสั่งขายที่เลือกเข้าใบคุมงาน
          </button>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* แผงดึงใบเบิกเงินสดย่อยจากระบบขอซ่อมขอซื้อ                                     */
/* -------------------------------------------------------------------------- */

async function PaymentPullPanel({
  auditId,
  type,
  from,
  to,
  branchId,
  source,
  branches,
}: {
  auditId: string;
  type: AudCheckType;
  from: string;
  to: string;
  branchId: string;
  source: string;
  branches: { id: string; name: string }[];
}) {
  const paySource = source === "central" ? "central" : "petty";
  const payments: PaymentRow[] = await listPayments({
    from,
    to,
    branch_id: branchId || null,
    pay_source: paySource,
    limit: 300,
  });
  const checked = await findCheckedRefs("payment", payments.map((p) => p.doc_no));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <input type="hidden" name="pull" value={type.id} />
        <div>
          <label className="label">จ่ายตั้งแต่วันที่</label>
          <input name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input name="to" type="date" defaultValue={to} className="input" />
        </div>
        <div>
          <label className="label">สาขาที่จ่าย</label>
          <select name="branch_id" defaultValue={branchId} className="input">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">แหล่งจ่าย</label>
          <select name="source" defaultValue={paySource} className="input">
            <option value="petty">เงินสดย่อย</option>
            <option value="central">ส่วนกลาง</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-secondary w-full">
            ดึงใบเบิก
          </button>
        </div>
      </form>

      {payments.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่พบใบเบิกในช่วงวันที่นี้</p>
      ) : (
        <form action={pullPaymentsForm} className="space-y-2">
          <input type="hidden" name="audit_id" value={auditId} />
          <input type="hidden" name="type_id" value={type.id} />

          <div className="max-h-96 overflow-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>เลขที่ใบเบิก</th>
                  <th className="w-28">วันที่จ่าย</th>
                  <th>ผู้จัดทำ</th>
                  <th>ผู้รับเงิน</th>
                  <th>รายการค่าใช้จ่าย</th>
                  <th>ประเภทการจ่าย</th>
                  <th className="w-28 text-right">จำนวนเงิน</th>
                  <th>ผลการอนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const already = checked.get(p.doc_no);
                  return (
                    <tr key={p.id} className={already ? "bg-slate-100 text-slate-400" : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          name="payment_id"
                          value={p.id}
                          disabled={Boolean(already)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="text-left font-medium">
                        {p.doc_no}
                        {already && <span className="block text-xs">ตรวจแล้วในใบ {already}</span>}
                      </td>
                      <td>{formatThaiDate(p.pay_date)}</td>
                      <td className="text-left">{p.created_by_name ?? p.created_by_full_name ?? "—"}</td>
                      <td className="text-left">{p.payee_name ?? "—"}</td>
                      <td className="text-left">{p.expense_detail ?? "—"}</td>
                      <td className="text-left">{p.account_name ?? "—"}</td>
                      <td className="text-right tabular-nums">{formatBaht(p.paid_amount)}</td>
                      <td className="text-left">
                        {p.ref_no ? `อนุมัติ ${p.ref_no}` : "—"}
                        {p.approver_name && <span className="block text-xs">{p.approver_name}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="submit" className="btn-primary">
            เพิ่มใบเบิกที่เลือกเข้าใบคุมงาน
          </button>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ฟอร์มเพิ่มรายการที่กรอกเอง (กระทบยอดเงินสด และรายการที่ตั้งขึ้นเอง)              */
/* -------------------------------------------------------------------------- */

function ManualCheckForm({
  auditId,
  type,
  defaultDate,
}: {
  auditId: string;
  type: AudCheckType;
  defaultDate: string;
}) {
  return (
    <form action={addManualCheckForm} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
      <input type="hidden" name="audit_id" value={auditId} />
      <input type="hidden" name="type_id" value={type.id} />

      <div>
        <label className="label">{type.ref_label}</label>
        <input name="ref_no" className="input" maxLength={60} />
      </div>
      <div>
        <label className="label">วันที่ของเรื่องที่ตรวจ</label>
        <input name="ref_date" type="date" defaultValue={defaultDate} className="input" />
      </div>
      <div>
        <label className="label">{type.title_label} *</label>
        <input name="title" className="input" maxLength={200} required />
      </div>
      <div>
        <label className="label">{type.party_label}</label>
        <input name="party" className="input" maxLength={120} />
      </div>
      <div>
        <label className="label">สาขา</label>
        <input name="branch_label" className="input" maxLength={60} />
      </div>
      {type.has_amount && (
        <div>
          <label className="label">จำนวนเงิน (บาท)</label>
          <input name="amount" className="input" inputMode="decimal" />
        </div>
      )}
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">
          เพิ่มรายการ
        </button>
      </div>
    </form>
  );
}

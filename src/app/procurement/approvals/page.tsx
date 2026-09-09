import Link from "next/link";
import ApproverGate from "@/components/procurement/ApproverGate";
import DocTable from "@/components/procurement/DocTable";
import { workDateOf } from "@/lib/datetime";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { formatBaht } from "@/lib/procurement";
import { listDocs } from "@/lib/procurement-db";
import {
  APPROVE_STATUS_LABEL,
  APPROVE_STATUS_ORDER,
  DOC_KIND_LABEL,
  DOC_KIND_ORDER,
  type ApproveStatus,
  type DocKind,
  type PrDocRow,
} from "@/lib/procurement-types";
import { isApproverAuthed, requirePermission } from "@/lib/session";
import { approverLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

/** เส้นทางหน้ารายละเอียดของหน้าอนุมัติ — คนละหน้ากับหน้าแก้ไขเอกสาร (ข้อ 3.1) */
function approveHref(row: Pick<PrDocRow, "kind" | "id">) {
  return `/procurement/approvals/${row.kind}/${row.id}`;
}

/**
 * ปุ่มท้ายแถวบอกตามสถานะจริงของแต่ละใบ
 * ใบที่ยังไม่ตัดสิน = "พิจารณา" · ใบที่ตัดสินแล้ว = "แก้ไข" (เข้าไปเปลี่ยนใจได้)
 */
function actionLabelOf(row: PrDocRow): string {
  return row.approve_status === "approved" || row.approve_status === "rejected"
    ? "แก้ไข"
    : "พิจารณา";
}

type Params = Record<string, string | undefined>;

/** ตัวกรองสถานะที่หน้านี้ให้เลือก — "ทั้งหมด" คือไม่กรอง */
const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  ...APPROVE_STATUS_ORDER.map((s) => ({ value: s, label: APPROVE_STATUS_LABEL[s] })),
];

/** ลิงก์แท็บสถานะ โดยคงเงื่อนไขอื่นที่กรองไว้อยู่ */
function tabHref(params: Params, status: string): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "status" && key !== "msg" && key !== "err") next.set(key, value);
  }
  if (status) next.set("status", status);
  const qs = next.toString();
  return `/procurement/approvals${qs ? `?${qs}` : ""}`;
}

/**
 * หน้าจอ 3.1 — ต้องยืนยันรหัสผ่านก่อน จึงจะเห็นรายการ
 *
 * สอบถามได้ตามสถานะอนุมัติ (รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติ / ให้หาราคาใหม่ / ทั้งหมด)
 * เอกสารที่ตัดสินไปแล้วก็เปิดเข้าไปแก้ผลได้ ปุ่มท้ายแถวจะขึ้นว่า "แก้ไข"
 */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requirePermission("PR_APPROVE", "write");
  const authed = await isApproverAuthed();
  const params = await searchParams;

  if (!authed) return <ApproverGate fullName={user.full_name} />;

  const status = (APPROVE_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as ApproveStatus)
    : null;
  const kind = (DOC_KIND_ORDER as string[]).includes(params.kind ?? "")
    ? (params.kind as DocKind)
    : null;

  const [rows, companies, branches] = await Promise.all([
    listDocs({
      approve_status: status,
      kind,
      company_id: params.company_id || null,
      branch_id: params.branch_id || null,
      from: params.from || null,
      to: params.to || null,
      keyword: params.q?.trim() || undefined,
    }),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const waiting = rows.filter((r) => r.approve_status === "pending" || r.approve_status === "recheck");
  const totalApproved = rows
    .filter((r) => r.approve_status === "approved")
    .reduce((sum, r) => sum + r.approved_amount, 0);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3.1 อนุมัติซ่อม/จัดซื้อ</h1>
          <p className="text-sm text-slate-500">
            {user.full_name} · {status ? APPROVE_STATUS_LABEL[status] : "ทุกสถานะ"} · พบ {rows.length} ใบ
            {waiting.length > 0 ? ` · รอพิจารณา ${waiting.length} ใบ` : ""}
          </p>
        </div>
        <form action={approverLogoutAction}>
          <button type="submit" className="btn-secondary text-rose-600">
            ออกจากโหมดอนุมัติ
          </button>
        </form>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- แท็บสถานะอนุมัติ ---------- */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {STATUS_TABS.map((tab) => {
          const active = (status ?? "") === tab.value;
          return (
            <Link
              key={tab.value || "all"}
              href={tabHref(params, tab.value)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
                active
                  ? "bg-brand-500 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ---------- เงื่อนไขค้นหาเพิ่มเติม ---------- */}
      <form method="get" className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {status && <input type="hidden" name="status" value={status} />}

        <div className="sm:col-span-2">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            className="input"
            placeholder="เลขที่เอกสาร รายการ สาขา ผู้บันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="kind">
            ชนิดเอกสาร
          </label>
          <select id="kind" name="kind" defaultValue={params.kind ?? ""} className="input">
            <option value="">ทั้งซ่อมและซื้อ</option>
            {DOC_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {DOC_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="company_id">
            บริษัท
          </label>
          <select
            id="company_id"
            name="company_id"
            defaultValue={params.company_id ?? ""}
            className="input"
          >
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขา
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={params.branch_id ?? ""}
            className="input"
          >
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            ค้นหา
          </button>
          <Link
            href={status ? `/procurement/approvals?status=${status}` : "/procurement/approvals"}
            className="btn-secondary w-full sm:w-auto"
          >
            ล้างเงื่อนไข
          </Link>
        </div>
      </form>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-semibold text-slate-800">
            {status ? APPROVE_STATUS_LABEL[status] : "เอกสารทั้งหมด"} ({rows.length} ใบ)
          </h2>
          {totalApproved > 0 && (
            <p className="text-sm text-slate-500">
              ยอดที่อนุมัติในผลค้นหานี้ {formatBaht(totalApproved)}
            </p>
          )}
        </div>

        <DocTable
          rows={rows}
          today={today}
          showKind
          hrefOf={approveHref}
          actionLabel={actionLabelOf}
          emptyText="ไม่พบเอกสารตามเงื่อนไขที่เลือก"
        />
      </section>
    </main>
  );
}

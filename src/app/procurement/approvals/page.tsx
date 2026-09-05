import Link from "next/link";
import ApproverGate from "@/components/procurement/ApproverGate";
import DocTable, { docHref } from "@/components/procurement/DocTable";
import { workDateOf } from "@/lib/datetime";
import { listDocs } from "@/lib/procurement-db";
import { isApproverAuthed, requirePermission } from "@/lib/session";
import { approverLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

/** เส้นทางหน้ารายละเอียดของหน้าอนุมัติ — คนละหน้ากับหน้าแก้ไขเอกสาร (ข้อ 3.1) */
function approveHref(row: { kind: "repair" | "purchase"; id: string }) {
  return `/procurement/approvals/${row.kind}/${row.id}`;
}

/** หน้าจอ 3.1 — ต้องยืนยันรหัสผ่านก่อน จึงจะเห็นรายการรออนุมัติ */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; all?: string }>;
}) {
  const user = await requirePermission("PR_APPROVE", "write");
  const authed = await isApproverAuthed();
  const params = await searchParams;

  if (!authed) return <ApproverGate fullName={user.full_name} />;

  const showAll = params.all === "1";
  const [pending, recheck] = await Promise.all([
    listDocs({ approve_status: "pending" }),
    listDocs({ approve_status: "recheck" }),
  ]);
  const rows = showAll ? await listDocs({}) : [...pending, ...recheck];
  const today = workDateOf();

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3.1 อนุมัติซ่อม/จัดซื้อ</h1>
          <p className="text-sm text-slate-500">
            {user.full_name} · {showAll ? "แสดงทุกเอกสาร" : "แสดงเฉพาะที่รออนุมัติหรือให้ตรวจสอบราคาใหม่"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={showAll ? "/procurement/approvals" : "/procurement/approvals?all=1"}
            className="btn-secondary"
          >
            {showAll ? "ดูเฉพาะที่รออนุมัติ" : "ดูทุกเอกสาร"}
          </Link>
          <form action={approverLogoutAction}>
            <button type="submit" className="btn-secondary text-rose-600">
              ออกจากโหมดอนุมัติ
            </button>
          </form>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          {showAll ? "เอกสารทั้งหมด" : "รอการพิจารณา"} ({rows.length} ใบ)
        </h2>
        <DocTable
          rows={rows}
          today={today}
          showKind
          hrefOf={approveHref}
          actionLabel="พิจารณา"
          emptyText={showAll ? "ยังไม่มีเอกสารในระบบ" : "ไม่มีเอกสารที่รอการพิจารณาในขณะนี้"}
        />
      </section>
    </main>
  );
}

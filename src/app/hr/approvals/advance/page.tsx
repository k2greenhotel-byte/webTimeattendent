import Link from "next/link";
import { hrApproverLogoutAction } from "@/app/hr/actions";
import AdvanceDecisionCard from "@/components/hr/AdvanceDecisionCard";
import AdvanceTable from "@/components/hr/AdvanceTable";
import HrApproverGate from "@/components/hr/ApproverGate";
import { listRejectReasons } from "@/lib/approval-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatBaht, groupByCompany, summarizeAdvanceInbox } from "@/lib/leave";
import { listAdvanceRequests } from "@/lib/leave-db";
import { advanceAuthorityFor } from "@/lib/leave-session";
import { checkPermission, isApproverAuthed, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจออนุมัติขอเบิกเงินเดือน
 * วงเงินอนุมัติใช้กฎชุดเดียวกับระบบอนุมัติกลาง (เมนู "ตั้งค่าอำนาจอนุมัติ")
 * จะได้ไม่ต้องตั้งวงเงินสองที่
 */
export default async function AdvanceApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; done?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HR_ADV_APPROVE", "read");
  const params = await searchParams;

  if (!(await isApproverAuthed())) {
    return <HrApproverGate fullName={user.full_name} kind="advance" title="อนุมัติขอเบิกเงิน" />;
  }

  const today = workDateOf();
  const showDone = params.done === "1";

  const [canDecide, reasons, pending, decided] = await Promise.all([
    checkPermission("HR_ADV_APPROVE", "write"),
    listRejectReasons(true),
    listAdvanceRequests({ statuses: ["pending"], companyId: params.company || undefined }),
    showDone
      ? listAdvanceRequests({
          statuses: ["approved", "partial", "rejected", "cancelled"],
          companyId: params.company || undefined,
          limit: 100,
        })
      : Promise.resolve([]),
  ]);

  const summary = summarizeAdvanceInbox(pending);
  const groups = groupByCompany(pending);

  // วงเงินของผู้อนุมัติอาจต่างกันตามบริษัทของใบขอ จึง resolve ทีละกลุ่ม
  const authorityByCompany = new Map(
    await Promise.all(
      groups.map(
        async (g) => [g.companyId ?? "", await advanceAuthorityFor(user, g.companyId)] as const,
      ),
    ),
  );

  const cards = [
    { label: "รออนุมัติ", value: String(summary.pending), tone: "text-amber-600" },
    { label: "ยอดรวมที่ขอเบิก", value: formatBaht(summary.totalRequested), tone: "text-slate-800" },
  ];

  const companyOptions = groups.map((g) => ({ id: g.companyId, name: g.companyName }));

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">อนุมัติขอเบิกเงินเดือน</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · แยกตามบริษัท · เลือกอนุมัติเต็มจำนวน อนุมัติบางส่วน
            หรือไม่อนุมัติได้ท้ายรายการ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/approvals" className="text-sm text-brand-600 hover:underline">
            ← กล่องรออนุมัติกลาง
          </Link>
          <form action={hrApproverLogoutAction}>
            <input type="hidden" name="kind" value="advance" />
            <button type="submit" className="btn-secondary text-sm">
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
      {!canDecide && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีของคุณเปิดดูได้อย่างเดียว ยังกดอนุมัติไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์
          &quot;เพิ่ม&quot; ของเมนูอนุมัติขอเบิกเงินให้ก่อน
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label">บริษัท</label>
          <select name="company" defaultValue={params.company ?? ""} className="input w-60">
            <option value="">ทุกบริษัท</option>
            {companyOptions.map((c) => (
              <option key={c.id ?? "none"} value={c.id ?? ""}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" name="done" value="1" defaultChecked={showDone} />
          แสดงใบที่ตัดสินไปแล้วด้วย
        </label>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500">ไม่มีใบขอเบิกรอพิจารณา 🎉</p>
      ) : (
        groups.map((group) => {
          const authority = authorityByCompany.get(group.companyId ?? "") ?? null;
          return (
            <section key={group.companyId ?? "none"} className="space-y-2">
              <h2 className="font-semibold text-slate-800">
                {group.companyName}{" "}
                <span className="text-sm font-normal text-slate-500">({group.rows.length} ใบ)</span>
              </h2>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <AdvanceDecisionCard
                    key={row.id}
                    row={row}
                    reasons={reasons}
                    backTo="/hr/approvals/advance"
                    canDecide={canDecide}
                    limitText={authority ? `อำนาจอนุมัติของคุณ: ${authority.reason}` : null}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {showDone && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">ใบที่ตัดสินไปแล้ว ({decided.length})</h2>
          <AdvanceTable rows={decided} emptyText="ยังไม่มีใบที่ตัดสินแล้ว" />
        </section>
      )}
    </main>
  );
}

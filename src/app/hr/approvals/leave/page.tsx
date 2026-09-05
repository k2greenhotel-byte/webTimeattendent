import Link from "next/link";
import { hrApproverLogoutAction } from "@/app/hr/actions";
import HrApproverGate from "@/components/hr/ApproverGate";
import LeaveDecisionCard from "@/components/hr/LeaveDecisionCard";
import LeaveTable from "@/components/hr/LeaveTable";
import { listRejectReasons } from "@/lib/approval-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { groupByCompany, summarizeLeaveInbox } from "@/lib/leave";
import { listLeaveRequests, listLeaveTypes } from "@/lib/leave-db";
import { checkPermission, isApproverAuthed, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจออนุมัติการลา
 * เข้าได้ต่อเมื่อยืนยันรหัสผ่านผู้อนุมัติแล้ว — ใช้ cookie ร่วมกับกล่องรออนุมัติกลาง
 * ยืนยันจากหน้ากลางมาแล้วจะไม่ถามซ้ำ
 */
export default async function LeaveApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; type?: string; done?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HR_LEAVE_APPROVE", "read");
  const params = await searchParams;

  if (!(await isApproverAuthed())) {
    return <HrApproverGate fullName={user.full_name} kind="leave" title="อนุมัติการลา" />;
  }

  const today = workDateOf();
  const showDone = params.done === "1";

  const [canDecide, reasons, types, pending, decided] = await Promise.all([
    checkPermission("HR_LEAVE_APPROVE", "write"),
    listRejectReasons(true),
    listLeaveTypes(true),
    listLeaveRequests({
      statuses: ["pending", "need_docs"],
      typeId: params.type || undefined,
      companyId: params.company || undefined,
    }),
    showDone
      ? listLeaveRequests({
          statuses: ["approved", "rejected", "cancelled"],
          typeId: params.type || undefined,
          companyId: params.company || undefined,
          limit: 100,
        })
      : Promise.resolve([]),
  ]);

  const summary = summarizeLeaveInbox(pending, today);
  const groups = groupByCompany(pending);

  const cards = [
    { label: "รออนุมัติ", value: String(summary.pending), tone: "text-amber-600" },
    { label: "เข้าข่ายขาดงาน", value: String(summary.absent), tone: "text-rose-600" },
    { label: "แจ้งช้า (โดนหักเงิน)", value: String(summary.penalty), tone: "text-orange-600" },
    { label: "เลยกำหนดใบรับรองแพทย์", value: String(summary.certOverdue), tone: "text-rose-600" },
  ];

  /** ตัวเลือกบริษัทดึงจากรายการที่มีอยู่จริง จะได้ไม่โชว์บริษัทที่ไม่มีเรื่องค้าง */
  const companyOptions = groupByCompany(pending).map((g) => ({
    id: g.companyId,
    name: g.companyName,
  }));

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">อนุมัติการลา</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · แยกตามบริษัท · ติ๊กเปลี่ยนสถานะท้ายรายการแล้วกดบันทึกได้ทันที
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/approvals" className="text-sm text-brand-600 hover:underline">
            ← กล่องรออนุมัติกลาง
          </Link>
          <form action={hrApproverLogoutAction}>
            <input type="hidden" name="kind" value="leave" />
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
          &quot;เพิ่ม&quot; ของเมนูอนุมัติการลาให้ก่อน
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
        <div>
          <label className="label">ประเภทการลา</label>
          <select name="type" defaultValue={params.type ?? ""} className="input w-56">
            <option value="">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
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

      {/* ---------- รายการรออนุมัติ แยกตามบริษัท ---------- */}
      {groups.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500">
          ไม่มีใบแจ้งลารอพิจารณา 🎉
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.companyId ?? "none"} className="space-y-2">
            <h2 className="font-semibold text-slate-800">
              {group.companyName}{" "}
              <span className="text-sm font-normal text-slate-500">({group.rows.length} ใบ)</span>
            </h2>
            <div className="space-y-2">
              {group.rows.map((row) => (
                <LeaveDecisionCard
                  key={row.id}
                  row={row}
                  today={today}
                  reasons={reasons}
                  backTo="/hr/approvals/leave"
                  canDecide={canDecide}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* ---------- ประวัติที่ตัดสินไปแล้ว ---------- */}
      {showDone && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">ใบที่ตัดสินไปแล้ว ({decided.length})</h2>
          <LeaveTable rows={decided} today={today} emptyText="ยังไม่มีใบที่ตัดสินแล้ว" />
        </section>
      )}
    </main>
  );
}

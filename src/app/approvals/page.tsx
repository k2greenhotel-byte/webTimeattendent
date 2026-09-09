import Link from "next/link";
import ApvApproverGate from "@/components/approval/ApproverGate";
import PrDecideCard from "@/components/approval/PrDecideCard";
import RequestTable from "@/components/approval/RequestTable";
import AdvanceDecisionCard from "@/components/hr/AdvanceDecisionCard";
import LeaveDecisionCard from "@/components/hr/LeaveDecisionCard";
import { apvApproverLogoutAction } from "@/app/approvals/actions";
import { formatBaht, sortByUrgency, splitByAuthority, summarizeInbox } from "@/lib/approval";
import {
  countEndorsedBy,
  listPrPending,
  listRejectReasons,
  listRequests,
  listTypes,
} from "@/lib/approval-db";
import { authorityFor, getLimits } from "@/lib/approval-session";
import type { ApvRequestRow } from "@/lib/approval-types";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { entitlementKey } from "@/lib/leave";
import { bulkEntitlementInfo, listHrPending, listLeaveTypes } from "@/lib/leave-db";
import { advanceAuthorityFor } from "@/lib/leave-session";
import { checkPermission, isApproverAuthed, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Tab = "mine" | "over" | "endorsed";

export default async function ApprovalInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("APV_INBOX", "read");
  const params = await searchParams;

  // ต้องยืนยันรหัสผ่านซ้ำก่อนเห็นเรื่องที่รออนุมัติ
  if (!(await isApproverAuthed())) return <ApvApproverGate fullName={user.full_name} />;

  const canDecideAtAll = await checkPermission("APV_INBOX", "write");
  const today = workDateOf();

  // เมนูขอลา/ขอเบิกเงิน/จัดซื้อเป็นของคนละโปรแกรม — สิทธิ์ "ดู" กับ "กดตัดสิน" แยกกันคนละใบ
  // จึงต้องถามทีละโปรแกรม คนที่ดูได้แต่ยังไม่มีสิทธิ์กด จะเห็นรายการแต่ไม่มีปุ่มบันทึก
  const [canSeeLeave, canSeeAdvance, canSeePr, canDecideLeave, canDecideAdvance, canDecidePr] =
    await Promise.all([
      checkPermission("HR_LEAVE_APPROVE", "read"),
      checkPermission("HR_ADV_APPROVE", "read"),
      checkPermission("PR_APPROVE", "read"),
      checkPermission("HR_LEAVE_APPROVE", "write"),
      checkPermission("HR_ADV_APPROVE", "write"),
      checkPermission("PR_APPROVE", "write"),
    ]);

  const [limits, types, open, endorsedByMe, pr, hr, reasons, leaveTypes] = await Promise.all([
    getLimits(),
    listTypes(true),
    listRequests({ statuses: ["pending", "endorsed"], typeId: params.type || undefined }),
    countEndorsedBy(user.id),
    listPrPending(),
    listHrPending(),
    listRejectReasons(true),
    listLeaveTypes(true),
  ]);

  // สิทธิ์วันลาคงเหลือของแต่ละใบ — การ์ดอนุมัติต้องโชว์ให้เห็นก่อนกด ไม่งั้นอนุมัติเกินสิทธิ์
  const leaveEntitlements = canSeeLeave
    ? await bulkEntitlementInfo(
        hr.leave.map((r) => ({
          employeeId: r.employee_id,
          typeId: r.type_id,
          year: Number(r.start_date.slice(0, 4)),
        })),
        Object.fromEntries(leaveTypes.map((t) => [t.id, t.max_days_per_year])),
      )
    : new Map();

  // วงเงินอนุมัติต่างกันตามบริษัทของใบขอ จึง resolve ทีละบริษัทที่มีใบค้างจริง
  const advanceCompanyIds = [...new Set(hr.advance.map((r) => r.company_id ?? ""))];
  const advanceAuthority = new Map(
    canSeeAdvance
      ? await Promise.all(
          advanceCompanyIds.map(
            async (id) => [id, await advanceAuthorityFor(user, id || null)] as const,
          ),
        )
      : [],
  );

  const { canDecide, overLimit } = splitByAuthority(open, (row) => authorityFor(limits, user, row));
  const summary = summarizeInbox(canDecide, overLimit, endorsedByMe, today);

  const tab: Tab = params.tab === "over" ? "over" : params.tab === "endorsed" ? "endorsed" : "mine";
  const endorsedRows = canDecide.filter((r) => r.status === "endorsed");

  const shown: Record<Tab, ApvRequestRow[]> = {
    mine: sortByUrgency(canDecide),
    over: sortByUrgency(overLimit),
    endorsed: sortByUrgency(endorsedRows),
  };

  // ใบจากโปรแกรมอื่นที่มารออยู่ในหน้านี้ด้วย — นับเฉพาะส่วนที่ผู้ใช้คนนี้มีสิทธิ์เห็น
  const fromModules =
    (canSeePr ? pr.rows.length : 0) +
    (canSeeLeave ? hr.leave.length : 0) +
    (canSeeAdvance ? hr.advance.length : 0);

  const cards = [
    { label: "รอฉันตัดสิน", value: String(summary.mine), tone: "text-brand-600" },
    { label: "จากโปรแกรมอื่น", value: String(fromModules), tone: "text-orange-600" },
    { label: "เกินอำนาจฉัน", value: String(summary.overLimit), tone: "text-amber-600" },
    { label: "ฉันเสนอขึ้นไป (ยังไม่จบ)", value: String(summary.endorsedByMe), tone: "text-sky-600" },
    { label: "เลยกำหนดต้องการ", value: String(summary.overdue), tone: "text-rose-600" },
    { label: "ยอดเงินที่รออนุมัติ", value: formatBaht(summary.totalAmount), tone: "text-slate-800" },
  ];

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "mine", label: "รอฉันตัดสิน", count: canDecide.length },
    { key: "over", label: "เกินอำนาจฉัน", count: overLimit.length },
    { key: "endorsed", label: "เสนอขึ้นมาแล้ว", count: endorsedRows.length },
  ];

  const linkOf = (next: Partial<{ tab: Tab; type: string }>) => {
    const query = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextType = next.type ?? params.type ?? "";
    if (nextTab !== "mine") query.set("tab", nextTab);
    if (nextType) query.set("type", nextType);
    const qs = query.toString();
    return qs ? `/approvals?${qs}` : "/approvals";
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">กล่องรออนุมัติ</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · รวมทุกเรื่องที่รอคุณอนุมัติไว้ที่เดียว — เรื่องส่วนกลาง
            ใบขอซ่อม/จัดซื้อ ใบลา และใบขอเบิกเงิน กดตัดสินได้ครบในหน้านี้
            เรื่องที่เกินอำนาจให้กด &quot;เสนอผู้มีอำนาจสูงกว่า&quot;
          </p>
        </div>
        <form action={apvApproverLogoutAction}>
          <button type="submit" className="btn-secondary text-sm">
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
      {!canDecideAtAll && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีของคุณเปิดดูได้อย่างเดียว ยังกดอนุมัติไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์ &quot;เพิ่ม&quot;
          ของเมนูกล่องรออนุมัติให้ก่อน
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex flex-wrap gap-1">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={linkOf({ tab: t.key })}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  t.key === tab ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label} ({t.count})
              </Link>
            ))}
          </div>

          <form method="get" className="flex items-center gap-2">
            {tab !== "mine" && <input type="hidden" name="tab" value={tab} />}
            <select name="type" defaultValue={params.type ?? ""} className="input w-56">
              <option value="">ทุกประเภทเรื่อง</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              กรอง
            </button>
          </form>
        </div>

        <RequestTable
          rows={shown[tab]}
          today={today}
          actionLabel={tab === "over" ? "ดู/เสนอต่อ" : "พิจารณา"}
          emptyText={
            tab === "over"
              ? "ไม่มีเรื่องที่เกินอำนาจของคุณ"
              : tab === "endorsed"
                ? "ยังไม่มีเรื่องที่ถูกเสนอขึ้นมา"
                : "ไม่มีเรื่องรอคุณตัดสิน 🎉"
          }
          note={(row) =>
            row.status === "endorsed" && row.endorse_by_name
              ? `${row.endorse_by_name} เสนอมา: ${row.endorse_note ?? "-"}`
              : null
          }
        />
      </section>

      {/* ใบขอซ่อม/ขอซื้อจากโมดูลจัดซื้อ — ตัดสินได้ในที่เดียว ไม่ต้องเด้งไปหน้าโปรแกรมนั้น */}
      {canSeePr && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">
                ใบขอซ่อม / ขอจัดซื้อ ที่รออนุมัติ ({pr.rows.length})
              </h2>
              <p className="text-sm text-slate-500">
                มาจากโปรแกรมจัดซื้อจัดจ้างแจ้งซ่อม — เลือกผลแล้วกดบันทึกได้เลย
              </p>
            </div>
            <Link href="/procurement/approvals" className="text-sm text-brand-600 hover:underline">
              เปิดหน้าอนุมัติซ่อม/จัดซื้อ →
            </Link>
          </div>

          {pr.failed ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              อ่านข้อมูลจากโปรแกรมจัดซื้อไม่ได้ชั่วคราว — เรื่องอื่นในกล่องยังใช้งานได้ตามปกติ
            </p>
          ) : pr.rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">ไม่มีใบขอซ่อม/ขอซื้อรออนุมัติ</p>
          ) : (
            <div className="space-y-2">
              {pr.rows.map((row) => (
                <PrDecideCard
                  key={`${row.kind}-${row.id}`}
                  row={row}
                  today={today}
                  canDecide={canDecidePr}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ใบแจ้งลา/หยุดงาน/เข้างานสาย — ใช้การ์ดตัวเดียวกับหน้าอนุมัติของโปรแกรม HR
          กฎการตัดสินและ audit จึงเป็นชุดเดียวกัน ไม่ว่าจะกดจากหน้าไหน */}
      {canSeeLeave && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">
                ใบแจ้งลา / หยุดงาน / เข้างานสาย ที่รออนุมัติ ({hr.leave.length})
              </h2>
              <p className="text-sm text-slate-500">
                มาจากโปรแกรมขอลา/ขอเบิกเงินเดือน — เลือกผลท้ายรายการแล้วกดบันทึกได้เลย
              </p>
            </div>
            <Link href="/hr/approvals/leave" className="text-sm text-brand-600 hover:underline">
              เปิดหน้าอนุมัติการลา →
            </Link>
          </div>

          {hr.failed ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              อ่านข้อมูลจากโปรแกรมขอลาไม่ได้ชั่วคราว — เรื่องอื่นในกล่องยังใช้งานได้ตามปกติ
            </p>
          ) : hr.leave.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">ไม่มีใบแจ้งลารออนุมัติ</p>
          ) : (
            <div className="space-y-2">
              {hr.leave.map((row) => (
                <LeaveDecisionCard
                  key={row.id}
                  row={row}
                  today={today}
                  reasons={reasons}
                  backTo="/approvals"
                  canDecide={canDecideLeave}
                  entitlement={
                    row.employee_id
                      ? (leaveEntitlements.get(
                          entitlementKey(
                            row.employee_id,
                            row.type_id,
                            Number(row.start_date.slice(0, 4)),
                          ),
                        ) ?? null)
                      : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ใบขอเบิกเงินเดือน — ใช้การ์ดตัวเดียวกับโปรแกรม HR วงเงินอนุมัติคิดจาก apv_limits ชุดเดิม */}
      {canSeeAdvance && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">
                ใบขอเบิกเงินเดือน ที่รออนุมัติ ({hr.advance.length})
              </h2>
              <p className="text-sm text-slate-500">
                อนุมัติเต็มจำนวน อนุมัติบางส่วน หรือไม่อนุมัติ ได้ในที่เดียว
              </p>
            </div>
            <Link href="/hr/approvals/advance" className="text-sm text-brand-600 hover:underline">
              เปิดหน้าอนุมัติขอเบิกเงิน →
            </Link>
          </div>

          {hr.failed ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              อ่านข้อมูลจากโปรแกรมขอเบิกเงินไม่ได้ชั่วคราว
            </p>
          ) : hr.advance.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">ไม่มีใบขอเบิกเงินรออนุมัติ</p>
          ) : (
            <div className="space-y-2">
              {hr.advance.map((row) => {
                const authority = advanceAuthority.get(row.company_id ?? "");
                return (
                  <AdvanceDecisionCard
                    key={row.id}
                    row={row}
                    reasons={reasons}
                    backTo="/approvals"
                    canDecide={canDecideAdvance}
                    limitText={authority ? `อำนาจอนุมัติของคุณ: ${authority.reason}` : null}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

import Link from "next/link";
import ApvApproverGate from "@/components/approval/ApproverGate";
import RequestTable from "@/components/approval/RequestTable";
import AdvanceTable from "@/components/hr/AdvanceTable";
import LeaveTable from "@/components/hr/LeaveTable";
import { apvApproverLogoutAction } from "@/app/approvals/actions";
import { formatBaht, sortByUrgency, splitByAuthority, summarizeInbox } from "@/lib/approval";
import { countEndorsedBy, listPrPending, listRequests, listTypes } from "@/lib/approval-db";
import { authorityFor, getLimits } from "@/lib/approval-session";
import type { ApvRequestRow } from "@/lib/approval-types";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listHrPending } from "@/lib/leave-db";
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

  // เมนูขอลา/ขอเบิกเงินเป็นของโปรแกรม HR — แสดงเฉพาะคนที่มีสิทธิ์เข้าหน้าอนุมัติของโปรแกรมนั้น
  const [canSeeLeave, canSeeAdvance] = await Promise.all([
    checkPermission("HR_LEAVE_APPROVE", "read"),
    checkPermission("HR_ADV_APPROVE", "read"),
  ]);

  const [limits, types, open, endorsedByMe, pr, hr] = await Promise.all([
    getLimits(),
    listTypes(true),
    listRequests({ statuses: ["pending", "endorsed"], typeId: params.type || undefined }),
    countEndorsedBy(user.id),
    listPrPending(),
    listHrPending(),
  ]);

  const { canDecide, overLimit } = splitByAuthority(open, (row) => authorityFor(limits, user, row));
  const summary = summarizeInbox(canDecide, overLimit, endorsedByMe, today);

  const tab: Tab = params.tab === "over" ? "over" : params.tab === "endorsed" ? "endorsed" : "mine";
  const endorsedRows = canDecide.filter((r) => r.status === "endorsed");

  const shown: Record<Tab, ApvRequestRow[]> = {
    mine: sortByUrgency(canDecide),
    over: sortByUrgency(overLimit),
    endorsed: sortByUrgency(endorsedRows),
  };

  const cards = [
    { label: "รอฉันตัดสิน", value: String(summary.mine), tone: "text-brand-600" },
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
            {formatThaiDate(today)} · เรื่องที่อยู่ในอำนาจของคุณกดอนุมัติได้เลย
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

      {/* ใบขอซ่อม/ขอซื้อจากโมดูลจัดซื้อ — แสดงรวมให้เห็นครบในที่เดียว */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-800">
              ใบขอซ่อม / ขอจัดซื้อ ที่รออนุมัติ ({pr.rows.length})
            </h2>
            <p className="text-sm text-slate-500">
              มาจากโปรแกรมจัดซื้อจัดจ้างแจ้งซ่อม — กดแล้วไปพิจารณาที่หน้าอนุมัติของโปรแกรมนั้น
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
          <>
            {/* จอเล็ก: การ์ด (แพตเทิร์นเดียวกับ RequestTable/LeaveTable/AdvanceTable) */}
            <div className="space-y-2 md:hidden">
              {pr.rows.map((row) => (
                <Link
                  key={`${row.kind}-${row.id}`}
                  href={`/procurement/approvals/${row.kind}/${row.id}`}
                  className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-800">{row.item_name}</p>
                    <span className="badge bg-orange-50 text-orange-700">
                      {row.kind === "repair" ? "🛠 ซ่อม" : "🧾 ซื้อ"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.doc_no} · {row.created_by_name ?? "-"}
                    {row.branch_name ? ` · ${row.branch_name}` : ""}
                  </p>
                  <p className="mt-2 font-semibold text-slate-800">
                    {formatBaht(row.requested_amount)}
                  </p>
                </Link>
              ))}
            </div>

            {/* จอใหญ่: ตาราง */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>ประเภท</th>
                    <th className="text-left">รายการ</th>
                    <th>ผู้ขอ</th>
                    <th>สาขา</th>
                    <th>จำนวนเงิน</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pr.rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="whitespace-nowrap font-medium">{row.doc_no}</td>
                      <td>
                        <span className="badge bg-orange-50 text-orange-700">
                          {row.kind === "repair" ? "🛠 ใบขอซ่อม" : "🧾 ใบขอจัดซื้อ"}
                        </span>
                      </td>
                      <td className="whitespace-normal text-left">{row.item_name}</td>
                      <td className="text-xs">{row.created_by_name ?? "-"}</td>
                      <td className="text-xs text-slate-500">{row.branch_name ?? "-"}</td>
                      <td className="font-semibold">{formatBaht(row.requested_amount)}</td>
                      <td>
                        <Link
                          href={`/procurement/approvals/${row.kind}/${row.id}`}
                          className="text-sm text-brand-600 hover:underline"
                        >
                          พิจารณา
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ใบแจ้งลา/หยุดงาน/เข้างานสาย จากโปรแกรมขอลา — โปรแกรมนั้นเป็นเจ้าของสถานะเอง หน้านี้อ่านมาแสดงและลิงก์ไป
          ใช้ LeaveTable ตัวเดียวกับที่โปรแกรม HR ใช้เอง จะได้จอเล็กเป็นการ์ดเหมือนกันทั้งระบบ */}
      {canSeeLeave && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">
                ใบแจ้งลา / หยุดงาน / เข้างานสาย ที่รออนุมัติ ({hr.leave.length})
              </h2>
              <p className="text-sm text-slate-500">
                มาจากโปรแกรมขอลา/ขอเบิกเงินเดือน — กดแล้วไปพิจารณาที่หน้าอนุมัติของโปรแกรมนั้น
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
          ) : (
            <LeaveTable
              rows={hr.leave}
              today={today}
              actionLabel="พิจารณา"
              emptyText="ไม่มีใบแจ้งลารออนุมัติ"
            />
          )}
        </section>
      )}

      {/* ใบขอเบิกเงินเดือนจากโปรแกรมขอลา — ใช้ AdvanceTable ตัวเดียวกับโปรแกรม HR */}
      {canSeeAdvance && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">
                ใบขอเบิกเงินเดือน ที่รออนุมัติ ({hr.advance.length})
              </h2>
              <p className="text-sm text-slate-500">
                อนุมัติเต็มจำนวน อนุมัติบางส่วน หรือไม่อนุมัติได้ที่หน้าอนุมัติของโปรแกรมนั้น
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
          ) : (
            <AdvanceTable rows={hr.advance} actionLabel="พิจารณา" emptyText="ไม่มีใบขอเบิกเงินรออนุมัติ" />
          )}
        </section>
      )}
    </main>
  );
}

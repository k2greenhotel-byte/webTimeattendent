import Link from "next/link";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatBaht, isCertOverdue } from "@/lib/leave";
import { listAdvanceRequests, listLeaveRequests } from "@/lib/leave-db";
import { checkPermission, requireProgram } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าแรกของโปรแกรม — สรุปของฉัน + ทางลัดไปแต่ละเมนู */
export default async function HrHomePage() {
  const user = await requireProgram("HR");
  const today = workDateOf();

  const [myLeave, myAdvance, canApproveLeave, canApproveAdvance] = await Promise.all([
    listLeaveRequests({ employeeId: user.id, limit: 100 }),
    listAdvanceRequests({ employeeId: user.id, limit: 100 }),
    checkPermission("HR_LEAVE_APPROVE", "read"),
    checkPermission("HR_ADV_APPROVE", "read"),
  ]);

  const pendingLeave = myLeave.filter((r) => r.status === "pending").length;
  const needDocs = myLeave.filter((r) => r.status === "need_docs" || isCertOverdue(r, today));
  const pendingAdvance = myAdvance.filter((r) => r.status === "pending");
  const approvedAmount = myAdvance
    .filter((r) => r.status === "approved" || r.status === "partial")
    .reduce((sum, r) => sum + r.approved_amount, 0);

  const cards = [
    { label: "ใบแจ้งลารออนุมัติ", value: String(pendingLeave), tone: "text-amber-600" },
    { label: "ต้องส่งหลักฐานเพิ่ม", value: String(needDocs.length), tone: "text-rose-600" },
    { label: "ใบขอเบิกรออนุมัติ", value: String(pendingAdvance.length), tone: "text-sky-600" },
    { label: "ยอดเบิกที่อนุมัติแล้ว", value: formatBaht(approvedAmount), tone: "text-emerald-600" },
  ];

  const links = [
    {
      href: "/hr/leave/new",
      title: "แจ้งลา / หยุดงาน / เข้างานสาย",
      hint: "เลือกประเภทแล้วระบบจะบอกเงื่อนไขและผลที่ตามมาให้ก่อนกดส่ง",
      icon: "📝",
      show: true,
    },
    {
      href: "/hr/leave",
      title: "ใบแจ้งลาของฉัน",
      hint: "ดูสถานะ แนบใบรับรองแพทย์เพิ่ม หรือยกเลิกใบที่ยังไม่อนุมัติ",
      icon: "🗂",
      show: true,
    },
    {
      href: "/hr/advance/new",
      title: "ขอเบิกเงินเดือน",
      hint: "ระบุว่าขอเบิกเพื่ออะไรและยอดที่ต้องการ",
      icon: "💰",
      show: true,
    },
    {
      href: "/hr/advance",
      title: "ใบขอเบิกของฉัน",
      hint: "ดูยอดที่ขอ ยอดที่อนุมัติ และผู้อนุมัติ",
      icon: "📑",
      show: true,
    },
    {
      href: "/hr/approvals/leave",
      title: "อนุมัติการลา",
      hint: "แยกตามบริษัท · ติ๊กเปลี่ยนสถานะท้ายรายการได้เลย",
      icon: "✅",
      show: canApproveLeave,
    },
    {
      href: "/hr/approvals/advance",
      title: "อนุมัติขอเบิกเงิน",
      hint: "อนุมัติเต็มจำนวน อนุมัติบางส่วน หรือไม่อนุมัติ",
      icon: "🧮",
      show: canApproveAdvance,
    },
  ].filter((l) => l.show);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ระบบขอลา / ขอเบิกเงินเดือน</h1>
        <p className="text-sm text-slate-500">
          {formatThaiDate(today)} · {user.full_name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {needDocs.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">มีใบที่ต้องส่งหลักฐานเพิ่ม</p>
          <ul className="mt-1 space-y-0.5">
            {needDocs.map((r) => (
              <li key={r.id}>
                <Link href={`/hr/leave/${r.id}`} className="underline">
                  {r.doc_no}
                </Link>{" "}
                {r.type_name} · {r.cert_due_date ? `กำหนด ${formatThaiDate(r.cert_due_date)}` : ""}
                {r.decision_note ? ` · ${r.decision_note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300"
          >
            <p className="font-semibold text-slate-800">
              <span className="mr-2">{l.icon}</span>
              {l.title}
            </p>
            <p className="mt-1 text-sm text-slate-500">{l.hint}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

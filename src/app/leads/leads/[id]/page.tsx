import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteLeadForm, updateLeadForm } from "@/app/leads/actions";
import { leadOptions, leadScope } from "@/app/leads/scope";
import FollowUpList from "@/components/lead/FollowUpList";
import LeadForm from "@/components/lead/LeadForm";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { getLead, getLeadCustomer, listFollowUps } from "@/lib/lead-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1 (แก้ไข) — ข้อมูล Lead หนึ่งใบ พร้อมประวัติการติดตามทั้งหมด */
export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const scope = await leadScope("LEAD_ENTRY");

  const lead = await getLead(id);
  if (!lead) notFound();

  // ข้อ 2 — พนักงานขายเปิดดูใบของคนอื่นไม่ได้ แม้จะรู้ลิงก์
  if (!scope.canSeeAll && lead.owner_id !== scope.user.id) {
    redirect(
      `/leads/leads?err=${encodeURIComponent("ดูได้เฉพาะ Lead ของตัวเองเท่านั้น")}`,
    );
  }

  const [customer, follows, options, canEdit, canDelete] = await Promise.all([
    getLeadCustomer(lead.customer_id),
    listFollowUps({ lead_id: id }),
    leadOptions(),
    checkPermission("LEAD_ENTRY", "edit"),
    checkPermission("LEAD_ENTRY", "delete"),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lead {lead.doc_no}</h1>
          <p className="text-sm text-slate-500">
            {lead.customer_name} · รับ Lead {formatThaiDate(lead.lead_date)} · ติดตามแล้ว{" "}
            {lead.follow_count} ครั้ง
          </p>
        </div>
        <Link href={`/leads/follow/${lead.id}`} className="btn-primary w-full text-center sm:w-auto">
          บันทึกผลติดตาม
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <LeadForm
          lead={lead}
          customer={customer}
          branches={options.branches}
          brands={options.brands}
          models={options.models}
          channels={options.channels}
          ownerName={lead.owner_name ?? lead.owner_full_name ?? "—"}
          today={workDateOf()}
          action={updateLeadForm}
          submitLabel="บันทึกการแก้ไข"
          cancelHref="/leads/leads"
        />
      ) : (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่มีสิทธิ์แก้ไข Lead กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          ประวัติการติดตาม ({follows.length} ครั้ง)
        </h2>
        <FollowUpList rows={follows} />
      </section>

      {canDelete && (
        <form action={deleteLeadForm} className="card space-y-2 border-rose-200">
          <input type="hidden" name="id" value={lead.id} />
          <h2 className="font-semibold text-rose-700">ลบ Lead ใบนี้</h2>
          <p className="text-xs text-slate-500">
            ลบแล้วประวัติการติดตาม {lead.follow_count} ครั้งจะหายตามไปด้วย และกู้คืนไม่ได้
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="confirm" className="h-4 w-4 rounded border-slate-300" />
            ยืนยันลบ
          </label>
          <button type="submit" className="btn-secondary w-full text-rose-700 sm:w-auto">
            ลบ Lead
          </button>
        </form>
      )}
    </main>
  );
}

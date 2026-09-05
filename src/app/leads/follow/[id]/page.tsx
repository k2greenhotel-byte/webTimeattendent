import { notFound, redirect } from "next/navigation";
import { createFollowUpForm } from "@/app/leads/actions";
import { leadScope } from "@/app/leads/scope";
import FollowUpForm from "@/components/lead/FollowUpForm";
import FollowUpList from "@/components/lead/FollowUpList";
import { workDateOf } from "@/lib/datetime";
import { getLead, listFollowUps } from "@/lib/lead-db";

export const dynamic = "force-dynamic";

/** หน้าจอ 2 — บันทึกผลการติดตามของ Lead หนึ่งใบ (ข้อ 2.1-2.7) */
export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const scope = await leadScope("LEAD_FOLLOW", "write");

  const lead = await getLead(id);
  if (!lead) notFound();

  // ข้อ 2 — พนักงานขายบันทึกผลได้เฉพาะ Lead ของตัวเอง
  if (!scope.canSeeAll && lead.owner_id !== scope.user.id) {
    redirect(`/leads/follow?err=${encodeURIComponent("บันทึกได้เฉพาะ Lead ของตัวเองเท่านั้น")}`);
  }

  const follows = await listFollowUps({ lead_id: id });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึกผลการติดตาม</h1>
        <p className="text-sm text-slate-500">
          เลขที่การติดตามระบบรันให้ · ไม่เลือกสถานะ = คงสถานะเดิมไว้
        </p>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <FollowUpForm lead={lead} today={workDateOf()} action={createFollowUpForm} />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          ประวัติการติดตาม ({follows.length} ครั้ง)
        </h2>
        <FollowUpList rows={follows} />
      </section>
    </main>
  );
}

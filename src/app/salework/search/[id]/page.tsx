import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteLogForm } from "@/app/salework/actions";
import { workScope } from "@/app/salework/scope";
import { formatThaiDate, formatStampThai } from "@/lib/datetime";
import { progressOf } from "@/lib/salework";
import { getLog } from "@/lib/salework-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const FILE_URL = (path: string) => `/api/salework/file?path=${encodeURIComponent(path)}`;

/** รายละเอียดใบบันทึกงานหนึ่งใบ พร้อมรูป/คลิปที่แนบไว้ */
export default async function SaleWorkLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const scope = await workScope("SW_SEARCH");

  const detail = await getLog(id);
  if (!detail) notFound();

  // พนักงานทั่วไปเปิดใบของคนอื่นไม่ได้ แม้จะรู้ id ก็ตาม
  if (!scope.canSeeAll && detail.log.owner_id !== scope.user.id) {
    redirect(`/salework/search?err=${encodeURIComponent("ดูได้เฉพาะใบบันทึกงานของตัวเองเท่านั้น")}`);
  }

  const canDelete = await checkPermission("SW_ENTRY", "delete");
  const isOwner = detail.log.owner_id === scope.user.id;
  const progress = progressOf(detail.items);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบงาน {detail.log.doc_no}</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(detail.log.work_date)} · {detail.log.owner_full_name ?? detail.log.owner_name}
            {detail.log.branch_name ? ` · สาขา ${detail.log.branch_name}` : ""}
          </p>
        </div>
        <Link href="/salework/search" className="btn-secondary no-print">
          กลับรายการ
        </Link>
      </div>

      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <section className="card flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          ทำแล้ว {progress.done}/{progress.total} งาน ({progress.pct}%)
        </span>
        {detail.log.submitted_at ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
            ส่งงานเมื่อ {formatStampThai(detail.log.submitted_at)}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">ยังไม่ได้ส่งงาน</span>
        )}
        {isOwner && (
          <Link
            href={`/salework/daily?date=${detail.log.work_date}`}
            className="btn-secondary no-print ml-auto"
          >
            แก้ไขใบนี้
          </Link>
        )}
      </section>

      <section className="space-y-2">
        {detail.items.map((item) => (
          <div
            key={item.id}
            className={`card space-y-2 ${item.done ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-slate-800">
                {item.done ? "✅" : "⬜"} {item.task_name}
                <span className="ml-2 text-xs font-normal text-slate-400">{item.task_code}</span>
              </p>
              {item.done && item.qty !== null && (
                <p className="text-sm font-semibold text-slate-800">
                  {item.metric_label ? `${item.metric_label}: ` : ""}
                  {item.qty.toLocaleString("th-TH")} {item.metric_unit ?? ""}
                </p>
              )}
            </div>

            {item.detail && <p className="whitespace-pre-wrap text-sm text-slate-600">{item.detail}</p>}

            {item.link_url && (
              <a
                href={item.link_url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm text-brand-700 underline"
              >
                {item.link_url}
              </a>
            )}

            {item.media.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {item.media.map((m) => (
                  <a
                    key={m.id}
                    href={FILE_URL(m.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    {m.kind === "video" ? (
                      <span className="flex h-24 w-full flex-col items-center justify-center bg-slate-100 text-xs text-slate-600">
                        <span className="text-xl">🎬</span>
                        เปิดคลิป
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={FILE_URL(m.path)} alt="ไฟล์แนบ" className="h-24 w-full object-cover" />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {detail.log.note && (
        <section className="card">
          <p className="label">สรุปงานวันนี้ / ปัญหาที่พบ</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.log.note}</p>
        </section>
      )}

      {canDelete && (scope.canSeeAll || isOwner) && (
        <form action={deleteLogForm} className="card no-print space-y-2">
          <input type="hidden" name="id" value={detail.log.id} />
          <p className="text-sm text-slate-600">
            ลบใบงานนี้ทั้งใบ พร้อมรูปและคลิปที่แนบไว้ {detail.log.media_count} ไฟล์ — ลบแล้วกู้คืนไม่ได้
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="confirm" required className="h-4 w-4 rounded border-slate-300" />
            ยืนยันว่าต้องการลบใบงานนี้
          </label>
          <button type="submit" className="btn-danger">
            ลบใบงาน
          </button>
        </form>
      )}
    </main>
  );
}

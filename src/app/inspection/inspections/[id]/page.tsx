import Link from "next/link";
import { notFound } from "next/navigation";
import InspectionForm, { type SavedResult } from "@/components/inspection/InspectionForm";
import PhotoGrid from "@/components/inspection/PhotoGrid";
import { GradeBadge, StatusBadge } from "@/components/inspection/StatusBadges";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht, formatScore } from "@/lib/inspection";
import { getForm, getInspection, listResults } from "@/lib/inspection-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteInspectionForm, saveInspectionForm, setStatusForm } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * หน้าใบตรวจหนึ่งใบ
 *   ฉบับร่าง → เปิดเป็นฟอร์มให้ตรวจต่อได้เลย
 *   ส่งผลแล้ว/ยกเลิก → แสดงผลอย่างเดียว กด "แก้ไข" เพื่อกลับเป็นฉบับร่างก่อน
 */
export default async function InspectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string; edit?: string }>;
}) {
  await requirePermission("INSP_ENTRY", "read");
  const { id } = await params;
  const query = await searchParams;

  const inspection = await getInspection(id);
  if (!inspection) notFound();

  const [results, canEdit, canDelete] = await Promise.all([
    listResults(id),
    checkPermission("INSP_ENTRY", "edit"),
    checkPermission("INSP_ENTRY", "delete"),
  ]);

  const editing = canEdit && (inspection.status === "draft" || query.edit === "1");

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{inspection.doc_no}</h1>
        <p className="text-sm text-slate-500">
          {formatThaiDate(inspection.inspect_date)} · สาขา {inspection.branch_name ?? "—"}
          {inspection.company_name ? ` · ${inspection.company_name}` : ""}
          {inspection.inspector_name ? ` · ผู้ตรวจ ${inspection.inspector_name}` : ""}
        </p>
      </div>
      <Link href="/inspection/inspections" className="btn-secondary">
        ← กลับรายการ
      </Link>
    </div>
  );

  const messages = (
    <>
      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}
    </>
  );

  // ---------- โหมดแก้ไข ----------
  if (editing) {
    const form = inspection.template_id ? await getForm(inspection.template_id) : null;

    if (!form) {
      return (
        <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
          {header}
          {messages}
          <p className="card text-sm text-rose-700">
            แบบฟอร์มที่ใช้ตรวจใบนี้ถูกลบไปแล้ว จึงแก้ไขต่อไม่ได้ — ดูผลที่บันทึกไว้ได้ที่{" "}
            <Link href={`/inspection/inspections/${id}`} className="underline">
              โหมดดูอย่างเดียว
            </Link>
          </p>
        </main>
      );
    }

    const [companies, branches] = await Promise.all([listCompanies(true), listBranches(true)]);
    const formItemIds = new Set(form.sections.flatMap((s) => s.items.map((i) => i.id)));
    const saved: SavedResult[] = results.map((r) => ({
      item_id: r.item_id,
      option_id: r.option_id,
      score: r.score,
      fine_amount: r.fine_amount,
      note: r.note,
      photos: r.photos,
    }));

    return (
      <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
        {header}
        {messages}

        <InspectionForm
          form={form}
          companies={companies}
          branches={branches}
          action={saveInspectionForm}
          defaults={{
            id: inspection.id,
            inspect_date: inspection.inspect_date,
            company_id: inspection.company_id ?? "",
            branch_id: inspection.branch_id ?? "",
            inspector_name: inspection.inspector_name ?? "",
            note: inspection.note ?? "",
          }}
          saved={saved}
          orphanCount={results.filter((r) => !r.item_id || !formItemIds.has(r.item_id)).length}
          submitLabel="ส่งผลการตรวจ"
        />
      </main>
    );
  }

  // ---------- โหมดดูอย่างเดียว ----------
  const sections = groupBySection(results);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      {header}
      {messages}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={inspection.status} />
          {inspection.status === "submitted" && <GradeBadge scorePct={inspection.score_pct} />}
          <span className="text-sm text-slate-500">{inspection.template_name}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="คะแนนรวม"
            value={`${formatScore(inspection.total_score)} / ${formatScore(inspection.max_score)}`}
            sub={`${inspection.score_pct.toFixed(1)}%`}
          />
          <Stat label="ข้อที่ไม่ผ่าน" value={String(inspection.fail_count)} sub="จากข้อที่มีคะแนน" />
          <Stat
            label="ค่าปรับรวม"
            value={formatBaht(inspection.total_fine)}
            sub="บาท"
            tone="text-rose-600"
          />
          <Stat
            label="เงินรางวัล"
            value={formatBaht(inspection.bonus_amount)}
            sub="บาท"
            tone="text-emerald-600"
          />
        </div>

        {inspection.note && (
          <div>
            <p className="label">หมายเหตุรวม</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{inspection.note}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {canEdit && (
            <>
              <Link href={`/inspection/inspections/${id}?edit=1`} className="btn-secondary">
                แก้ไขผลการตรวจ
              </Link>

              {inspection.status !== "submitted" && (
                <form action={setStatusForm}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value="submitted" />
                  <button type="submit" className="btn-primary">
                    ส่งผลการตรวจ
                  </button>
                </form>
              )}

              {inspection.status !== "cancelled" && (
                <form action={setStatusForm}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value="cancelled" />
                  <button type="submit" className="btn-secondary">
                    ยกเลิกใบนี้
                  </button>
                </form>
              )}
            </>
          )}

          {canDelete && (
            <form action={deleteInspectionForm} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" name="confirm" className="h-4 w-4" />
                ยืนยันลบใบนี้พร้อมรูป {inspection.photo_count} รูป
              </label>
              <button type="submit" className="btn-danger">
                ลบ
              </button>
            </form>
          )}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.name} className="card space-y-2">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-slate-100 pb-2">
            <h2 className="font-semibold text-slate-800">{section.name}</h2>
            <span className="text-sm text-slate-400">
              {formatScore(section.score)} / {formatScore(section.maxScore)} คะแนน
            </span>
            {section.fine > 0 && (
              <span className="text-sm text-rose-600">ค่าปรับ {formatBaht(section.fine)} บาท</span>
            )}
          </div>

          {section.rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-700">{r.item_name}</p>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    r.max_score > 0 && r.score < r.max_score ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {formatScore(r.score)}
                  {r.max_score > 0 && <span className="text-slate-400"> / {formatScore(r.max_score)}</span>}
                </span>
              </div>

              <p className="mt-0.5 text-sm text-slate-600">{r.option_label ?? "— ยังไม่ได้ตรวจ —"}</p>
              {r.fine_amount > 0 && (
                <p className="text-sm text-rose-600">ค่าปรับ {formatBaht(r.fine_amount)} บาท</p>
              )}
              {r.note && <p className="mt-1 text-sm text-slate-500">หมายเหตุ: {r.note}</p>}

              {r.photos.length > 0 && (
                <div className="mt-2">
                  <PhotoGrid paths={r.photos} caption={r.item_name} />
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-slate-800",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

type ResultRow = Awaited<ReturnType<typeof listResults>>[number];

/** จัดผลรายข้อกลับเป็นหมวด ตามลำดับที่บันทึกไว้ ณ ตอนตรวจ */
function groupBySection(results: ResultRow[]) {
  const groups: {
    name: string;
    sort: number;
    rows: ResultRow[];
    score: number;
    maxScore: number;
    fine: number;
  }[] = [];

  for (const r of results) {
    let group = groups.find((g) => g.name === r.section_name);
    if (!group) {
      group = { name: r.section_name, sort: r.section_sort, rows: [], score: 0, maxScore: 0, fine: 0 };
      groups.push(group);
    }
    group.rows.push(r);
    group.score += r.score;
    group.maxScore += r.max_score;
    group.fine += r.fine_amount;
  }

  return groups.sort((a, b) => a.sort - b.sort);
}

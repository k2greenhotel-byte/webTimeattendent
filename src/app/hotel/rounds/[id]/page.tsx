import Link from "next/link";
import { notFound } from "next/navigation";
import HotelCheckForm, { type SavedResult } from "@/components/hotel/HotelCheckForm";
import PhotoGrid from "@/components/hotel/PhotoGrid";
import { PriorityBadge, ResultBadge, StatusBadge } from "@/components/hotel/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { scopeOf } from "@/lib/hotel";
import { getChecklist, getRound, listResults } from "@/lib/hotel-db";
import { HTL_SCOPE_CLASS, HTL_SCOPE_SHORT } from "@/lib/hotel-types";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteRoundForm, saveRoundForm, setRoundStatusForm } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * ใบตรวจเช็คหนึ่งใบ
 *   ฉบับร่าง → เปิดเป็นฟอร์มให้ตรวจต่อได้เลย
 *   ส่งผลแล้ว/ยกเลิก → แสดงผลอย่างเดียว กด "แก้ไข" เพื่อเปิดฟอร์มทับ
 */
export default async function RoundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string; edit?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  // อ่านใบก่อนเพื่อรู้ว่าเป็นงานอาคารหรืองานห้องพัก แล้วจึงบังคับสิทธิ์ของเมนูที่ตรงกัน
  // (ประตูชั้นแรกคือ layout ที่บังคับสิทธิ์เข้าโปรแกรม HTL อยู่แล้ว)
  const round = await getRound(id);
  if (!round) notFound();

  const scope = scopeOf(round);
  const menu = scope === "room" ? "HTL_ROOM" : "HTL_ENTRY";
  await requirePermission(menu, "read");

  const [results, canEdit, canDelete] = await Promise.all([
    listResults(id),
    checkPermission(menu, "edit"),
    checkPermission(menu, "delete"),
  ]);

  const editing = canEdit && (round.status === "draft" || query.edit === "1");
  const listHref = scope === "room" ? "/hotel/rooms" : "/hotel/rounds";

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-800">
          {round.doc_no}
          <span className={`badge ${HTL_SCOPE_CLASS[scope]}`}>
            {scope === "room" ? `ห้อง ${round.room_code}` : HTL_SCOPE_SHORT[scope]}
          </span>
        </h1>
        <p className="text-sm text-slate-500">
          {formatThaiDate(round.check_date)} · สาขา {round.branch_name ?? "—"}
          {round.room_name ? ` · ${round.room_name}` : ""}
          {round.company_name ? ` · ${round.company_name}` : ""}
          {round.inspector_name ? ` · ผู้ตรวจ ${round.inspector_name}` : ""}
        </p>
      </div>
      <Link href={listHref} className="btn-secondary">
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
    const checklist = await getChecklist(round.branch_id, false, scope);
    const itemIds = new Set(checklist.groups.flatMap((g) => g.items.map((i) => i.id)));

    const saved: SavedResult[] = results.map((r) => ({
      item_id: r.item_id,
      result: r.result,
      note: r.note,
      priority: r.priority,
      is_fixed: r.is_fixed,
      repair_doc_no: r.repair_doc_no,
      photos: r.photos,
    }));

    return (
      <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
        {header}
        {messages}

        <HotelCheckForm
          checklist={checklist}
          header={{
            id: round.id,
            doc_no: round.doc_no,
            check_date: round.check_date,
            company_id: round.company_id ?? "",
            company_name: round.company_name ?? "",
            branch_id: round.branch_id ?? "",
            branch_name: round.branch_name ?? "",
            room_id: round.room_id ?? undefined,
            room_code: round.room_code ?? undefined,
            room_name: round.room_name ?? undefined,
            inspector_name: round.inspector_name ?? "",
            note: round.note ?? "",
          }}
          saved={saved}
          orphanCount={results.filter((r) => !r.item_id || !itemIds.has(r.item_id)).length}
          changeHeaderHref={`/hotel/rounds/${id}`}
          action={saveRoundForm}
        />
      </main>
    );
  }

  // ---------- โหมดดูอย่างเดียว ----------
  const groups = groupByGroupName(results);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      {header}
      {messages}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={round.status} />
          <span className="text-sm text-slate-500">
            ตรวจแล้ว {round.checked_count} จาก {round.total_items} ข้อ
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="ปกติ"
            value={String(round.pass_count)}
            sub={`${round.pass_pct.toFixed(1)}% ของข้อที่ตรวจ`}
            tone="text-emerald-600"
          />
          <Stat
            label="ไม่ปกติ"
            value={String(round.fail_count)}
            sub={`เร่งด่วนทันที ${round.urgent_count} ข้อ`}
            tone="text-rose-600"
          />
          <Stat label="ไม่มี / ไม่ได้ตรวจ" value={String(round.na_count)} sub="ข้อที่ข้ามไป" />
          <Stat
            label="ค้างแก้ไข"
            value={String(round.open_fix_count)}
            sub="ข้อที่ยังไม่ได้แก้"
            tone="text-amber-600"
          />
        </div>

        {round.note && (
          <div>
            <p className="label">หมายเหตุรวม</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{round.note}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {canEdit && (
            <>
              <Link href={`/hotel/rounds/${id}?edit=1`} className="btn-secondary">
                แก้ไขผลการตรวจเช็ค
              </Link>

              {round.status !== "submitted" && (
                <form action={setRoundStatusForm}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value="submitted" />
                  <button type="submit" className="btn-primary">
                    ส่งผลการตรวจเช็ค
                  </button>
                </form>
              )}

              {round.status !== "cancelled" && (
                <form action={setRoundStatusForm}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value="cancelled" />
                  <button type="submit" className="btn-secondary">
                    ยกเลิกใบนี้
                  </button>
                </form>
              )}
            </>
          )}

          {round.fail_count > 0 && (
            <Link
              href={`/hotel/issues?branch_id=${round.branch_id ?? ""}&from=${round.check_date}&to=${round.check_date}&fixed=`}
              className="btn-secondary"
            >
              ดูรายการที่ต้องแก้ไข ({round.fail_count})
            </Link>
          )}

          {canDelete && (
            <form action={deleteRoundForm} className="ml-auto flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" name="confirm" className="h-4 w-4" />
                ยืนยันลบใบนี้พร้อมรูป {round.photo_count} รูป
              </label>
              <button type="submit" className="btn-danger">
                ลบ
              </button>
            </form>
          )}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.name} className="card space-y-2">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-slate-100 pb-2">
            <h2 className="font-semibold text-slate-800">{group.name}</h2>
            <span className="text-sm text-slate-400">{group.rows.length} รายการ</span>
            {group.fail > 0 && (
              <span className="text-sm font-medium text-rose-600">ไม่ปกติ {group.fail} ข้อ</span>
            )}
          </div>

          {group.rows.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                r.result === "fail" ? "border-rose-200 bg-rose-50/40" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-700">{r.item_name}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <ResultBadge result={r.result} />
                  {r.result === "fail" && <PriorityBadge priority={r.priority} />}
                  {r.result === "fail" && r.is_fixed && (
                    <span className="badge bg-emerald-100 text-emerald-700">แก้ไขแล้ว</span>
                  )}
                </div>
              </div>

              {r.note && <p className="mt-1 text-sm text-slate-600">หมายเหตุ: {r.note}</p>}
              {r.repair_doc_no && (
                <p className="text-sm text-slate-500">ใบแจ้งซ่อม: {r.repair_doc_no}</p>
              )}
              {r.fixed_note && (
                <p className="text-sm text-emerald-700">การแก้ไข: {r.fixed_note}</p>
              )}

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

/** จัดผลรายข้อกลับเป็นประเภทงาน ตามลำดับที่บันทึกไว้ ณ ตอนตรวจ */
function groupByGroupName(results: ResultRow[]) {
  const groups: { name: string; sort: number; rows: ResultRow[]; fail: number }[] = [];

  for (const r of results) {
    let group = groups.find((g) => g.name === r.group_name);
    if (!group) {
      group = { name: r.group_name, sort: r.group_sort, rows: [], fail: 0 };
      groups.push(group);
    }
    group.rows.push(r);
    if (r.result === "fail") group.fail += 1;
  }

  return groups.sort((a, b) => a.sort - b.sort);
}

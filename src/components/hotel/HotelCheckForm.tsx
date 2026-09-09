"use client";

import { useMemo, useState } from "react";
import ItemPhotos from "@/components/hotel/ItemPhotos";
import { formatThaiDate } from "@/lib/datetime";
import { totalsOf } from "@/lib/hotel";
import {
  HTL_MAX_PHOTOS,
  HTL_PRIORITY_LABEL,
  HTL_PRIORITY_ORDER,
  HTL_PRIORITY_PICKED_CLASS,
  HTL_RESULT_LABEL,
  HTL_RESULT_ORDER,
  HTL_RESULT_PICKED_CLASS,
  type HtlChecklist,
  type HtlPriority,
  type HtlResultValue,
} from "@/lib/hotel-types";

/** ค่าที่บันทึกไว้แล้วของหนึ่งข้อ (โหมดแก้ไข) */
export type SavedResult = {
  item_id: string | null;
  result: HtlResultValue | null;
  note: string | null;
  priority: HtlPriority | null;
  is_fixed: boolean;
  repair_doc_no: string | null;
  photos: string[];
};

type ItemState = {
  result: HtlResultValue | null;
  note: string;
  priority: HtlPriority;
  isFixed: boolean;
  repairDocNo: string;
  photos: string[];
};

type Props = {
  checklist: HtlChecklist;
  /** หัวใบที่เลือกไว้แล้ว — แสดงอย่างเดียว เพราะรายการตรวจขึ้นกับสาขา เปลี่ยนกลางคันไม่ได้ */
  header: {
    id?: string;
    doc_no?: string;
    check_date: string;
    company_id: string;
    company_name: string;
    branch_id: string;
    branch_name: string;
    /** ใส่ค่าเมื่อเป็นงานตรวจห้องพัก — ว่างไว้คืองานตรวจอาคารทั้งสาขา */
    room_id?: string;
    room_code?: string;
    room_name?: string;
    inspector_name: string;
    note: string;
  };
  saved?: SavedResult[];
  /** ผลที่บันทึกไว้แต่รายการถูกลบออกจากรายการตรวจแล้ว — เตือนว่าจะหายถ้ากดบันทึกทับ */
  orphanCount?: number;
  changeHeaderHref: string;
  action: (data: FormData) => void | Promise<void>;
};

/** ลิงก์เปิดใบแจ้งซ่อมพร้อมเติมข้อมูลที่ตรวจพบให้เลย */
function repairHref(header: Props["header"], itemName: string, note: string): string {
  const query = new URLSearchParams({ item: itemName });
  if (header.company_id) query.set("company", header.company_id);
  if (header.branch_id) query.set("branch", header.branch_id);

  const where = header.room_code ? `ห้อง ${header.room_code}` : header.branch_name;
  const detail = [
    `พบจากการตรวจเช็คประจำวัน ${formatThaiDate(header.check_date)}`,
    where,
    note.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  query.set("detail", detail);
  return `/procurement/repairs/new?${query}`;
}

export default function HotelCheckForm({
  checklist,
  header,
  saved = [],
  orphanCount = 0,
  changeHeaderHref,
  action,
}: Props) {
  const savedByItem = useMemo(() => {
    const map = new Map<string, SavedResult>();
    for (const r of saved) if (r.item_id) map.set(r.item_id, r);
    return map;
  }, [saved]);

  const [state, setState] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {};
    for (const group of checklist.groups) {
      for (const item of group.items) {
        const prev = savedByItem.get(item.id);
        init[item.id] = {
          result: prev?.result ?? null,
          note: prev?.note ?? "",
          priority: prev?.priority ?? item.default_priority,
          isFixed: prev?.is_fixed ?? false,
          repairDocNo: prev?.repair_doc_no ?? "",
          photos: prev?.photos ?? [],
        };
      }
    }
    return init;
  });

  function patch(itemId: string, next: Partial<ItemState>) {
    setState((s) => ({ ...s, [itemId]: { ...s[itemId], ...next } }));
  }

  /** ข้อที่ยังไม่ได้ตรวจ ให้เป็น "ปกติ" ทั้งหมด — งานประจำวันส่วนใหญ่ปกติอยู่แล้ว */
  function markRestPass() {
    setState((s) => {
      const next = { ...s };
      for (const key of Object.keys(next)) {
        if (!next[key].result) next[key] = { ...next[key], result: "pass" };
      }
      return next;
    });
  }

  // ---------- ยอดสรุปสด (ใช้สูตรเดียวกับฝั่ง server) ----------
  const totals = useMemo(
    () =>
      totalsOf(
        checklist.groups.flatMap((g) =>
          g.items.map((item) => ({
            result: state[item.id]?.result ?? null,
            priority: state[item.id]?.priority ?? null,
            is_fixed: state[item.id]?.isFixed ?? false,
          })),
        ),
      ),
    [checklist, state],
  );

  const notChecked = totals.totalItems - totals.checkedCount;

  return (
    <form action={action} className="space-y-4 pb-28">
      {header.id && <input type="hidden" name="id" value={header.id} />}
      <input type="hidden" name="check_date" value={header.check_date} />
      <input type="hidden" name="company_id" value={header.company_id} />
      <input type="hidden" name="branch_id" value={header.branch_id} />
      {header.room_id && <input type="hidden" name="room_id" value={header.room_id} />}

      {/* ---------- หัวใบ ---------- */}
      <section className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="วันที่ตรวจเช็ค" value={formatThaiDate(header.check_date)} />
          <Field label="สาขา / โรงแรม" value={header.branch_name} />
          {header.room_id ? (
            <Field
              label="ห้องพักที่ตรวจ"
              value={[header.room_code, header.room_name].filter(Boolean).join(" · ")}
            />
          ) : (
            <Field label="บริษัท" value={header.company_name || "— ไม่ระบุ —"} />
          )}
          <div>
            <label className="label" htmlFor="inspector_name">
              ผู้ตรวจเช็ค (ช่าง)
            </label>
            <input
              id="inspector_name"
              name="inspector_name"
              defaultValue={header.inspector_name}
              className="input"
              placeholder="ชื่อช่างผู้ตรวจเช็ค"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          รายการตรวจเช็ค{header.room_id ? "ของห้องนี้" : "ของสาขานี้"}มี {checklist.itemCount} ข้อ ·{" "}
          <a href={changeHeaderHref} className="text-brand-700 hover:underline">
            {header.room_id ? "เปลี่ยนห้อง/วันที่" : "เปลี่ยนสาขา/วันที่"}
          </a>
        </p>

        {orphanCount > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ใบนี้มีผลตรวจ {orphanCount} ข้อที่รายการถูกลบออกจากรายการตรวจเช็คไปแล้ว — ถ้ากดบันทึกทับ
            ข้อเหล่านั้นจะหายไป ถ้าต้องการเก็บไว้ให้เปิดดูอย่างเดียว อย่ากดบันทึก
          </p>
        )}
      </section>

      {/* ---------- รายการตรวจเช็ค ---------- */}
      {checklist.groups.length === 0 && (
        <p className="card text-sm text-slate-600">
          {header.room_id ? "ห้องพักของสาขานี้" : "สาขานี้"}ยังไม่มีรายการตรวจเช็ค —
          ให้ผู้ดูแลระบบเพิ่มรายการที่หน้า “6. ตั้งค่ารายการและห้องพัก” ก่อน
        </p>
      )}

      {checklist.groups.map((group, groupIndex) => {
        const failInGroup = group.items.filter((i) => state[i.id]?.result === "fail").length;

        return (
          <section key={group.id} className="card space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 border-b border-slate-100 pb-2">
              <h2 className="font-semibold text-slate-800">
                {groupIndex + 1}. {group.name}
              </h2>
              <span className="text-sm text-slate-400">{group.items.length} รายการ</span>
              {failInGroup > 0 && (
                <span className="text-sm font-medium text-rose-600">
                  ไม่ปกติ {failInGroup} ข้อ
                </span>
              )}
              {group.note && <span className="text-xs text-slate-400">{group.note}</span>}
            </div>

            {group.items.map((item) => {
              const s = state[item.id];
              const failed = s?.result === "fail";

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${
                    failed ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-slate-700">
                      {item.name}
                      {item.require_photo && (
                        <span className="ml-1 text-xs text-rose-600">(ต้องแนบรูปทุกครั้ง)</span>
                      )}
                    </p>
                  </div>
                  {item.note && <p className="mt-0.5 text-xs text-slate-500">{item.note}</p>}

                  {/* ผลการตรวจ — ปุ่มใหญ่ กดง่ายบนมือถือขณะเดินตรวจ */}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {HTL_RESULT_ORDER.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => patch(item.id, { result: value })}
                        className={`rounded-lg border py-2 text-sm font-semibold ${
                          s?.result === value
                            ? HTL_RESULT_PICKED_CLASS[value]
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {HTL_RESULT_LABEL[value]}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name={`res_${item.id}`} value={s?.result ?? ""} />

                  {/* ---------- ข้อที่ไม่ปกติ: หมายเหตุ ความเร่งด่วน ใบแจ้งซ่อม ---------- */}
                  {failed && (
                    <div className="mt-3 space-y-3 rounded-xl bg-white p-3 ring-1 ring-rose-200">
                      <div>
                        <label className="label" htmlFor={`note_${item.id}`}>
                          หมายเหตุ / สิ่งที่ต้องแก้ไข *
                        </label>
                        <textarea
                          id={`note_${item.id}`}
                          name={`note_${item.id}`}
                          rows={2}
                          value={s.note}
                          onChange={(e) => patch(item.id, { note: e.target.value })}
                          className="input"
                          placeholder="พบอะไร ต้องแก้อย่างไร"
                        />
                      </div>

                      <div>
                        <p className="label">สถานะที่ต้องการแก้ไข</p>
                        <div className="grid grid-cols-3 gap-2">
                          {HTL_PRIORITY_ORDER.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => patch(item.id, { priority: p })}
                              className={`rounded-lg border py-2 text-xs font-semibold sm:text-sm ${
                                s.priority === p
                                  ? HTL_PRIORITY_PICKED_CLASS[p]
                                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {HTL_PRIORITY_LABEL[p]}
                            </button>
                          ))}
                        </div>
                        <input type="hidden" name={`prio_${item.id}`} value={s.priority} />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <div>
                          <label className="label" htmlFor={`repairno_${item.id}`}>
                            เลขที่ใบแจ้งขอซ่อม
                          </label>
                          <input
                            id={`repairno_${item.id}`}
                            name={`repairno_${item.id}`}
                            value={s.repairDocNo}
                            onChange={(e) => patch(item.id, { repairDocNo: e.target.value })}
                            className="input"
                            placeholder="เช่น RP-2569-0007 (กรอกหลังเปิดใบซ่อมแล้ว)"
                          />
                        </div>
                        <div className="flex items-end">
                          <a
                            href={repairHref(header, item.name, s.note)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary w-full whitespace-nowrap sm:w-auto"
                          >
                            เปิดใบแจ้งซ่อม ↗
                          </a>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          name={`fixed_${item.id}`}
                          checked={s.isFixed}
                          onChange={(e) => patch(item.id, { isFixed: e.target.checked })}
                          className="h-4 w-4"
                        />
                        แก้ไขเรียบร้อยแล้ว (ไม่ต้องติดตามต่อ)
                      </label>
                    </div>
                  )}

                  {/* ---------- รูปประกอบ ---------- */}
                  <div className="mt-3">
                    <p className="label">
                      รูปประกอบ{" "}
                      <span className="font-normal text-slate-400">
                        ({s?.photos.length ?? 0}/{HTL_MAX_PHOTOS})
                        {failed && item.require_photo_on_fail ? " · ข้อไม่ปกติต้องมีรูป" : ""}
                      </span>
                    </p>
                    <ItemPhotos
                      name={`photo_${item.id}`}
                      max={HTL_MAX_PHOTOS}
                      initial={s?.photos ?? []}
                      onChange={(photos) => patch(item.id, { photos })}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {/* ---------- หมายเหตุรวม ---------- */}
      <section className="card">
        <label className="label" htmlFor="note">
          หมายเหตุรวมของใบตรวจเช็ค
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={header.note}
          className="input"
          placeholder="สรุปสิ่งที่พบ ข้อสั่งการ และกำหนดแก้ไข"
        />
      </section>

      {/* ---------- แถบสรุปติดขอบล่าง ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-2 backdrop-blur sm:p-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 sm:gap-4">
          <div>
            <p className="text-xs text-slate-500">ตรวจแล้ว</p>
            <p className="text-lg font-bold tabular-nums text-slate-800 sm:text-xl">
              {totals.checkedCount}
              <span className="text-sm font-normal text-slate-400"> / {totals.totalItems} ข้อ</span>
            </p>
          </div>

          <div className="hidden sm:block">
            <p className="text-xs text-slate-500">ปกติ</p>
            <p className="font-semibold tabular-nums text-emerald-600">{totals.passCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">ไม่ปกติ</p>
            <p className="font-semibold tabular-nums text-rose-600">{totals.failCount}</p>
          </div>
          {totals.urgentCount > 0 && (
            <div>
              <p className="text-xs text-slate-500">เร่งด่วนทันที</p>
              <p className="font-semibold tabular-nums text-rose-600">{totals.urgentCount}</p>
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {notChecked > 0 && (
              <>
                <span className="text-xs text-amber-700">ยังไม่ได้ตรวจ {notChecked} ข้อ</span>
                <button type="button" onClick={markRestPass} className="btn-secondary text-xs">
                  ที่เหลือปกติทั้งหมด
                </button>
              </>
            )}
            <button type="submit" name="status" value="draft" className="btn-secondary">
              เก็บฉบับร่าง
            </button>
            <button type="submit" name="status" value="submitted" className="btn-primary">
              ส่งผลการตรวจเช็ค
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

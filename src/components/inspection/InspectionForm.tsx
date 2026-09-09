"use client";

import { useMemo, useState } from "react";
import ItemPhotos from "@/components/inspection/ItemPhotos";
import { bonusFor, formatBaht, formatScore, gradeOf, scorePercent } from "@/lib/inspection";
import {
  INSP_GRADE_CLASS,
  INSP_GRADE_LABEL,
  INSP_MAX_PHOTOS,
  type InspForm,
} from "@/lib/inspection-types";

type Option = { id: string; name: string; company_id?: string | null };

/** ค่าที่กรอกไว้แล้วของหนึ่งข้อ (โหมดแก้ไข) */
export type SavedResult = {
  item_id: string | null;
  option_id: string | null;
  score: number;
  fine_amount: number;
  note: string | null;
  photos: string[];
};

type ItemState = { optionId: string; score: string; fine: string; photos: string[] };

type Props = {
  form: InspForm;
  companies: Option[];
  branches: Option[];
  action: (data: FormData) => void | Promise<void>;
  /** ค่าตั้งต้นของหัวใบ */
  defaults: {
    id?: string;
    inspect_date: string;
    company_id: string;
    branch_id: string;
    inspector_name: string;
    note: string;
  };
  saved?: SavedResult[];
  /** ผลที่บันทึกไว้แต่รายการถูกลบออกจากแบบฟอร์มแล้ว — เตือนให้รู้ว่าจะหายไปถ้ากดบันทึก */
  orphanCount?: number;
  submitLabel?: string;
};

const nf = (n: number) => n.toLocaleString("th-TH");

export default function InspectionForm({
  form,
  companies,
  branches,
  action,
  defaults,
  saved = [],
  orphanCount = 0,
  submitLabel = "บันทึกใบตรวจ",
}: Props) {
  const savedByItem = useMemo(() => {
    const map = new Map<string, SavedResult>();
    for (const r of saved) if (r.item_id) map.set(r.item_id, r);
    return map;
  }, [saved]);

  const [companyId, setCompanyId] = useState(defaults.company_id);
  const [state, setState] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {};
    for (const section of form.sections) {
      for (const item of section.items) {
        const prev = savedByItem.get(item.id);
        init[item.id] = {
          optionId: prev?.option_id ?? "",
          score: prev ? String(prev.score) : item.item_type === "rating" ? "" : "0",
          fine: prev && prev.fine_amount > 0 ? String(prev.fine_amount) : "",
          photos: prev?.photos ?? [],
        };
      }
    }
    return init;
  });

  const visibleBranches = companyId
    ? branches.filter((b) => !b.company_id || b.company_id === companyId)
    : branches;

  /** เลือกตัวเลือกใหม่ = เติมค่าปรับตั้งต้นของตัวเลือกนั้นให้ (ผู้ตรวจแก้ทับได้) */
  function chooseOption(itemId: string, optionId: string, defaultFine: number) {
    setState((s) => ({
      ...s,
      [itemId]: { ...s[itemId], optionId, fine: defaultFine > 0 ? String(defaultFine) : "" },
    }));
  }

  function patch(itemId: string, next: Partial<ItemState>) {
    setState((s) => ({ ...s, [itemId]: { ...s[itemId], ...next } }));
  }

  // ---------- คะแนนสด (ใช้สูตรเดียวกับฝั่ง server) ----------
  const totals = useMemo(() => {
    let score = 0;
    let fine = 0;
    let unanswered = 0;

    for (const section of form.sections) {
      for (const item of section.items) {
        const s = state[item.id];
        if (!s) continue;
        fine += Number(s.fine || 0);

        if (item.item_type === "rating") {
          if (s.score === "") unanswered += 1;
          else score += Number(s.score || 0);
          continue;
        }
        if (!s.optionId) {
          unanswered += 1;
          continue;
        }
        score += item.options.find((o) => o.id === s.optionId)?.score ?? 0;
      }
    }

    const pct = scorePercent(score, form.maxScore);
    return {
      score,
      fine,
      unanswered,
      pct,
      grade: gradeOf(pct),
      bonus: bonusFor(form.template, score),
    };
  }, [form, state]);

  return (
    <form action={action} className="space-y-4 pb-28">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="template_id" value={form.template.id} />

      {/* ---------- หัวใบตรวจ ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          {form.template.name}{" "}
          <span className="text-sm font-normal text-slate-400">
            คะแนนเต็ม {formatScore(form.maxScore)} คะแนน
          </span>
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="inspect_date">
              วันที่ตรวจสอบ *
            </label>
            <input
              id="inspect_date"
              name="inspect_date"
              type="date"
              defaultValue={defaults.inspect_date}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="company_id">
              บริษัท
            </label>
            <select
              id="company_id"
              name="company_id"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="input"
            >
              <option value="">— ทุกบริษัท —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="branch_id">
              สาขาที่ตรวจ *
            </label>
            <select
              id="branch_id"
              name="branch_id"
              defaultValue={defaults.branch_id}
              className="input"
              required
            >
              <option value="">— เลือกสาขา —</option>
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inspector_name">
              ผู้ตรวจสอบ
            </label>
            <input
              id="inspector_name"
              name="inspector_name"
              defaultValue={defaults.inspector_name}
              className="input"
              placeholder="ชื่อพนักงานผู้ตรวจเช็ค"
            />
          </div>
        </div>

        {orphanCount > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ใบนี้มีผลตรวจ {orphanCount} ข้อที่รายการถูกลบออกจากแบบฟอร์มไปแล้ว — ถ้ากดบันทึกทับ
            ข้อเหล่านั้นจะหายไป ถ้าต้องการเก็บไว้ให้เปิดดูอย่างเดียว อย่ากดบันทึก
          </p>
        )}
      </section>

      {/* ---------- รายการตรวจ ---------- */}
      {form.sections.length === 0 && (
        <p className="card text-sm text-slate-600">
          แบบฟอร์มนี้ยังไม่มีรายการตรวจ — ให้ผู้ดูแลระบบเพิ่มหมวดและรายการที่หน้า “4. ตั้งค่ารายการตรวจ” ก่อน
        </p>
      )}

      {form.sections.map((section, sectionIndex) => (
        <section key={section.id} className="card space-y-3">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-slate-100 pb-2">
            <h2 className="font-semibold text-slate-800">
              {sectionIndex + 1}. {section.name}
            </h2>
            <span className="text-sm text-slate-400">
              {section.maxScore > 0 ? `เต็ม ${formatScore(section.maxScore)} คะแนน` : "ไม่มีคะแนน — ปรับเงินอย่างเดียว"}
            </span>
            {section.note && <span className="text-xs text-amber-700">{section.note}</span>}
          </div>

          {section.items.map((item) => {
            const s = state[item.id];
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-slate-700">
                    {item.name}
                    {item.require_photo && (
                      <span className="ml-1 text-xs text-rose-600">(ต้องแนบรูป)</span>
                    )}
                  </p>
                  {item.maxScore > 0 && (
                    <span className="text-xs text-slate-400">
                      เต็ม {formatScore(item.maxScore)} คะแนน
                    </span>
                  )}
                </div>
                {item.note && <p className="mt-0.5 text-xs text-slate-500">{item.note}</p>}

                {item.item_type === "choice" ? (
                  <div className="mt-2 space-y-1">
                    {item.options.length === 0 && (
                      <p className="text-xs text-amber-700">
                        ข้อนี้ยังไม่มีตัวเลือกให้เลือก — ให้ผู้ดูแลระบบเพิ่มตัวเลือกที่หน้าตั้งค่า
                      </p>
                    )}
                    {item.options.map((option) => (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          s?.optionId === option.id ? "bg-brand-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`opt_${item.id}`}
                          value={option.id}
                          checked={s?.optionId === option.id}
                          onChange={() => chooseOption(item.id, option.id, option.fine_amount)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="flex-1 text-slate-700">{option.label}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatScore(option.score)} คะแนน
                          {option.fine_amount > 0 && ` · ปรับ ${nf(option.fine_amount)} บ.`}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {Array.from({ length: Math.round(item.maxScore) + 1 }, (_, level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => patch(item.id, { score: String(level) })}
                        className={`h-9 w-10 rounded-lg border text-sm font-semibold ${
                          s?.score === String(level)
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-slate-400">
                      0 = แย่ที่สุด · {Math.round(item.maxScore)} = ดีที่สุด
                    </span>
                    <input type="hidden" name={`score_${item.id}`} value={s?.score ?? ""} />
                  </div>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_1fr]">
                  <div>
                    <label className="label" htmlFor={`fine_${item.id}`}>
                      ค่าปรับ (บาท)
                    </label>
                    <input
                      id={`fine_${item.id}`}
                      name={`fine_${item.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={s?.fine ?? ""}
                      onChange={(e) => patch(item.id, { fine: e.target.value })}
                      className="input"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`note_${item.id}`}>
                      หมายเหตุ
                    </label>
                    <input
                      id={`note_${item.id}`}
                      name={`note_${item.id}`}
                      defaultValue={savedByItem.get(item.id)?.note ?? ""}
                      className="input"
                      placeholder="สิ่งที่พบ / สิ่งที่ต้องแก้ไข"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <p className="label">
                    รูปประกอบ{" "}
                    <span className="font-normal text-slate-400">
                      ({s?.photos.length ?? 0}/{INSP_MAX_PHOTOS})
                    </span>
                  </p>
                  <ItemPhotos
                    name={`photo_${item.id}`}
                    max={INSP_MAX_PHOTOS}
                    initial={s?.photos ?? []}
                    onChange={(photos) => patch(item.id, { photos })}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {/* ---------- สรุปท้ายใบ ---------- */}
      <section className="card space-y-3">
        <div>
          <label className="label" htmlFor="note">
            หมายเหตุรวมของใบตรวจ
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            defaultValue={defaults.note}
            className="input"
            placeholder="สรุปสิ่งที่พบ ข้อสั่งการ และกำหนดแก้ไข"
          />
        </div>

        {form.template.footer_note && (
          <p className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {form.template.footer_note}
          </p>
        )}
      </section>

      {/* ---------- แถบคะแนนติดขอบล่าง ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-2 backdrop-blur sm:p-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 sm:gap-4">
          <div>
            <p className="text-xs text-slate-500">คะแนนรวม</p>
            <p className="text-lg font-bold tabular-nums text-slate-800 sm:text-xl">
              {formatScore(totals.score)}
              <span className="text-sm font-normal text-slate-400">
                {" "}
                / {formatScore(form.maxScore)} ({totals.pct.toFixed(0)}%)
              </span>
            </p>
          </div>

          <span className={`badge ${INSP_GRADE_CLASS[totals.grade]}`}>
            {INSP_GRADE_LABEL[totals.grade]}
          </span>

          <div className="hidden sm:block">
            <p className="text-xs text-slate-500">ค่าปรับรวม</p>
            <p className="font-semibold tabular-nums text-rose-600">{formatBaht(totals.fine)}</p>
          </div>

          {totals.bonus > 0 && (
            <div className="hidden sm:block">
              <p className="text-xs text-slate-500">เงินรางวัล</p>
              <p className="font-semibold tabular-nums text-emerald-600">
                {formatBaht(totals.bonus)}
              </p>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {totals.unanswered > 0 && (
              <span className="text-xs text-amber-700">ยังไม่ได้ตรวจ {totals.unanswered} ข้อ</span>
            )}
            <button type="submit" name="status" value="draft" className="btn-secondary">
              เก็บฉบับร่าง
            </button>
            <button type="submit" name="status" value="submitted" className="btn-primary">
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

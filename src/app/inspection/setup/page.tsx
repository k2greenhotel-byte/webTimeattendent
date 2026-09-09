import Link from "next/link";
import { formatScore } from "@/lib/inspection";
import { listForms } from "@/lib/inspection-db";
import { INSP_ITEM_TYPE_HINT, INSP_ITEM_TYPE_LABEL, type InspForm } from "@/lib/inspection-types";
import { checkPermission, requirePermission } from "@/lib/session";
import {
  deleteItemForm,
  deleteOptionForm,
  deleteSectionForm,
  deleteTemplateForm,
  saveItemForm,
  saveOptionForm,
  saveSectionForm,
  saveTemplateForm,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 4 — ตั้งค่ารายการที่ตรวจ
 *
 * โครงเป็น 4 ชั้น: แบบฟอร์ม → หมวด → รายการ → ตัวเลือก
 * เปิดทีละแบบฟอร์ม (?tab=<รหัส>) เพราะเปิดพร้อมกันทั้งหมดจะยาวเกินไปจนหาไม่เจอ
 */
export default async function InspectionSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string; err?: string }>;
}) {
  await requirePermission("INSP_SETUP", "read");
  const params = await searchParams;

  const [forms, canWrite, canDelete] = await Promise.all([
    listForms(true),
    checkPermission("INSP_SETUP", "write"),
    checkPermission("INSP_SETUP", "delete"),
  ]);

  const active = forms.find((f) => f.template.code === params.tab) ?? forms[0] ?? null;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">4. ตั้งค่ารายการตรวจ</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม/ลด/แก้หมวด รายการ ตัวเลือก คะแนน และค่าปรับได้เอง —
          ปิด “ใช้งาน” เพื่อซ่อนออกจากใบตรวจใหม่โดยที่ใบเก่ายังอ่านได้เหมือนเดิม
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {!canWrite && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีนี้ดูค่าที่ตั้งไว้ได้อย่างเดียว การแก้ไขเปิดให้เฉพาะผู้ดูแลระบบและผู้ช่วยผู้ดูแลระบบ
        </p>
      )}

      {/* ---------- แถบเลือกแบบฟอร์ม ---------- */}
      <div className="flex flex-wrap gap-2">
        {forms.map((f) => (
          <Link
            key={f.template.id}
            href={`/inspection/setup?tab=${f.template.code}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active?.template.id === f.template.id
                ? "bg-brand-600 font-medium text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.template.name}
            {!f.template.is_active && " (ปิดใช้งาน)"}
          </Link>
        ))}
      </div>

      {/* ---------- เพิ่มแบบฟอร์มใหม่ ---------- */}
      {canWrite && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-800">
            + เพิ่มแบบฟอร์มตรวจใหม่
          </summary>
          <form action={saveTemplateForm} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">รหัสแบบฟอร์ม *</label>
              <input name="code" className="input" placeholder="MC" required />
            </div>
            <div>
              <label className="label">ชื่อแบบฟอร์ม *</label>
              <input name="name" className="input" placeholder="ตรวจสอบสาขา มอเตอร์ไซค์" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">คำอธิบาย</label>
              <input name="description" className="input" />
            </div>
            <div>
              <label className="label">ได้เงินรางวัลเมื่อคะแนนถึง</label>
              <input name="bonus_threshold" type="number" step="0.5" className="input" placeholder="60" />
            </div>
            <div>
              <label className="label">เงินรางวัล (บาท)</label>
              <input name="bonus_amount" type="number" step="1" className="input" placeholder="300" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ข้อความท้ายใบ</label>
              <textarea name="footer_note" rows={2} className="input" />
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="label">ลำดับ</label>
                <input name="sort_order" type="number" defaultValue={100} className="input w-24" />
              </div>
              <label className="flex items-center gap-1 pb-2 text-sm text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
                ใช้งาน
              </label>
              <button type="submit" className="btn-primary mb-1">
                เพิ่มแบบฟอร์ม
              </button>
            </div>
          </form>
        </details>
      )}

      {!active ? (
        <p className="card text-sm text-slate-600">
          ยังไม่มีแบบฟอร์มตรวจ — กด “เพิ่มแบบฟอร์มตรวจใหม่” ด้านบนเพื่อเริ่มต้น
        </p>
      ) : (
        <TemplateEditor form={active} canWrite={canWrite} canDelete={canDelete} />
      )}
    </main>
  );
}

function TemplateEditor({
  form,
  canWrite,
  canDelete,
}: {
  form: InspForm;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const t = form.template;

  return (
    <div className="space-y-4">
      {/* ---------- หัวแบบฟอร์ม ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-semibold text-slate-800">{t.name}</h2>
          <span className="text-sm text-slate-400">
            รหัส {t.code} · {form.sections.length} หมวด · คะแนนเต็ม {formatScore(form.maxScore)}
          </span>
        </div>

        <fieldset disabled={!canWrite} className="contents">
          <form action={saveTemplateForm} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="tab" value={t.code} />
            <div>
              <label className="label">รหัสแบบฟอร์ม *</label>
              <input name="code" defaultValue={t.code} className="input" required />
            </div>
            <div>
              <label className="label">ชื่อแบบฟอร์ม *</label>
              <input name="name" defaultValue={t.name} className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">คำอธิบาย</label>
              <input name="description" defaultValue={t.description ?? ""} className="input" />
            </div>
            <div>
              <label className="label">ได้เงินรางวัลเมื่อคะแนนถึง</label>
              <input
                name="bonus_threshold"
                type="number"
                step="0.5"
                defaultValue={t.bonus_threshold ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">เงินรางวัล (บาท)</label>
              <input
                name="bonus_amount"
                type="number"
                step="1"
                defaultValue={t.bonus_amount}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ข้อความท้ายใบ</label>
              <textarea
                name="footer_note"
                rows={2}
                defaultValue={t.footer_note ?? ""}
                className="input"
              />
            </div>
            <div className="flex items-end gap-3 sm:col-span-2">
              <div>
                <label className="label">ลำดับ</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={t.sort_order}
                  className="input w-24"
                />
              </div>
              <label className="flex items-center gap-1 pb-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={t.is_active}
                  className="h-4 w-4"
                />
                ใช้งาน
              </label>
              {canWrite && (
                <button type="submit" className="btn-primary mb-1">
                  บันทึกแบบฟอร์ม
                </button>
              )}
            </div>
          </form>
        </fieldset>

        {canDelete && (
          <form
            action={deleteTemplateForm}
            className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
          >
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="name" value={t.name} />
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" name="confirm" className="h-4 w-4" />
              ยืนยันลบแบบฟอร์มนี้พร้อมหมวดและรายการทั้งหมด
            </label>
            <button type="submit" className="btn-danger">
              ลบแบบฟอร์ม
            </button>
          </form>
        )}
      </section>

      {/* ---------- เพิ่มหมวดใหม่ ---------- */}
      {canWrite && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-800">+ เพิ่มหมวดที่ตรวจ</summary>
          <form action={saveSectionForm} className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr_6rem_auto]">
            <input type="hidden" name="template_id" value={t.id} />
            <input type="hidden" name="tab" value={t.code} />
            <input type="hidden" name="is_active" value="1" />
            <div>
              <label className="label">รหัสหมวด *</label>
              <input name="code" className="input" placeholder={`${t.code}-14`} required />
            </div>
            <div>
              <label className="label">ชื่อหมวด *</label>
              <input name="name" className="input" placeholder="ความปลอดภัย" required />
            </div>
            <div>
              <label className="label">ลำดับ</label>
              <input name="sort_order" type="number" defaultValue={140} className="input" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary mb-1 w-full sm:w-auto">
                เพิ่ม
              </button>
            </div>
          </form>
        </details>
      )}

      {/* ---------- หมวดและรายการ ---------- */}
      {form.sections.map((section, index) => (
        <section key={section.id} className="card space-y-3">
          <fieldset disabled={!canWrite} className="contents">
            <form
              action={saveSectionForm}
              className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-3"
            >
              <input type="hidden" name="id" value={section.id} />
              <input type="hidden" name="template_id" value={t.id} />
              <input type="hidden" name="tab" value={t.code} />
              <span className="pb-2 text-lg font-bold text-slate-400">{index + 1}.</span>
              <div>
                <label className="label">รหัส</label>
                <input name="code" defaultValue={section.code} className="input w-32" required />
              </div>
              <div className="min-w-56 flex-1">
                <label className="label">ชื่อหมวด</label>
                <input name="name" defaultValue={section.name} className="input" required />
              </div>
              <div className="min-w-48 flex-1">
                <label className="label">หมายเหตุของหมวด</label>
                <input name="note" defaultValue={section.note ?? ""} className="input" />
              </div>
              <div>
                <label className="label">ลำดับ</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={section.sort_order}
                  className="input w-20"
                />
              </div>
              <label className="flex items-center gap-1 pb-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={section.is_active}
                  className="h-4 w-4"
                />
                ใช้งาน
              </label>
              <span className="pb-2 text-xs text-slate-400">
                เต็ม {formatScore(section.maxScore)} คะแนน
              </span>
              {canWrite && (
                <button type="submit" className="btn-secondary mb-1">
                  บันทึก
                </button>
              )}
            </form>
          </fieldset>

          {/* รายการในหมวด */}
          {section.items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 ${
                item.is_active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"
              }`}
            >
              <fieldset disabled={!canWrite} className="contents">
                <form action={saveItemForm} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <input type="hidden" name="tab" value={t.code} />
                  <div>
                    <label className="label">รหัส</label>
                    <input name="code" defaultValue={item.code} className="input w-32" required />
                  </div>
                  <div className="min-w-56 flex-1">
                    <label className="label">ชื่อรายการ</label>
                    <input name="name" defaultValue={item.name} className="input" required />
                  </div>
                  <div>
                    <label className="label">ชนิด</label>
                    <select
                      name="item_type"
                      defaultValue={item.item_type}
                      className="input w-44"
                      title={INSP_ITEM_TYPE_HINT[item.item_type]}
                    >
                      <option value="choice">{INSP_ITEM_TYPE_LABEL.choice}</option>
                      <option value="rating">{INSP_ITEM_TYPE_LABEL.rating}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" title="ใช้เฉพาะชนิด “ให้คะแนนเป็นระดับ”">
                      คะแนนเต็ม
                    </label>
                    <input
                      name="max_score"
                      type="number"
                      step="0.5"
                      min={0}
                      defaultValue={item.max_score}
                      className="input w-24"
                    />
                  </div>
                  <div>
                    <label className="label">ลำดับ</label>
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue={item.sort_order}
                      className="input w-20"
                    />
                  </div>
                  <label className="flex items-center gap-1 pb-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="require_photo"
                      defaultChecked={item.require_photo}
                      className="h-4 w-4"
                    />
                    ต้องแนบรูป
                  </label>
                  <label className="flex items-center gap-1 pb-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={item.is_active}
                      className="h-4 w-4"
                    />
                    ใช้งาน
                  </label>
                  {canWrite && (
                    <button type="submit" className="btn-secondary mb-1">
                      บันทึก
                    </button>
                  )}
                </form>
              </fieldset>

              {canDelete && (
                <form action={deleteItemForm} className="mt-1 flex items-center gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="name" value={item.name} />
                  <input type="hidden" name="tab" value={t.code} />
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" name="confirm" className="h-4 w-4" />
                    ยืนยัน
                  </label>
                  <button type="submit" className="btn-danger">
                    ลบรายการนี้
                  </button>
                </form>
              )}

              {/* ตัวเลือกของรายการแบบ choice */}
              {item.item_type === "choice" && (
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-500">
                    ตัวเลือก ({item.options.length}) · คะแนนเต็มของข้อนี้ = คะแนนสูงสุดของตัวเลือก ={" "}
                    {formatScore(item.maxScore)}
                  </p>

                  {item.options.map((option) => (
                    <div key={option.id} className="flex flex-wrap items-end gap-1.5">
                      <fieldset disabled={!canWrite} className="contents">
                        <form action={saveOptionForm} className="flex flex-1 flex-wrap items-end gap-1.5">
                          <input type="hidden" name="id" value={option.id} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="tab" value={t.code} />
                          <input
                            name="code"
                            defaultValue={option.code}
                            className="input w-28"
                            title="รหัสตัวเลือก"
                            required
                          />
                          <input
                            name="label"
                            defaultValue={option.label}
                            className="input min-w-56 flex-1"
                            title="ข้อความที่ผู้ตรวจเห็น"
                            required
                          />
                          <input
                            name="score"
                            type="number"
                            step="0.5"
                            min={0}
                            defaultValue={option.score}
                            className="input w-20"
                            title="คะแนนที่ได้เมื่อเลือกข้อนี้"
                          />
                          <input
                            name="fine_amount"
                            type="number"
                            step="1"
                            min={0}
                            defaultValue={option.fine_amount}
                            className="input w-24"
                            title="ค่าปรับตั้งต้น (บาท) — ผู้ตรวจแก้ได้ตอนบันทึก"
                          />
                          <input
                            name="sort_order"
                            type="number"
                            defaultValue={option.sort_order}
                            className="input w-16"
                            title="ลำดับ"
                          />
                          <label className="flex items-center gap-1 pb-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              name="is_active"
                              defaultChecked={option.is_active}
                              className="h-4 w-4"
                            />
                            ใช้
                          </label>
                          {canWrite && (
                            <button type="submit" className="btn-secondary mb-0.5">
                              บันทึก
                            </button>
                          )}
                        </form>
                      </fieldset>

                      {canDelete && (
                        <form action={deleteOptionForm}>
                          <input type="hidden" name="id" value={option.id} />
                          <input type="hidden" name="label" value={option.label} />
                          <input type="hidden" name="tab" value={t.code} />
                          <button type="submit" className="btn-danger mb-0.5">
                            ลบ
                          </button>
                        </form>
                      )}
                    </div>
                  ))}

                  {canWrite && (
                    <form action={saveOptionForm} className="flex flex-wrap items-end gap-1.5 pt-1">
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="tab" value={t.code} />
                      <input type="hidden" name="is_active" value="1" />
                      <input
                        name="code"
                        className="input w-28"
                        placeholder="รหัส"
                        required
                      />
                      <input
                        name="label"
                        className="input min-w-56 flex-1"
                        placeholder="ข้อความตัวเลือกใหม่"
                        required
                      />
                      <input
                        name="score"
                        type="number"
                        step="0.5"
                        min={0}
                        defaultValue={0}
                        className="input w-20"
                        title="คะแนน"
                      />
                      <input
                        name="fine_amount"
                        type="number"
                        step="1"
                        min={0}
                        defaultValue={0}
                        className="input w-24"
                        title="ค่าปรับ"
                      />
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={(item.options.length + 1) * 10}
                        className="input w-16"
                        title="ลำดับ"
                      />
                      <button type="submit" className="btn-primary mb-0.5">
                        + ตัวเลือก
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* เพิ่มรายการในหมวดนี้ */}
          {canWrite && (
            <form action={saveItemForm} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="section_id" value={section.id} />
              <input type="hidden" name="tab" value={t.code} />
              <input type="hidden" name="is_active" value="1" />
              <div>
                <label className="label">รหัสรายการใหม่ *</label>
                <input
                  name="code"
                  className="input w-36"
                  placeholder={`${section.code}-${section.items.length + 1}`}
                  required
                />
              </div>
              <div className="min-w-56 flex-1">
                <label className="label">ชื่อรายการ *</label>
                <input name="name" className="input" placeholder="สิ่งที่ต้องตรวจ" required />
              </div>
              <div>
                <label className="label">ชนิด</label>
                <select name="item_type" defaultValue="choice" className="input w-44">
                  <option value="choice">{INSP_ITEM_TYPE_LABEL.choice}</option>
                  <option value="rating">{INSP_ITEM_TYPE_LABEL.rating}</option>
                </select>
              </div>
              <div>
                <label className="label">คะแนนเต็ม</label>
                <input
                  name="max_score"
                  type="number"
                  step="0.5"
                  min={0}
                  defaultValue={0}
                  className="input w-24"
                />
              </div>
              <div>
                <label className="label">ลำดับ</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={(section.items.length + 1) * 10}
                  className="input w-20"
                />
              </div>
              <button type="submit" className="btn-primary mb-1">
                + เพิ่มรายการ
              </button>
            </form>
          )}

          {canDelete && (
            <form action={deleteSectionForm} className="flex items-center gap-2">
              <input type="hidden" name="id" value={section.id} />
              <input type="hidden" name="name" value={section.name} />
              <input type="hidden" name="tab" value={t.code} />
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" name="confirm" className="h-4 w-4" />
                ยืนยันลบหมวดนี้พร้อมรายการทั้งหมด {section.items.length} รายการ
              </label>
              <button type="submit" className="btn-danger">
                ลบหมวด
              </button>
            </form>
          )}
        </section>
      ))}
    </div>
  );
}

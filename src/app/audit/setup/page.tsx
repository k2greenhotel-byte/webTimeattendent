import Link from "next/link";
import {
  AUD_KIND_HINT,
  AUD_KIND_LABEL,
  AUD_USER_KINDS,
  type AudCheckKind,
} from "@/lib/audit-types";
import { listCheckTypeRows, listDocTypes } from "@/lib/audit-db";
import { checkPermission, requirePermission } from "@/lib/session";
import {
  createCheckTypeForm,
  createDocTypeForm,
  deleteCheckTypeForm,
  deleteDocTypeForm,
  updateCheckTypeForm,
  updateDocTypeForm,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 5 — ตั้งค่ารายการตรวจสอบ (ข้อ 4 ของสเปก)
 * ผู้ใช้เพิ่ม/ลด/แก้รายการที่ต้องตรวจได้เอง โดยมีโครงเดียวกับข้อ 1-3
 * (ผลตรวจ · เอกสารประกอบ · การโทรถาม · สลิปนำฝาก) เลือกเปิดเฉพาะช่องที่ต้องใช้
 */
export default async function AuditSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("AUD_SETUP", "read");
  const params = await searchParams;

  const [types, docTypes, canWrite, canEdit, canDelete] = await Promise.all([
    listCheckTypeRows(true),
    listDocTypes(true),
    checkPermission("AUD_SETUP", "write"),
    checkPermission("AUD_SETUP", "edit"),
    checkPermission("AUD_SETUP", "delete"),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">5. ตั้งค่ารายการตรวจสอบ</h1>
          <p className="text-sm text-slate-500">
            รายการตรวจ {types.length} รายการ · เอกสารประกอบ {docTypes.length} ชนิด
          </p>
        </div>
        <Link href="/audit" className="btn-secondary">
          ← กลับหน้าแรก
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>}

      {/* ---------- รายการตรวจสอบ ---------- */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">รายการที่ต้องตรวจ</h2>

        {canWrite && (
          <form action={createCheckTypeForm} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
            <h3 className="font-medium text-slate-700 sm:col-span-4">เพิ่มรายการตรวจใหม่</h3>

            <div>
              <label className="label">รหัส *</label>
              <input name="code" className="input" placeholder="STOCK" maxLength={30} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อรายการตรวจ *</label>
              <input name="name" className="input" placeholder="ตรวจนับสต็อกอะไหล่" maxLength={200} required />
            </div>
            <div>
              <label className="label">ลำดับการแสดง</label>
              <input name="sort_order" className="input" inputMode="numeric" defaultValue={100} />
            </div>

            <div className="sm:col-span-2">
              <label className="label">ชนิดของข้อมูล *</label>
              <select name="kind" className="input" defaultValue="custom">
                {AUD_USER_KINDS.map((k: AudCheckKind) => (
                  <option key={k} value={k}>
                    {AUD_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">{AUD_KIND_HINT.custom}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">คำอธิบาย</label>
              <input name="description" className="input" maxLength={300} />
            </div>

            <div>
              <label className="label">ชื่อช่องเลขที่เอกสาร</label>
              <input name="ref_label" className="input" defaultValue="เลขที่เอกสาร" maxLength={60} />
            </div>
            <div>
              <label className="label">ชื่อช่องรายละเอียด</label>
              <input name="title_label" className="input" defaultValue="รายละเอียด" maxLength={60} />
            </div>
            <div>
              <label className="label">ชื่อช่องผู้เกี่ยวข้อง</label>
              <input name="party_label" className="input" defaultValue="ผู้เกี่ยวข้อง" maxLength={60} />
            </div>

            <fieldset className="sm:col-span-4">
              <legend className="label">ช่องที่ต้องใช้ในการตรวจ</legend>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <Toggle name="has_docs" label="ตรวจเอกสารครบ / ไม่ครบ" defaultChecked />
                <Toggle name="has_call" label="โทรถามผู้เกี่ยวข้อง" defaultChecked />
                <Toggle name="has_slip" label="สลิปนำฝากเงิน + ยอดเงิน" />
                <Toggle name="has_amount" label="กรอกจำนวนเงิน" defaultChecked />
              </div>
            </fieldset>

            <div className="sm:col-span-4">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่มรายการตรวจ
              </button>
            </div>
          </form>
        )}

        {types.map((t) => (
          <form key={t.id} action={updateCheckTypeForm} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="kind" value={t.kind} />

            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-slate-800">{t.name}</h3>
              <span className="badge bg-slate-200 text-slate-600">{AUD_KIND_LABEL[t.kind]}</span>
              {t.is_builtin && <span className="badge bg-sky-100 text-sky-700">รายการตั้งต้นของระบบ</span>}
              <span className="text-xs text-slate-400">ใช้ตรวจไปแล้ว {t.use_count} ครั้ง</span>
            </div>

            <div>
              <label className="label">รหัส</label>
              <input
                name="code"
                defaultValue={t.code}
                className={`input ${t.is_builtin ? "bg-slate-50" : ""}`}
                readOnly={t.is_builtin}
                maxLength={30}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อรายการตรวจ</label>
              <input name="name" defaultValue={t.name} className="input" maxLength={200} disabled={!canEdit} />
            </div>
            <div>
              <label className="label">ลำดับ</label>
              <input
                name="sort_order"
                defaultValue={t.sort_order}
                className="input"
                inputMode="numeric"
                disabled={!canEdit}
              />
            </div>

            <div className="sm:col-span-4">
              <label className="label">คำอธิบาย</label>
              <input
                name="description"
                defaultValue={t.description ?? ""}
                className="input"
                maxLength={300}
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className="label">ชื่อช่องเลขที่เอกสาร</label>
              <input name="ref_label" defaultValue={t.ref_label} className="input" maxLength={60} disabled={!canEdit} />
            </div>
            <div>
              <label className="label">ชื่อช่องรายละเอียด</label>
              <input name="title_label" defaultValue={t.title_label} className="input" maxLength={60} disabled={!canEdit} />
            </div>
            <div>
              <label className="label">ชื่อช่องผู้เกี่ยวข้อง</label>
              <input name="party_label" defaultValue={t.party_label} className="input" maxLength={60} disabled={!canEdit} />
            </div>

            <fieldset className="sm:col-span-4" disabled={!canEdit}>
              <legend className="label">ช่องที่ต้องใช้ในการตรวจ</legend>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <Toggle name="has_docs" label="ตรวจเอกสารครบ / ไม่ครบ" defaultChecked={t.has_docs} />
                <Toggle name="has_call" label="โทรถามผู้เกี่ยวข้อง" defaultChecked={t.has_call} />
                <Toggle name="has_slip" label="สลิปนำฝากเงิน + ยอดเงิน" defaultChecked={t.has_slip} />
                <Toggle name="has_amount" label="กรอกจำนวนเงิน" defaultChecked={t.has_amount} />
                <Toggle name="is_active" label="เปิดใช้งาน" defaultChecked={t.is_active} />
              </div>
            </fieldset>

            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
              {canEdit && (
                <button type="submit" className="btn-primary">
                  บันทึก
                </button>
              )}
              {canDelete && !t.is_builtin && (
                <span className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" name="confirm" form={`del-${t.id}`} className="h-4 w-4" />
                    ยืนยันลบ
                  </label>
                  <button type="submit" form={`del-${t.id}`} className="btn-danger">
                    ลบรายการตรวจ
                  </button>
                </span>
              )}
            </div>
          </form>
        ))}

        {/* ฟอร์มลบแยกออกมา เพราะ HTML ซ้อนฟอร์มไม่ได้ */}
        {canDelete &&
          types
            .filter((t) => !t.is_builtin)
            .map((t) => (
              <form key={`del-${t.id}`} id={`del-${t.id}`} action={deleteCheckTypeForm} className="hidden">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="name" value={t.name} />
              </form>
            ))}
      </section>

      {/* ---------- ทะเบียนเอกสารประกอบ ---------- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">ทะเบียนเอกสารประกอบ</h2>
          <p className="text-sm text-slate-500">
            รายการนี้จะขึ้นเป็นช่องติ๊ก “ขาดเอกสารอะไรบ้าง” ตอนลงผลตรวจ
          </p>
        </div>

        {canWrite && (
          <form action={createDocTypeForm} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">รหัส *</label>
              <input name="code" className="input" placeholder="INSURE" maxLength={30} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อเอกสาร *</label>
              <input name="name" className="input" placeholder="กรมธรรม์ประกันภัย" maxLength={200} required />
            </div>
            <div>
              <label className="label">ลำดับ</label>
              <input name="sort_order" className="input" inputMode="numeric" defaultValue={100} />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                เพิ่มเอกสาร
              </button>
            </div>
          </form>
        )}

        <div className="card space-y-2">
          {docTypes.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีเอกสารในทะเบียน</p>}

          {docTypes.map((d) => (
            <div key={d.id} className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-2 last:border-0">
              <form action={updateDocTypeForm} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={d.id} />
                <div className="w-28">
                  <label className="label">รหัส</label>
                  <input name="code" defaultValue={d.code} className="input" maxLength={30} disabled={!canEdit} />
                </div>
                <div className="min-w-48 flex-1">
                  <label className="label">ชื่อเอกสาร</label>
                  <input name="name" defaultValue={d.name} className="input" maxLength={200} disabled={!canEdit} />
                </div>
                <div className="w-24">
                  <label className="label">ลำดับ</label>
                  <input
                    name="sort_order"
                    defaultValue={d.sort_order}
                    className="input"
                    inputMode="numeric"
                    disabled={!canEdit}
                  />
                </div>
                <label className="flex items-center gap-1 pb-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={d.is_active}
                    className="h-4 w-4"
                    disabled={!canEdit}
                  />
                  ใช้งาน
                </label>
                {canEdit && (
                  <button type="submit" className="btn-secondary">
                    บันทึก
                  </button>
                )}
              </form>

              {canDelete && (
                <form action={deleteDocTypeForm}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="name" value={d.name} />
                  <button type="submit" className="btn-danger">
                    ลบ
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-slate-500">
        สิทธิ์เข้าถึงแต่ละเมนูของโปรแกรมนี้ (อ่าน / เพิ่ม / แก้ไข / ลบ) กำหนดที่ระบบส่วนกลาง —
        เมนู “กำหนดสิทธิ์ผู้ใช้งาน” และ “กำหนดผู้ใช้งานโปรแกรม” ที่{" "}
        <Link href="/core" className="text-brand-700 hover:underline">
          /core
        </Link>
      </p>
    </main>
  );
}

function Toggle({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

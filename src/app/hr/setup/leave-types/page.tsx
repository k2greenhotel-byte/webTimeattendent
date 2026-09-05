import { listLeaveTypes } from "@/lib/leave-db";
import type { LeaveType } from "@/lib/leave-types";
import { checkPermission, requirePermission } from "@/lib/session";
import { createLeaveTypeForm, deleteLeaveTypeForm, updateLeaveTypeForm } from "./actions";

export const dynamic = "force-dynamic";

/** ช่องกรอกเงื่อนไขทั้งชุด ใช้ร่วมกันทั้งฟอร์มเพิ่มใหม่และฟอร์มแก้ไข */
function TypeFields({ type }: { type?: LeaveType }) {
  const v = type;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-1">
          <label className="label">รหัส *</label>
          <input name="code" defaultValue={v?.code ?? ""} className="input" required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ชื่อประเภท *</label>
          <input name="name" defaultValue={v?.name ?? ""} className="input" required />
        </div>
        <div className="sm:col-span-1">
          <label className="label">ไอคอน</label>
          <input name="icon" defaultValue={v?.icon ?? ""} className="input" placeholder="🌴" />
        </div>
        <div className="sm:col-span-1">
          <label className="label">ลำดับ</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={v?.sort_order ?? 0}
            className="input"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="label">โควตา (วัน/ปี)</label>
          <input
            name="max_days_per_year"
            type="number"
            min="0"
            defaultValue={v?.max_days_per_year ?? ""}
            className="input"
            placeholder="ไม่จำกัด"
          />
        </div>
      </div>

      <div>
        <label className="label">คำอธิบายสิทธิ์</label>
        <input
          name="description"
          defaultValue={v?.description ?? ""}
          className="input"
          placeholder="อธิบายสั้น ๆ ว่าสิทธิ์นี้ใช้ตอนไหน"
        />
      </div>

      <div>
        <label className="label">เงื่อนไขการใช้สิทธิ์ (แสดงให้พนักงานอ่านตอนยื่น)</label>
        <textarea
          name="conditions"
          rows={4}
          defaultValue={v?.conditions ?? ""}
          className="input"
          placeholder={"• ต้องแจ้งล่วงหน้าอย่างน้อย 3 วัน\n• ต้องมีอายุงานครบ 1 ปี"}
        />
        <p className="mt-1 text-xs text-slate-500">
          ข้อความนี้เป็นคำอธิบายให้คนอ่าน · ตัวเลขที่ระบบใช้ตัดสินจริงคือช่องด้านล่าง
          แก้ทั้งสองที่ให้ตรงกันด้วย
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <label className="label">แจ้งล่วงหน้า (วัน)</label>
          <input
            name="advance_days"
            type="number"
            min="0"
            defaultValue={v?.advance_days ?? 0}
            className="input"
          />
        </div>
        <div>
          <label className="label">อายุงานขั้นต่ำ (เดือน)</label>
          <input
            name="min_service_months"
            type="number"
            min="0"
            defaultValue={v?.min_service_months ?? 0}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">12 = ครบ 1 ปี</p>
        </div>
        <div>
          <label className="label">ต้องแจ้งก่อนเวลา</label>
          <input
            name="same_day_cutoff"
            type="time"
            defaultValue={v?.same_day_cutoff?.slice(0, 5) ?? ""}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">เว้นว่าง = ไม่มีเวลาตัด</p>
        </div>
        <div>
          <label className="label">แจ้งช้า หักกี่เท่า</label>
          <input
            name="late_penalty_multiplier"
            type="number"
            min="0"
            step="0.5"
            defaultValue={v?.late_penalty_multiplier ?? 0}
            className="input"
          />
        </div>
        <div>
          <label className="label">ส่งใบรับรองแพทย์ภายใน (วัน)</label>
          <input
            name="cert_within_days"
            type="number"
            min="0"
            defaultValue={v?.cert_within_days ?? 3}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="late_becomes_absent"
            defaultChecked={v?.late_becomes_absent ?? false}
          />
          แจ้งล่วงหน้าไม่ครบ = ถือว่าขาดงาน
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="require_medical_cert"
            defaultChecked={v?.require_medical_cert ?? false}
          />
          ต้องแนบใบรับรองแพทย์
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_paid" defaultChecked={v?.is_paid ?? true} />
          ได้รับค่าจ้างระหว่างลา
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="needs_date_range"
            defaultChecked={v?.needs_date_range ?? true}
          />
          ให้ระบุช่วงวันที่ลา
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="needs_arrival_time"
            defaultChecked={v?.needs_arrival_time ?? false}
          />
          ให้ระบุเวลาที่จะมาถึง (ใช้กับแจ้งเข้างานสาย)
        </label>
        {v && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked={v.is_active} />
            เปิดใช้งาน
          </label>
        )}
      </div>
    </>
  );
}

export default async function LeaveTypeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("HR_TYPES", "read");
  const params = await searchParams;

  const [types, canEdit, canDelete] = await Promise.all([
    listLeaveTypes(),
    checkPermission("HR_TYPES", "edit"),
    checkPermission("HR_TYPES", "delete"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่าประเภทการลาและเงื่อนไขการใช้สิทธิ์</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม/แก้ประเภทการลาได้เองโดยไม่ต้องแก้ระบบ · เงื่อนไขที่แก้จะมีผลกับใบที่ยื่นหลังจากนี้
          ใบเก่ายังใช้เงื่อนไขเดิมที่บันทึกไว้ตอนยื่น
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- เพิ่มประเภทใหม่ ---------- */}
      <form action={createLeaveTypeForm} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เพิ่มประเภทการลาใหม่</h2>
        <TypeFields />
        <button type="submit" className="btn-primary w-full sm:w-auto">
          เพิ่มประเภทการลา
        </button>
      </form>

      {/* ---------- แก้ไขประเภทที่มีอยู่ ---------- */}
      {types.map((type) => (
        <form key={type.id} action={updateLeaveTypeForm} className="card space-y-3">
          <input type="hidden" name="id" value={type.id} />
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold text-slate-800">
              {type.icon} {type.name}
              <span className="ml-2 text-xs font-normal text-slate-400">{type.code}</span>
            </h2>
            {!type.is_active && <span className="badge bg-slate-100 text-slate-500">ปิดใช้งาน</span>}
          </div>

          <TypeFields type={type} />

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={!canEdit}>
              บันทึก
            </button>
            {canDelete && (
              <>
                <label className="flex items-center gap-2 text-sm text-rose-700">
                  <input type="checkbox" name="confirm" />
                  ยืนยันการลบ
                </label>
                <button
                  type="submit"
                  formAction={deleteLeaveTypeForm}
                  className="btn-secondary text-rose-600"
                >
                  ลบประเภทนี้
                </button>
              </>
            )}
          </div>
        </form>
      ))}
    </main>
  );
}

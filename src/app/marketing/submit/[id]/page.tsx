import Link from "next/link";
import { notFound } from "next/navigation";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { FlowBadge, PhotoStrip } from "@/components/marketing/StatusBadge";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { canSubmit, formatBaht } from "@/lib/marketing";
import {
  getActivityRow,
  getStaffIdForEmployee,
  getSubmission,
  listActivityPhotos,
  listMaster,
} from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { saveSubmissionForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function SubmitFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const activity = await getActivityRow(id);
  if (!activity) notFound();

  const user = await requireUser();
  const [submission, photos, staff, defaultStaffId] = await Promise.all([
    getSubmission(id),
    listActivityPhotos(id),
    listMaster("staff"),
    getStaffIdForEmployee(user.id),
  ]);

  const gate = canSubmit(activity);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">บันทึกส่งเรื่องเบิกเงิน</h1>
          <p className="text-sm text-slate-500">
            ใบกิจกรรม {activity.doc_no} ·{" "}
            <Link href={`/marketing/activities/${id}`} className="text-brand-600 hover:underline">
              ดูใบกิจกรรม
            </Link>
          </p>
        </div>
        <FlowBadge status={activity.flow_status} />
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {/* ---------- ข้อมูลจากหน้าจอ 1 (อ่านอย่างเดียว) ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ข้อมูลกิจกรรม</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Item label="เลขที่" value={activity.doc_no} />
          <Item label="วันที่" value={formatThaiDate(activity.activity_date)} />
          <Item label="ผู้บันทึกจัดทำ" value={activity.created_by_name ?? "-"} />
          <Item label="ชื่อกิจกรรม" value={activity.title} className="sm:col-span-2" />
          <Item label="ประเภทกิจกรรม" value={activity.activity_type_name ?? "-"} />
          <Item label="บริษัทที่ขอเบิก" value={activity.company_name ?? "-"} />
          <Item label="จำนวนเงินที่ขอเบิก" value={`${formatBaht(activity.request_amount)} บาท`} />
          <Item label="จำนวนเงินที่อนุมัติเบิก" value={`${formatBaht(activity.approved_amount)} บาท`} />
          {activity.memo && <Item label="รายละเอียด" value={activity.memo} className="sm:col-span-3" />}
        </dl>
        <PhotoStrip paths={photos.map((p) => p.path)} empty="ไม่มีรูปกิจกรรมแนบไว้" />
      </section>

      {!gate.ok ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{gate.reason}</p>
      ) : (
        <form action={saveSubmissionForm} className="card space-y-4">
          <h2 className="font-semibold text-slate-800">ข้อมูลการส่งเบิก</h2>
          <input type="hidden" name="activity_id" value={id} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">ผู้บันทึกส่งเบิก</label>
              <select
                name="submitted_by_staff_id"
                className="input"
                defaultValue={submission?.submitted_by_staff_id ?? defaultStaffId ?? ""}
              >
                <option value="">— เลือกพนักงาน —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">วันที่ส่งเบิกเงิน *</label>
              <input
                type="date"
                name="submit_date"
                className="input"
                defaultValue={submission?.submit_date ?? workDateOf()}
                required
              />
            </div>
            <div>
              <label className="label">เลขที่ไปรษณีย์</label>
              <input
                name="postal_no"
                className="input"
                defaultValue={submission?.postal_no ?? ""}
                placeholder="EX123456789TH"
              />
            </div>

            <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
              <PhotoUploader
                name="letter_photo_path"
                label="รูปถ่ายจดหมายที่ส่งเบิกเงิน"
                max={1}
                prefix="letter"
                initialPaths={submission?.letter_photo_path ? [submission.letter_photo_path] : []}
                hint="ถ่ายจากมือถือได้เลย"
              />
              <PhotoUploader
                name="ack_photo_path"
                label="รูปถ่ายใบลงทะเบียนตอบรับไปรษณีย์"
                max={1}
                prefix="ack"
                initialPaths={submission?.ack_photo_path ? [submission.ack_photo_path] : []}
              />
            </div>

            <input type="hidden" name="active_status" value={submission?.active_status ?? "active"} />
          </div>

          <p className="text-sm text-slate-500">
            เมื่อบันทึก สถานะของใบกิจกรรมจะเปลี่ยนเป็น <strong>ส่งเบิกแล้ว</strong> อัตโนมัติ
          </p>

          <button type="submit" className="btn-primary">
            บันทึกการส่งเบิก
          </button>
        </form>
      )}
    </main>
  );
}

function Item({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

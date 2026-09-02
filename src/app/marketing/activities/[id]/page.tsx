import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityForm from "@/components/marketing/ActivityForm";
import { FlowBadge, PhotoStrip } from "@/components/marketing/StatusBadge";
import { formatThaiDate } from "@/lib/datetime";
import { canReceive, canSubmit, formatBaht, outstandingAmount } from "@/lib/marketing";
import {
  getActivityRow,
  getStaffIdForEmployee,
  listActivityPhotos,
  listMaster,
} from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { deleteActivityForm, updateActivityForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({
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
  const [photos, staff, companies, activityTypes, defaultStaffId] = await Promise.all([
    listActivityPhotos(id),
    listMaster("staff"),
    listMaster("company"),
    listMaster("activityType"),
    getStaffIdForEmployee(user.id),
  ]);

  const submitGate = canSubmit(activity);
  const receiveGate = canReceive(activity);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบกิจกรรม {activity.doc_no}</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(activity.activity_date)} · {activity.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FlowBadge status={activity.flow_status} />
          <Link href="/marketing/activities" className="btn-secondary">
            กลับไปรายการ
          </Link>
        </div>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <div className="card grid gap-3 sm:grid-cols-4">
        <Figure label="ขอเบิก" value={formatBaht(activity.request_amount)} />
        <Figure label="อนุมัติเบิก" value={formatBaht(activity.approved_amount)} />
        <Figure
          label="ได้รับโอน"
          value={
            activity.receipt_status === "cancelled" ? "-" : formatBaht(activity.received_amount)
          }
        />
        <Figure label="คงค้าง" value={formatBaht(outstandingAmount(activity))} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={submitGate.ok ? `/marketing/submit/${id}` : "#"}
          aria-disabled={!submitGate.ok}
          className={submitGate.ok ? "btn-secondary" : "btn-secondary pointer-events-none opacity-50"}
        >
          ไปหน้าส่งเรื่องเบิกเงิน
        </Link>
        <Link
          href={receiveGate.ok ? `/marketing/receive/${id}` : "#"}
          aria-disabled={!receiveGate.ok}
          className={receiveGate.ok ? "btn-secondary" : "btn-secondary pointer-events-none opacity-50"}
        >
          ไปหน้าบันทึกรับเงิน
        </Link>
        {!receiveGate.ok && <p className="self-center text-xs text-slate-500">{receiveGate.reason}</p>}
      </div>

      <ActivityForm
        action={updateActivityForm}
        activity={activity}
        photos={photos.map((p) => p.path)}
        staff={staff}
        companies={companies}
        activityTypes={activityTypes}
        defaultStaffId={defaultStaffId}
      />

      {activity.submission_id && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ข้อมูลการส่งเรื่องเบิกเงิน</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <Item label="ผู้บันทึกส่งเบิก" value={activity.submitted_by_name ?? "-"} />
            <Item
              label="วันที่ส่งเบิก"
              value={activity.submit_date ? formatThaiDate(activity.submit_date) : "-"}
            />
            <Item label="เลขที่ไปรษณีย์" value={activity.postal_no ?? "-"} />
          </dl>
          <PhotoStrip
            paths={[activity.letter_photo_path, activity.ack_photo_path].filter(
              (p): p is string => Boolean(p),
            )}
          />
        </section>
      )}

      {activity.receipt_id && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ข้อมูลการรับเงิน</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            <Item label="ผู้บันทึกรับเงิน" value={activity.received_by_name ?? "-"} />
            <Item
              label="วันที่รับเงิน"
              value={activity.receive_date ? formatThaiDate(activity.receive_date) : "-"}
            />
            <Item label="เลขที่ใบเสร็จ" value={activity.receipt_no ?? "-"} />
            <Item label="จำนวนเงินที่ได้รับ" value={formatBaht(activity.received_amount)} />
          </dl>
        </section>
      )}

      <form action={deleteActivityForm} className="card space-y-3 border-rose-200">
        <h2 className="font-semibold text-rose-700">ลบใบกิจกรรมนี้</h2>
        <p className="text-sm text-slate-600">
          จะลบข้อมูลการส่งเบิก การรับเงิน และรูปแนบทั้งหมด ({photos.length} รูป) ออกถาวร ย้อนกลับไม่ได้
        </p>
        <input type="hidden" name="id" value={activity.id} />
        <input type="hidden" name="doc_no" value={activity.doc_no} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="confirm" className="h-4 w-4" />
          ยืนยันว่าต้องการลบใบกิจกรรม {activity.doc_no}
        </label>
        <button type="submit" className="btn-danger">
          ลบถาวร
        </button>
      </form>
    </main>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

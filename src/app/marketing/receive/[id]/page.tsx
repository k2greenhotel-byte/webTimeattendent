import Link from "next/link";
import { notFound } from "next/navigation";
import { FlowBadge } from "@/components/marketing/StatusBadge";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { canReceive, expectedAmount, formatBaht, outstandingAmount } from "@/lib/marketing";
import { getActivityRow, getReceipt, getStaffIdForEmployee, listMaster } from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { saveReceiptForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReceiveFormPage({
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
  const [receipt, staff, defaultStaffId] = await Promise.all([
    getReceipt(id),
    listMaster("staff"),
    getStaffIdForEmployee(user.id),
  ]);
  const gate = canReceive(activity);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">บันทึกรับเงิน</h1>
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

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ข้อมูลกิจกรรมและการส่งเบิก</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Item label="วันที่จัดกิจกรรม" value={formatThaiDate(activity.activity_date)} />
          <Item label="ชื่อกิจกรรม" value={activity.title} className="sm:col-span-2" />
          <Item label="บริษัทที่ขอเบิก" value={activity.company_name ?? "-"} />
          <Item label="ผู้บันทึกส่งเบิก" value={activity.submitted_by_name ?? "-"} />
          <Item
            label="วันที่ส่งเบิก"
            value={activity.submit_date ? formatThaiDate(activity.submit_date) : "-"}
          />
          <Item label="เลขที่ไปรษณีย์" value={activity.postal_no ?? "-"} />
          <Item label="ขอเบิก" value={`${formatBaht(activity.request_amount)} บาท`} />
          <Item label="อนุมัติเบิก" value={`${formatBaht(activity.approved_amount)} บาท`} />
          <Item label="ยอดคงค้าง" value={`${formatBaht(outstandingAmount(activity))} บาท`} />
        </dl>
      </section>

      {!gate.ok ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {gate.reason} ·{" "}
          <Link href={`/marketing/submit/${id}`} className="font-medium underline">
            ไปหน้าส่งเรื่องเบิกเงิน
          </Link>
        </p>
      ) : (
        <form action={saveReceiptForm} className="card space-y-4">
          <h2 className="font-semibold text-slate-800">ข้อมูลการรับเงิน</h2>
          <input type="hidden" name="activity_id" value={id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">ผู้บันทึกรับเงิน</label>
              <select
                name="received_by_staff_id"
                className="input"
                defaultValue={receipt?.received_by_staff_id ?? defaultStaffId ?? ""}
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
              <label className="label">วันที่รับเงิน *</label>
              <input
                type="date"
                name="receive_date"
                className="input"
                defaultValue={receipt?.receive_date ?? workDateOf()}
                required
              />
            </div>
            <div>
              <label className="label">เลขที่ใบเสร็จ</label>
              <input
                name="receipt_no"
                className="input"
                defaultValue={receipt?.receipt_no ?? ""}
                placeholder="RC-0001"
              />
            </div>
            <div>
              <label className="label">จำนวนเงินที่ได้รับ (บาท) *</label>
              <input
                name="received_amount"
                className="input text-right"
                inputMode="decimal"
                defaultValue={
                  receipt ? String(receipt.received_amount) : String(expectedAmount(activity))
                }
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                ค่าเริ่มต้นคือยอดที่ควรได้รับ แก้ได้ถ้าโอนมาไม่เต็มจำนวน
              </p>
            </div>

            <input type="hidden" name="active_status" value={receipt?.active_status ?? "active"} />
          </div>

          <p className="text-sm text-slate-500">
            เมื่อบันทึก สถานะของใบกิจกรรมจะเปลี่ยนเป็น <strong>รับเงินแล้ว</strong> อัตโนมัติ
          </p>

          <button type="submit" className="btn-primary">
            บันทึกการรับเงิน
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

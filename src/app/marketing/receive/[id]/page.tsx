import Link from "next/link";
import { notFound } from "next/navigation";
import { FlowBadge } from "@/components/marketing/StatusBadge";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import {
  canReceive,
  expectedAmount,
  formatBaht,
  netReceived,
  outstandingAmount,
  remainingToReceive,
} from "@/lib/marketing";
import { getActivityRow, getStaffIdForEmployee, listMaster, listReceipts } from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { addReceiptForm, deleteReceiptForm, settleShortForm } from "../actions";

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
  const [receipts, staff, defaultStaffId] = await Promise.all([
    listReceipts(id),
    listMaster("staff"),
    getStaffIdForEmployee(user.id),
  ]);

  const gate = canReceive(activity);
  const expected = expectedAmount(activity);
  const remaining = remainingToReceive(activity);
  const net = netReceived(activity);
  const activeReceipts = receipts.filter((r) => r.active_status === "active");

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

      {/* ---------- ข้อมูลจากหน้าจอ 1 และ 2 ---------- */}
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
          <Item label="ขอเบิก" value={`${formatBaht(activity.request_amount)} บาท`} />
          <Item label="อนุมัติเบิก" value={`${formatBaht(activity.approved_amount)} บาท`} />
          <Item label="ยอดที่ควรได้รับ" value={`${formatBaht(expected)} บาท`} />
        </dl>
      </section>

      {/* ---------- สรุปยอดเงิน ---------- */}
      <section className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="รับแล้ว (ก่อนหักภาษี)" value={formatBaht(activity.received_amount)} />
        <Figure label="ภาษีหัก ณ ที่จ่าย" value={formatBaht(activity.wht_amount)} />
        <Figure label="เงินเข้าบัญชีจริง" value={formatBaht(net)} tone="emerald" />
        <Figure
          label={activity.settled_short ? "ถูกตัดเงิน (ปิดยอดแล้ว)" : "ยังค้างรับ"}
          value={formatBaht(
            activity.settled_short ? Math.max(0, expected - activity.received_amount) : remaining,
          )}
          tone={activity.settled_short ? "violet" : remaining > 0 ? "rose" : "slate"}
        />
      </section>

      {activity.settled_short && (
        <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
          ใบนี้ปิดยอดแล้วเพราะบริษัทรถตัดเงิน — ไม่นับเป็นยอดค้างอีกต่อไป
          {activity.settled_note ? ` · เหตุผล: ${activity.settled_note}` : ""}
        </p>
      )}

      {/* ---------- งวดที่รับมาแล้ว ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          งวดที่รับเงินแล้ว{" "}
          <span className="font-normal text-slate-400">({activeReceipts.length} งวด)</span>
        </h2>

        {activeReceipts.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีการรับเงิน</p>
        ) : (
          <div className="table-wrap">
            <table className="table-report">
              <thead>
                <tr>
                  <th>งวดที่</th>
                  <th>วันที่รับเงิน</th>
                  <th>เลขที่ใบเสร็จ</th>
                  <th>ก่อนหักภาษี</th>
                  <th>ภาษีหัก ณ ที่จ่าย</th>
                  <th>เข้าบัญชีจริง</th>
                  <th>ผู้บันทึก</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeReceipts.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{formatThaiDate(r.receive_date)}</td>
                    <td>{r.receipt_no ?? "-"}</td>
                    <td className="!text-right">{formatBaht(r.received_amount)}</td>
                    <td className="!text-right">{formatBaht(r.wht_amount)}</td>
                    <td className="!text-right">{formatBaht(netReceived(r))}</td>
                    <td>{r.received_by_name ?? "-"}</td>
                    <td>
                      <form action={deleteReceiptForm}>
                        <input type="hidden" name="activity_id" value={id} />
                        <input type="hidden" name="receipt_id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          ลบงวดนี้
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3}>รวม</td>
                  <td className="!text-right">{formatBaht(activity.received_amount)}</td>
                  <td className="!text-right">{formatBaht(activity.wht_amount)}</td>
                  <td className="!text-right">{formatBaht(net)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ---------- บันทึกรับเงินงวดใหม่ ---------- */}
      {!gate.ok ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {gate.reason}
          {activity.flow_status === "draft" && (
            <>
              {" · "}
              <Link href={`/marketing/submit/${id}`} className="font-medium underline">
                ไปหน้าส่งเรื่องเบิกเงิน
              </Link>
            </>
          )}
        </p>
      ) : (
        <form action={addReceiptForm} className="card space-y-4">
          <div>
            <h2 className="font-semibold text-slate-800">
              {activeReceipts.length === 0 ? "บันทึกการรับเงิน" : "บันทึกรับเงินงวดถัดไป"}
            </h2>
            <p className="text-sm text-slate-500">
              กรอก <strong>ยอดเต็มก่อนหักภาษี</strong> ระบบจะคำนวณเงินเข้าบัญชีจริงให้เอง
            </p>
          </div>
          <input type="hidden" name="activity_id" value={id} />
          <input type="hidden" name="active_status" value="active" />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">ผู้บันทึกรับเงิน</label>
              <select
                name="received_by_staff_id"
                className="input"
                defaultValue={defaultStaffId ?? ""}
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
                defaultValue={workDateOf()}
                required
              />
            </div>
            <div>
              <label className="label">เลขที่ใบเสร็จ</label>
              <input name="receipt_no" className="input" placeholder="RC-0001" />
            </div>
            <div>
              <label className="label">จำนวนเงินก่อนหักภาษี (บาท) *</label>
              <input
                name="received_amount"
                className="input text-right"
                inputMode="decimal"
                defaultValue={String(remaining)}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                ค่าเริ่มต้นคือยอดที่ยังค้างอยู่ แก้ได้ถ้าโอนมาไม่เต็มจำนวน
              </p>
            </div>
            <div>
              <label className="label">ภาษีหัก ณ ที่จ่าย (บาท)</label>
              <input
                name="wht_amount"
                className="input text-right"
                inputMode="decimal"
                defaultValue="0"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                ส่วนที่ถูกหักไม่นับเป็นยอดค้าง เพราะเอาไปเครดิตภาษีคืนได้
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            ถ้ารับไม่ครบ สถานะจะเป็น <strong>รับเงินบางส่วน (ค้างชำระ)</strong>{" "}
            แล้วกลับมาบันทึกงวดถัดไปได้ · ถ้ารับครบ สถานะจะเป็น <strong>รับเงินครบแล้ว</strong>
          </p>

          <button type="submit" className="btn-primary">
            บันทึกการรับเงิน
          </button>
        </form>
      )}

      {/* ---------- ปิดยอดกรณีถูกตัดเงิน ---------- */}
      {activity.active_status === "active" && (remaining > 0 || activity.settled_short) && (
        <form action={settleShortForm} className="card space-y-3 border-violet-200">
          <h2 className="font-semibold text-violet-700">
            {activity.settled_short ? "ยกเลิกการปิดยอด" : "ปิดยอด — บริษัทตัดเงิน"}
          </h2>
          <input type="hidden" name="activity_id" value={id} />
          <input type="hidden" name="settle" value={activity.settled_short ? "0" : "1"} />

          {activity.settled_short ? (
            <p className="text-sm text-slate-600">
              ถ้ากดผิด หรือบริษัทรถกลับมาจ่ายส่วนที่เหลือ ยกเลิกการปิดยอดได้
              แล้วระบบจะกลับไปคิดยอดค้าง {formatBaht(Math.max(0, expected - activity.received_amount))}{" "}
              บาทตามเดิม
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                ใช้เมื่อบริษัทรถจ่ายน้อยกว่าที่ตกลงไว้ และ<strong>จะไม่จ่ายส่วนที่เหลืออีกแล้ว</strong> —
                ยอดค้าง {formatBaht(remaining)} บาทจะถูกตัดออกจากยอดตาม
                และสถานะเปลี่ยนเป็น <strong>ได้ครบแต่ถูกตัดเงิน</strong>
              </p>
              <div>
                <label className="label">เหตุผล / หมายเหตุ</label>
                <input
                  name="settled_note"
                  className="input"
                  placeholder="เช่น บริษัทอนุมัติจริง 4,000 ตัดยอดส่วนต่างทิ้ง"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className={activity.settled_short ? "btn-secondary" : "btn-primary bg-violet-600 hover:bg-violet-700"}
          >
            {activity.settled_short ? "ยกเลิกการปิดยอด" : "ปิดยอด (ถูกตัดเงิน)"}
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

function Figure({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "rose" | "violet";
}) {
  const toneClass = {
    slate: "text-slate-800",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    violet: "text-violet-700",
  }[tone];

  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-slate-400">บาท</p>
    </div>
  );
}

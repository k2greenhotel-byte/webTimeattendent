import Link from "next/link";
import LeadStatusFields from "@/components/lead/LeadStatusFields";
import { ChanceBadge, WorkStatusBadge } from "@/components/lead/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { channelNameOf, describeVehicle, staffNameOf } from "@/lib/lead";
import type { LeadRow } from "@/lib/lead-types";
import { formatPhone } from "@/lib/phone";

/**
 * ฟอร์มบันทึกผลการติดตาม (หน้าจอ 2.1-2.7)
 * เลขที่การติดตาม (2.1) ระบบรันให้ · เลขที่ Lead (2.3) ดึงมาจากใบที่เลือก แก้ไม่ได้
 */
export default function FollowUpForm({
  lead,
  today,
  action,
}: {
  lead: LeadRow;
  today: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lead_id" value={lead.id} />

      <section className="card space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800">{lead.customer_name}</h2>
            <p className="text-sm text-slate-500">
              {lead.doc_no} · รับ Lead {formatThaiDate(lead.lead_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <ChanceBadge chance={lead.chance} />
            <WorkStatusBadge status={lead.work_status} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">เบอร์โทร</dt>
            <dd>
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="text-brand-600 hover:underline">
                  {formatPhone(lead.phone)}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">รถที่สนใจ</dt>
            <dd className="truncate">{describeVehicle(lead)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ช่องทาง</dt>
            <dd className="truncate">{channelNameOf(lead)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">พนักงานขาย</dt>
            <dd className="truncate">{staffNameOf(lead)}</dd>
          </div>
        </dl>

        {lead.note && <p className="text-xs text-slate-500">หมายเหตุ: {lead.note}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">บันทึกผลการติดตาม</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="doc_no_display">
              เลขที่การติดตาม
            </label>
            <input
              id="doc_no_display"
              value="ระบบออกให้เมื่อกดบันทึก"
              className="input bg-slate-50 text-slate-500"
              disabled
            />
          </div>

          <div>
            <label className="label" htmlFor="follow_date">
              วันที่ติดตาม *
            </label>
            <input
              id="follow_date"
              name="follow_date"
              type="date"
              required
              defaultValue={today}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="lead_no_display">
              เลขที่ Lead อ้างอิง
            </label>
            <input
              id="lead_no_display"
              value={lead.doc_no}
              className="input bg-slate-50 text-slate-500"
              disabled
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="detail">
            รายละเอียดผลการติดตาม *
          </label>
          <textarea
            id="detail"
            name="detail"
            rows={3}
            required
            className="input"
            placeholder="เช่น โทรแล้วลูกค้ารับสาย ขอดูรถวันเสาร์ / ยังไม่ตัดสินใจ รอเงินเดือนออก"
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เปลี่ยนสถานะ (ไม่เลือก = คงเดิม)</h2>
        <LeadStatusFields
          allowKeep
          defaultWorkStatus=""
          defaultChance=""
          defaultSaleContractNo={lead.sale_contract_no}
          defaultSaleDate={lead.sale_date}
          defaultNextFollowDate={lead.next_follow_date}
          minDate={lead.lead_date}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          บันทึกผลการติดตาม
        </button>
        <Link href="/leads/follow" className="btn-secondary w-full text-center sm:w-auto">
          กลับไปกระดานติดตาม
        </Link>
        <Link
          href={`/leads/leads/${lead.id}`}
          className="pb-2.5 text-sm text-slate-500 hover:underline sm:self-end"
        >
          แก้ไขข้อมูล Lead ใบนี้
        </Link>
      </div>
    </form>
  );
}

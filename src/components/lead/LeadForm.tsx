import Link from "next/link";
import CustomerPicker, { type CustomerBrief } from "@/components/booking/CustomerPicker";
import DraftRestorer from "@/components/booking/DraftRestorer";
import LeadStatusFields from "@/components/lead/LeadStatusFields";
import LeadVehiclePicker from "@/components/lead/LeadVehiclePicker";
import type { LeadRow } from "@/lib/lead-types";
import type { MotoOption } from "@/lib/moto-types";
import type { Branch } from "@/lib/types";

/** ช่องที่คอมโพเนนต์ลูกกู้ค่าเองหลังกลับมาจากหน้าข้อมูลเบื้องต้น */
const SELF_RESTORED = ["channel_id", "channel_other"];

/**
 * ฟอร์มบันทึกข้อมูล Lead (หน้าจอ 1) ใช้ร่วมกันทั้งหน้าเพิ่มใหม่และหน้าแก้ไข
 * เลขที่ (1.1) ระบบรันให้ · ชื่อพนักงาน (1.3) ดึงจากคนที่ล็อกอินอยู่ ไม่ให้แก้
 */
export default function LeadForm({
  lead,
  customer,
  branches,
  brands,
  models,
  channels,
  defaultBranchId,
  ownerName,
  today,
  action,
  submitLabel,
  cancelHref,
}: {
  lead?: LeadRow | null;
  customer?: CustomerBrief | null;
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  channels: MotoOption[];
  defaultBranchId?: string | null;
  /** ชื่อพนักงานขายเจ้าของ Lead — ใบใหม่คือคนที่ล็อกอินอยู่ */
  ownerName: string;
  today: string;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {lead && <input type="hidden" name="id" value={lead.id} />}
      <DraftRestorer skip={SELF_RESTORED} />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ข้อมูลลูกค้ามุ่งหวัง</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="doc_no_display">
              เลขที่ Lead
            </label>
            <input
              id="doc_no_display"
              value={lead?.doc_no ?? "ระบบออกให้เมื่อกดบันทึก"}
              className="input bg-slate-50 text-slate-500"
              disabled
            />
          </div>

          <div>
            <label className="label" htmlFor="lead_date">
              วันที่ *
            </label>
            <input
              id="lead_date"
              name="lead_date"
              type="date"
              required
              defaultValue={lead?.lead_date ?? today}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="owner_display">
              พนักงานขาย
            </label>
            <input
              id="owner_display"
              value={ownerName}
              className="input bg-slate-50 text-slate-500"
              disabled
            />
            <p className="mt-1 text-xs text-slate-400">ดึงจากผู้ที่ล็อกอินอยู่ แก้ไม่ได้</p>
          </div>
        </div>

        <CustomerPicker
          defaultCustomer={customer ?? null}
          defaultPhone={lead?.phone ?? null}
        />

        <LeadVehiclePicker
          brands={brands}
          models={models}
          channels={channels}
          defaults={{
            brand_id: lead?.brand_id ?? null,
            model_id: lead?.model_id ?? null,
            channel_id: lead?.channel_id ?? null,
            channel_other: lead?.channel_other ?? null,
          }}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="branch_id">
              สาขา
            </label>
            <select
              id="branch_id"
              name="branch_id"
              defaultValue={lead?.branch_id ?? defaultBranchId ?? ""}
              className="input"
            >
              <option value="">— ไม่ระบุสาขา —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="note">
              หมายเหตุ
            </label>
            <input
              id="note"
              name="note"
              defaultValue={lead?.note ?? ""}
              className="input"
              placeholder="เช่น ขอราคาผ่อน 36 งวด / ให้โทรหลัง 18.00 น."
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">สถานะและโอกาสการขาย</h2>
        <LeadStatusFields
          defaultWorkStatus={lead?.work_status ?? "follow_up"}
          defaultChance={lead?.chance ?? "medium"}
          defaultNextFollowDate={lead?.next_follow_date ?? null}
          defaultSaleContractNo={lead?.sale_contract_no ?? null}
          defaultSaleDate={lead?.sale_date ?? null}
          minDate={lead?.lead_date ?? today}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href={cancelHref} className="btn-secondary w-full text-center sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

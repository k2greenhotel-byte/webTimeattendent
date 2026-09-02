import { workDateOf } from "@/lib/datetime";
import { MAX_ACTIVITY_PHOTOS, type MktActivityRow, type MktOption } from "@/lib/marketing-types";
import PhotoUploader from "./PhotoUploader";

type Props = {
  action: (form: FormData) => Promise<void>;
  activity?: MktActivityRow;
  photos?: string[];
  staff: MktOption[];
  companies: MktOption[];
  activityTypes: MktOption[];
};

/** ฟอร์มบันทึกงานกิจกรรม (หน้าจอ 1) — ใช้ร่วมกันทั้งตอนเพิ่มใหม่และตอนแก้ไข */
export default function ActivityForm({
  action,
  activity,
  photos = [],
  staff,
  companies,
  activityTypes,
}: Props) {
  const isEdit = Boolean(activity);

  return (
    <form action={action} className="card space-y-4">
      {activity && <input type="hidden" name="id" value={activity.id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">เลขที่</label>
          <input
            className="input bg-slate-50 text-slate-500"
            value={activity?.doc_no ?? "ระบบออกให้อัตโนมัติเมื่อบันทึก"}
            readOnly
          />
        </div>
        <div>
          <label className="label">วันที่ *</label>
          <input
            type="date"
            name="activity_date"
            className="input"
            defaultValue={activity?.activity_date ?? workDateOf()}
            required
          />
        </div>
        <div>
          <label className="label">ผู้บันทึกจัดทำ</label>
          <select name="created_by_staff_id" className="input" defaultValue={activity?.created_by_staff_id ?? ""}>
            <option value="">— เลือกพนักงาน —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">ชื่อกิจกรรม *</label>
          <input
            name="title"
            className="input"
            defaultValue={activity?.title ?? ""}
            placeholder="ออกบูธแสดงรถ ห้างเซ็นทรัล สาขา..."
            required
          />
        </div>
        <div>
          <label className="label">ประเภทกิจกรรม</label>
          <select name="activity_type_id" className="input" defaultValue={activity?.activity_type_id ?? ""}>
            <option value="">— เลือกประเภท —</option>
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">บริษัทที่ขอเบิก</label>
          <select name="company_id" className="input" defaultValue={activity?.company_id ?? ""}>
            <option value="">— เลือกบริษัท —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">จำนวนเงินที่ขอเบิก (บาท)</label>
          <input
            name="request_amount"
            className="input text-right"
            inputMode="decimal"
            defaultValue={activity ? String(activity.request_amount) : ""}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">จำนวนเงินที่อนุมัติเบิก (บาท)</label>
          <input
            name="approved_amount"
            className="input text-right"
            inputMode="decimal"
            defaultValue={activity?.approved_amount != null ? String(activity.approved_amount) : ""}
            placeholder="เว้นว่างถ้ายังไม่อนุมัติ"
          />
        </div>

        <div>
          <label className="label">จำนวนเงินที่ได้รับโอน (บาท)</label>
          <input
            className="input bg-slate-50 text-right text-slate-500"
            value={activity?.received_amount != null ? String(activity.received_amount) : "-"}
            readOnly
          />
          <p className="mt-1 text-xs text-slate-500">มาจากหน้าจอ 3 บันทึกรับเงิน</p>
        </div>
        <div>
          <label className="label">สถานะเอกสาร</label>
          <select name="active_status" className="input" defaultValue={activity?.active_status ?? "active"}>
            <option value="active">ใช้งาน</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        <div>
          <label className="label">สถานะการเบิก</label>
          <input
            className="input bg-slate-50 text-slate-500"
            value={
              activity
                ? { draft: "ทำเรื่องตั้งเบิก", submitted: "ส่งเบิกแล้ว", received: "รับเงินแล้ว" }[
                    activity.flow_status
                  ]
                : "ทำเรื่องตั้งเบิก"
            }
            readOnly
          />
          <p className="mt-1 text-xs text-slate-500">ระบบเปลี่ยนให้เองตามหน้าจอ 2 และ 3</p>
        </div>

        <div className="sm:col-span-3">
          <label className="label">รายละเอียด (memo)</label>
          <textarea
            name="memo"
            className="input min-h-24"
            defaultValue={activity?.memo ?? ""}
            placeholder="รายละเอียดกิจกรรม สถานที่ จำนวนผู้ร่วมงาน ฯลฯ"
          />
        </div>

        <div className="sm:col-span-3">
          <PhotoUploader
            name="photo_paths"
            label="รูปภาพกิจกรรม"
            max={MAX_ACTIVITY_PHOTOS}
            initialPaths={photos}
            prefix="activity"
            hint="เลือกได้ทีละหลายรูป ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          {isEdit ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}
        </button>
      </div>
    </form>
  );
}

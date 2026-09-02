import { workDateOf } from "@/lib/datetime";
import {
  MAX_MEMO_FILES,
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
  type MktMemoFile,
  type MktMemoRow,
  type MktOption,
} from "@/lib/marketing-types";
import FileUploader, { type UploadedFile } from "./FileUploader";

type Props = {
  action: (form: FormData) => Promise<void>;
  memo?: MktMemoRow;
  files?: MktMemoFile[];
  companies: MktOption[];
  staff: MktOption[];
  defaultStaffId?: string | null;
};

/** ฟอร์มบันทึก Memo (หน้าจอ 7) — ใช้ร่วมกันทั้งตอนเพิ่มใหม่และตอนแก้ไข */
export default function MemoForm({
  action,
  memo,
  files = [],
  companies,
  staff,
  defaultStaffId,
}: Props) {
  const isEdit = Boolean(memo);

  const initialFiles: UploadedFile[] = files.map((f) => ({
    path: f.path,
    filename: f.filename,
    mime: f.mime,
    size: f.size_bytes,
  }));

  return (
    <form action={action} className="card space-y-4">
      {memo && <input type="hidden" name="id" value={memo.id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">เลขที่</label>
          <input
            className="input bg-slate-50 text-slate-500"
            value={memo?.doc_no ?? "ระบบออกให้อัตโนมัติเมื่อบันทึก"}
            readOnly
          />
        </div>
        <div>
          <label className="label">วันที่ *</label>
          <input
            type="date"
            name="memo_date"
            className="input"
            defaultValue={memo?.memo_date ?? workDateOf()}
            required
          />
        </div>
        <div>
          <label className="label">ผู้บันทึก</label>
          <select
            name="created_by_staff_id"
            className="input"
            defaultValue={memo?.created_by_staff_id ?? defaultStaffId ?? ""}
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
          <label className="label">บริษัทที่ขอเบิก</label>
          <select name="company_id" className="input" defaultValue={memo?.company_id ?? ""}>
            <option value="">— เลือกบริษัท —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">กำหนดระยะเวลา ตั้งแต่วันที่</label>
          <input
            type="date"
            name="period_from"
            className="input"
            defaultValue={memo?.period_from ?? ""}
          />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input
            type="date"
            name="period_to"
            className="input"
            defaultValue={memo?.period_to ?? ""}
          />
        </div>

        {isEdit ? (
          <div>
            <label className="label">สถานะปัจจุบัน</label>
            <input
              className="input bg-slate-50 text-slate-500"
              value={MEMO_STATUS_LABEL[memo!.status]}
              readOnly
            />
            <p className="mt-1 text-xs text-slate-500">เปลี่ยนสถานะได้ที่ฟอร์ม “บันทึกเปลี่ยนสถานะ” ด้านบน</p>
          </div>
        ) : (
          <div>
            <label className="label">สถานะเริ่มต้น</label>
            <select name="status" className="input" defaultValue="not_requested">
              {MEMO_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {MEMO_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">สถานะเอกสาร</label>
          <select
            name="active_status"
            className="input"
            defaultValue={memo?.active_status ?? "active"}
          >
            <option value="active">ใช้งาน</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className="label">รายละเอียด Memo</label>
          <textarea
            name="detail"
            className="input min-h-32"
            defaultValue={memo?.detail ?? ""}
            placeholder="เงื่อนไขข้อตกลง วงเงินที่ได้รับอนุมัติ สิ่งที่ต้องส่งคืนบริษัท ฯลฯ"
          />
        </div>

        <div className="sm:col-span-3">
          <FileUploader
            name="files"
            label="แนบไฟล์เอกสาร / รูปภาพ / รูปถ่าย"
            max={MAX_MEMO_FILES}
            initialFiles={initialFiles}
            hint="รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ · ไฟล์ละไม่เกิน 15 MB (รูปภาพระบบย่อให้อัตโนมัติ)"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary">
        {isEdit ? "บันทึกการแก้ไข" : "บันทึก Memo"}
      </button>
    </form>
  );
}

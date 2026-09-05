"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createLeaveForm } from "@/app/hr/actions";
import FileUploader from "@/components/marketing/FileUploader";
import { addDays, formatThaiDate } from "@/lib/datetime";
import { daysInRange, evaluateLeave, formatServiceMonths } from "@/lib/leave";
import { HR_FILE_ACCEPT, MAX_LEAVE_FILES, type LeaveType } from "@/lib/leave-types";

/**
 * ฟอร์มแจ้งลา / หยุดงาน / เข้างานสาย
 *
 * ผลของเงื่อนไข (แจ้งช้าไหม · ถือเป็นขาดงานไหม · ต้องส่งใบรับรองแพทย์วันไหน) แสดงให้เห็น
 * ตั้งแต่ก่อนกดบันทึก โดยใช้ฟังก์ชันตัวเดียวกับที่ server ใช้ตัดสินจริง
 * ตัวเลขบนจอกับที่บันทึกลงฐานข้อมูลจึงตรงกันเสมอ
 *
 * หมายเหตุ: เวลาที่ใช้พรีวิวมาจาก server ตอนเปิดหน้า (ไม่ใช่นาฬิกาเครื่องผู้ใช้)
 * ส่วนเวลาที่บันทึกจริงคือเวลา server ตอนกดบันทึก
 */
export default function LeaveForm({
  types,
  today,
  serverNow,
  hireDate,
}: {
  types: LeaveType[];
  today: string;
  serverNow: string;
  hireDate: string | null;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [totalDays, setTotalDays] = useState(1);
  const [arrivalTime, setArrivalTime] = useState("");
  const [detail, setDetail] = useState("");

  const type = types.find((t) => t.id === typeId) ?? null;

  const preview = useMemo(() => {
    if (!type || !startDate) return null;
    return evaluateLeave(
      type,
      {
        typeId,
        detail,
        startDate,
        endDate: type.needs_date_range ? endDate || startDate : startDate,
        totalDays,
        arrivalTime: arrivalTime || null,
      },
      { requestDate: today, reportedAt: new Date(serverNow), hireDate },
    );
  }, [type, typeId, detail, startDate, endDate, totalDays, arrivalTime, today, serverNow, hireDate]);

  /** เลื่อนวันเริ่มแล้วให้วันสิ้นสุดตามไปด้วย ผู้ใช้จะได้ไม่ต้องกรอกซ้ำเมื่อลาวันเดียว */
  function pickStart(value: string) {
    setStartDate(value);
    if (!endDate || endDate < value) {
      setEndDate(value);
      setTotalDays(1);
    } else {
      setTotalDays(daysInRange(value, endDate));
    }
  }

  function pickEnd(value: string) {
    setEndDate(value);
    if (startDate && value >= startDate) setTotalDays(daysInRange(startDate, value));
  }

  const blocked = preview?.blocked ?? null;

  return (
    <form action={createLeaveForm} className="card space-y-4">
      {/* ---------- ข้อ 6: ประเภทการลา ---------- */}
      <div>
        <label className="label" htmlFor="type_id">
          ประเภทการลา *
        </label>
        <select
          id="type_id"
          name="type_id"
          className="input"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          required
        >
          {types.length === 0 && <option value="">— ยังไม่มีประเภทการลาที่เปิดใช้งาน —</option>}
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon ? `${t.icon} ` : ""}
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- เงื่อนไขการใช้สิทธิ์ (ข้อความจากหน้าตั้งค่า แก้ไขได้ภายหลัง) ---------- */}
      {type && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          {type.description && <p className="text-sm text-slate-700">{type.description}</p>}
          {type.conditions && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-500">เงื่อนไขการใช้สิทธิ์</p>
              <p className="whitespace-pre-line text-sm text-slate-600">{type.conditions}</p>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            อายุงานของคุณ: {formatServiceMonths(preview?.serviceMonths ?? null)}
            {type.min_service_months > 0 &&
              ` · สิทธิ์นี้ต้องมีอายุงานอย่างน้อย ${formatServiceMonths(type.min_service_months)}`}
          </p>
        </div>
      )}

      {/* ---------- ช่วงวันที่ / เวลาที่จะมาถึง ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="start_date">
            {type?.needs_arrival_time ? "วันที่จะเข้าสาย *" : "วันที่เริ่ม *"}
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => pickStart(e.target.value)}
            required
          />
        </div>

        {type?.needs_date_range && (
          <>
            <div>
              <label className="label" htmlFor="end_date">
                วันที่สิ้นสุด *
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                className="input"
                value={endDate}
                min={startDate}
                onChange={(e) => pickEnd(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="total_days">
                จำนวนวัน *
              </label>
              <input
                id="total_days"
                name="total_days"
                type="number"
                step="0.5"
                min="0.5"
                className="input"
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                required
              />
              <p className="mt-1 text-xs text-slate-500">ลาครึ่งวันใส่ 0.5 ได้</p>
            </div>
          </>
        )}

        {type?.needs_arrival_time && (
          <div>
            <label className="label" htmlFor="arrival_time">
              คาดว่าจะมาถึงเวลา *
            </label>
            <input
              id="arrival_time"
              name="arrival_time"
              type="time"
              className="input"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      {/* ---------- ข้อ 5: รายละเอียด ---------- */}
      <div>
        <label className="label" htmlFor="detail">
          รายละเอียด *
        </label>
        <textarea
          id="detail"
          name="detail"
          rows={3}
          className="input"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="เช่น ปวดท้องรุนแรง ต้องไปโรงพยาบาล / พาแม่ไปหาหมอที่ต่างจังหวัด"
          required
        />
      </div>

      {/* ---------- ผลของเงื่อนไข ณ ตอนนี้ ---------- */}
      {blocked && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{blocked}</p>
      )}
      {!blocked && preview && preview.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">ยื่นได้ แต่มีผลตามมา</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {!blocked && preview && preview.warnings.length === 0 && type && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          แจ้งล่วงหน้า {preview.noticeDays} วัน — เข้าเงื่อนไขครบทุกข้อ
        </p>
      )}

      {/* ---------- ข้อ 9: เอกสารแนบ ---------- */}
      {type?.require_medical_cert && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
          <FileUploader
            name="cert_file"
            label="ใบรับรองแพทย์"
            hint={`แนบตอนนี้ได้เลย หรือแนบภายหลังภายในวันที่ ${formatThaiDate(
              addDays(today, type.cert_within_days),
            )} ที่หน้ารายละเอียดใบแจ้ง`}
            max={MAX_LEAVE_FILES}
            endpoint="/api/hr/file"
            accept={HR_FILE_ACCEPT}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-3">
        <FileUploader
          name="attach_file"
          label="เอกสารประกอบอื่น ๆ"
          hint={`แนบได้สูงสุด ${MAX_LEAVE_FILES} ไฟล์ · รองรับรูปภาพและ PDF`}
          max={MAX_LEAVE_FILES}
          endpoint="/api/hr/file"
          accept={HR_FILE_ACCEPT}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto"
          disabled={Boolean(blocked) || types.length === 0}
        >
          บันทึกและส่งให้ผู้อนุมัติ
        </button>
        <Link href="/hr/leave" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
        <p className="text-xs text-slate-500">
          เลขที่ใบแจ้งและเวลาที่แจ้งระบบออกให้อัตโนมัติจากเวลาของเซิร์ฟเวอร์
        </p>
      </div>
    </form>
  );
}

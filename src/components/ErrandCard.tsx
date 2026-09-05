import Link from "next/link";
import { formatDuration, formatTime } from "@/lib/datetime";
import type { ErrandRound } from "@/lib/types";

/**
 * การ์ด "ออกไปทำธุระ" บนหน้าลงเวลา
 * ออก-กลับได้หลายรอบ แต่เวลาที่ใช้รวมกับพักเที่ยงต้องไม่เกินโควตา (ปกติ 60 นาที)
 * ส่วนที่เกินจะถูกนับเป็น "พักเกินเวลา" ในรายงานและหักออกจากชั่วโมงทำงาน
 */
export default function ErrandCard({
  rounds,
  breakMinutes,
  quotaMinutes,
  blockedReason,
}: {
  rounds: ErrandRound[];
  /** เวลาพักเที่ยงที่ใช้ไปแล้ววันนี้ (นาที) */
  breakMinutes: number;
  quotaMinutes: number;
  /** ถ้ายังกดออกไม่ได้ตอนนี้ ใส่เหตุผลไว้แสดงแทนปุ่ม */
  blockedReason?: string;
}) {
  const open = rounds.find((r) => r.isOpen) ?? null;
  const errandMinutes = rounds.reduce((sum, r) => sum + r.minutes, 0);
  const usedMinutes = breakMinutes + errandMinutes;
  const remaining = quotaMinutes - usedMinutes;
  const over = remaining < 0;

  return (
    <section className="card space-y-3">
      <div>
        <p className="font-semibold text-slate-800">ออกไปทำธุระ</p>
        <p className="text-xs text-slate-500">
          ระหว่างวันออกไปทำธุระได้ แต่ต้องกดออกและกดกลับทุกครั้ง ·
          เวลาพักเที่ยงและธุระรวมกันไม่เกิน {quotaMinutes} นาที ส่วนที่เกินถือเป็นพักเกินเวลา
        </p>
      </div>

      <div className={`rounded-xl px-3 py-2 text-sm ${over ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"}`}>
        <p>
          ใช้เวลาส่วนตัวไปแล้ว <strong>{formatDuration(usedMinutes)}</strong> จาก {quotaMinutes} นาที
          <span className="text-xs text-slate-500">
            {" "}
            (พักเที่ยง {breakMinutes} + ธุระ {errandMinutes} นาที)
          </span>
        </p>
        <p className={`text-xs ${over ? "font-semibold" : "text-slate-500"}`}>
          {over ? `เกินโควตาแล้ว ${Math.abs(remaining)} นาที — จะถูกหักจากชั่วโมงทำงาน` : `เหลืออีก ${remaining} นาที`}
        </p>
      </div>

      {rounds.length > 0 && (
        <ul className="space-y-1 text-sm">
          {rounds.map((r) => (
            <li key={r.round} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <span className="badge bg-slate-100 text-slate-600">รอบ {r.round}</span>
              <span>
                ออก {formatTime(r.out?.punched_at)}
                {r.in ? ` · กลับ ${formatTime(r.in.punched_at)}` : ""}
              </span>
              {r.isOpen ? (
                <span className="badge bg-amber-100 text-amber-800">ยังไม่กลับ</span>
              ) : (
                <span className="font-medium text-slate-700">{formatDuration(r.minutes)}</span>
              )}
              {r.reason && <span className="text-xs text-slate-500">· {r.reason}</span>}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Link href="/punch/capture?type=errand_in" className="btn-primary block w-full py-3 text-center">
          🔙 กลับเข้างาน (ออกไปตั้งแต่ {formatTime(open.out?.punched_at)})
        </Link>
      ) : blockedReason ? (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{blockedReason}</p>
      ) : (
        <form method="get" action="/punch/capture" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="type" value="errand_out" />
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor="errand_reason">
              เหตุผล (ไม่บังคับ)
            </label>
            <input id="errand_reason" name="reason" className="input" placeholder="เช่น ไปธนาคาร" />
          </div>
          <button type="submit" className="btn-secondary min-h-11">
            ออกไปทำธุระ
          </button>
        </form>
      )}
    </section>
  );
}

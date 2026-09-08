"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttendanceWall, WallDim, WallDimItem, WallMode, WallPerson } from "@/lib/att-wall";

/**
 * จอ War Room ระบบลงเวลา — เปิดค้างบนจอมอนิเตอร์ พื้นมืด ตัวเลขใหญ่ รีเฟรชเองทุก 60 วินาที
 *
 * เรียงลำดับตามสิ่งที่ต้องรีบรู้ก่อน:
 *   1. กล่องสรุปของวัน (มาแล้ว / ยังไม่มา / สาย / ขาด / อยู่ข้างนอก)
 *   2. รายชื่อที่ต้องตามตอนนี้ — ยังไม่มา · มาสาย · ออกไปทำธุระ · งานนอกสถานที่
 *   3. เทียบรายสาขา/บริษัท/แผนก/ตำแหน่ง แล้วค่อยเป็นแนวโน้ม 14 วัน
 *
 * สลับเป็น **โหมดเดือน** ได้ ตัวเลขจะเปลี่ยนเป็นยอดสะสมทั้งเดือน (คน-วัน)
 * และรายชื่อเปลี่ยนจาก "ใครอยู่ไหนตอนนี้" เป็น "ใครต้องดูแลเดือนนี้"
 */

const REFRESH_MS = 60_000;
/** โหมดเดือนคำนวณทั้งเดือน ข้อมูลไม่ได้เปลี่ยนทุกนาที จึงรีเฟรชห่างกว่า */
const REFRESH_MS_MONTH = 5 * 60_000;
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const MODES: { key: WallMode; label: string }[] = [
  { key: "day", label: "รายวัน" },
  { key: "month", label: "รายเดือน" },
];

const DIMS: { key: WallDim; label: string }[] = [
  { key: "branch", label: "สาขา" },
  { key: "company", label: "บริษัท" },
  { key: "department", label: "แผนก" },
  { key: "position", label: "ตำแหน่ง" },
];

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const hours = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const thDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};
const todayTH = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const thisMonthTH = () => todayTH().slice(0, 7);

export default function AttWallBoard() {
  const [mode, setMode] = useState<WallMode>("day");
  const [date, setDate] = useState(todayTH());
  const [month, setMonth] = useState(thisMonthTH());
  const [company, setCompany] = useState("");
  const [branch, setBranch] = useState("");
  const [dim, setDim] = useState<WallDim>("branch");
  const [data, setData] = useState<AttendanceWall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ date });
      if (mode === "month") {
        qs.set("mode", "month");
        qs.set("month", month);
      }
      if (company) qs.set("company", company);
      if (branch) qs.set("branch", branch);
      const res = await fetch(`/api/att/wall?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mode, date, month, company, branch]);

  useEffect(() => {
    load();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(load, mode === "month" ? REFRESH_MS_MONTH : REFRESH_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [load, mode]);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  const t = data?.totals;
  const isMonth = data?.mode === "month";
  // โหมดวันเทียบกับจำนวนพนักงาน · โหมดเดือนเทียบ "วันที่มาจริง" กับ "วันที่ต้องมา"
  const expected = t ? t.arrived + t.absent : 0;
  const base = isMonth ? expected : (t?.staff ?? 0);
  const arrivedPct = t && base > 0 ? Math.round((t.arrived / base) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      {/* ---------- แถบควบคุม ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">การลงเวลาสด</h1>

        <div className="flex overflow-hidden rounded-lg border border-slate-700">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 text-sm ${
                mode === m.key
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "day" ? (
          <>
            <input
              type="date"
              value={date}
              max={todayTH()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
            />
            {date !== todayTH() && (
              <button
                onClick={() => setDate(todayTH())}
                className="rounded-md bg-sky-500 px-3 py-1 text-sm text-white"
              >
                กลับมาวันนี้
              </button>
            )}
          </>
        ) : (
          <>
            <input
              type="month"
              value={month}
              max={thisMonthTH()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
            />
            {month !== thisMonthTH() && (
              <button
                onClick={() => setMonth(thisMonthTH())}
                className="rounded-md bg-sky-500 px-3 py-1 text-sm text-white"
              >
                กลับมาเดือนนี้
              </button>
            )}
          </>
        )}

        <select
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            setBranch("");
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100"
        >
          <option value="">ทุกบริษัท</option>
          {(data?.companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100"
        >
          <option value="">ทุกสาขา</option>
          {(data?.branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {data && (
            <span>
              อัปเดต{" "}
              {new Date(data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="font-mono text-lg tabular-nums text-slate-200">
            {now ? now.toLocaleTimeString("th-TH") : ""}
          </span>
          <button onClick={fullscreen} className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
            เต็มจอ
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">{error}</p>}
      {!data && !error && <p className="text-slate-400">กำลังโหลด…</p>}

      {data && t && (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 text-slate-300">
            <span className="text-xl font-semibold text-white">
              {data.period.label}
              {!isMonth && data.isToday ? " (วันนี้)" : ""}
            </span>
            <span className="text-sm text-slate-400">
              พนักงาน {int(t.staff)} คน
              {data.scope.companyName ? ` · ${data.scope.companyName}` : ""}
              {data.scope.branchName ? ` · สาขา ${data.scope.branchName}` : ""}
            </span>
          </div>

          {/* ---------- กล่องสรุป ---------- */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {isMonth ? (
              <>
                <Big
                  label="มาทำงาน (คน-วัน)"
                  value={int(t.arrived)}
                  sub={`${arrivedPct}% ของ ${int(expected)} วันที่ต้องมา`}
                  tone="sky"
                />
                <Big
                  label="ขาดงาน (คน-วัน)"
                  value={int(t.absent)}
                  sub={`หยุดเวร ${int(t.off)} · ลา ${int(t.onLeave)}`}
                  tone={t.absent > 0 ? "rose" : "slate"}
                />
                <Big
                  label="มาสาย (คน-วัน)"
                  value={int(t.late)}
                  sub={`รวม ${int(t.lateMinutes)} นาที`}
                  tone={t.late > 0 ? "rose" : "slate"}
                />
                <Big
                  label="ลา (คน-วัน)"
                  value={int(t.onLeave)}
                  sub="ใบลาที่อนุมัติแล้ว"
                  tone={t.onLeave > 0 ? "violet" : "slate"}
                />
                <Big
                  label="ลงเวลาไม่ครบ (คน-วัน)"
                  value={int(t.incomplete)}
                  sub={`ลงครบ ${int(t.complete)} · พักเกิน ${int(t.overBreakMinutes)} นาที`}
                  tone={t.incomplete > 0 ? "amber" : "slate"}
                />
                <Big
                  label="ชั่วโมงทำงานรวม"
                  value={hours(t.workMinutes)}
                  sub={`OT ${int(t.otMinutes)} นาที · เฉลี่ย ${hours(t.staff > 0 ? t.workMinutes / t.staff : 0)} ต่อคน`}
                />
              </>
            ) : (
              <>
                <Big label="มาแล้ว" value={int(t.arrived)} sub={`${arrivedPct}% ของพนักงาน`} tone="sky" />
                <Big
                  label="ยังไม่มา"
                  value={int(t.notArrived)}
                  sub={t.overdue > 0 ? `เลยเวลาเข้างานแล้ว ${int(t.overdue)} คน` : "ยังไม่ถึงเวลาเข้างาน"}
                  tone={t.overdue > 0 ? "rose" : "slate"}
                />
                <Big
                  label="มาสาย"
                  value={int(t.late)}
                  sub={`รวม ${int(t.lateMinutes)} นาที`}
                  tone={t.late > 0 ? "rose" : "slate"}
                />
                <Big
                  label="ลงเวลาไม่ครบ"
                  value={int(t.incomplete)}
                  sub={`ขาดงาน ${int(t.absent)} คน · ลา ${int(t.onLeave)} คน`}
                  tone={t.incomplete > 0 ? "amber" : "slate"}
                />
                <Big
                  label="อยู่ข้างนอกตอนนี้"
                  value={int(t.onErrand + t.onField)}
                  sub={`ธุระ ${int(t.onErrand)} · งานนอกสถานที่ ${int(t.onField)}`}
                  tone={t.onErrand + t.onField > 0 ? "violet" : "slate"}
                />
                <Big
                  label="ชั่วโมงทำงานรวม"
                  value={hours(t.workMinutes)}
                  // นับได้เฉพาะคนที่ลงเวลาครบแล้ว ระหว่างวันตัวเลขนี้จึงยังน้อย เป็นเรื่องปกติ
                  sub={`จาก ${int(t.complete)} คนที่ลงครบ · OT ${int(t.otMinutes)} นาที · พักเกิน ${int(t.overBreakMinutes)} นาที`}
                />
              </>
            )}
          </div>

          {/* ---------- รายชื่อที่ต้องตาม ---------- */}
          <div className={`mb-4 grid gap-3 ${isMonth ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
            {isMonth ? (
              <>
                <PeoplePanel title="สายบ่อยที่สุด" people={data.ranks.late} tone="rose" empty="เดือนนี้ไม่มีใครสาย" />
                <PeoplePanel title="ขาดงานมากที่สุด" people={data.ranks.absent} tone="rose" empty="เดือนนี้ไม่มีใครขาดงาน" />
                <PeoplePanel title="ลามากที่สุด" people={data.ranks.leave} tone="violet" empty="เดือนนี้ไม่มีคนลา" />
                <PeoplePanel title="พักเกินเวลามากที่สุด" people={data.ranks.overBreak} tone="amber" empty="เดือนนี้ไม่มีใครพักเกิน" />
              </>
            ) : (
              <>
                <PeoplePanel title="ยังไม่มา" people={data.notArrived} tone="rose" empty="มากันครบแล้ว 🎉" />
                <PeoplePanel title="มาสาย" people={data.late} tone="amber" empty="วันนี้ไม่มีใครสาย" />
                <PeoplePanel title="ลาวันนี้" people={data.onLeave} tone="violet" empty="วันนี้ไม่มีคนลา" />
                <PeoplePanel title="ออกไปทำธุระ" people={data.onErrand} tone="violet" empty="ไม่มีใครออกไปข้างนอก" />
                <PeoplePanel title="งานนอกสถานที่" people={data.onField} tone="sky" empty="ไม่มีงานนอกสถานที่ที่กำลังทำ" />
              </>
            )}
          </div>

          {/* ---------- เทียบตามมิติ + แนวโน้ม ---------- */}
          <div className="grid gap-3 lg:grid-cols-2">
            <DimPanel dim={dim} onChangeDim={setDim} data={data.dims[dim]} unit={isMonth ? "คน-วัน" : ""} />
            <TrendPanel trend={data.trend} title={isMonth ? "แนวโน้มรายวันในเดือนนี้" : "แนวโน้ม 14 วัน"} />
          </div>
        </>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  sky: "text-sky-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  violet: "text-violet-400",
  slate: "text-slate-100",
};

function Big({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof TONE | string;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-4xl font-bold tabular-nums ${TONE[tone] ?? TONE.slate}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const BORDER: Record<string, string> = {
  rose: "border-rose-900",
  amber: "border-amber-900",
  violet: "border-violet-900",
  sky: "border-sky-900",
};

function PeoplePanel({
  title,
  people,
  tone,
  empty,
}: {
  title: string;
  people: WallPerson[];
  tone: string;
  empty: string;
}) {
  return (
    <div className={`rounded-2xl border bg-slate-900 p-4 ${BORDER[tone] ?? "border-slate-800"}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-semibold text-slate-100">{title}</span>
        <span className={`text-2xl font-bold tabular-nums ${TONE[tone]}`}>{people.length}</span>
      </div>
      {people.length === 0 ? (
        <p className="py-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {people.map((p) => (
            <li key={`${p.employeeId}-${p.detail}`} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-slate-100">{p.fullName}</span>
                <span className="shrink-0 font-mono text-xs text-slate-500">
                  {p.empCode}
                  {p.payrollCode ? ` / ${p.payrollCode}` : ""}
                </span>
              </div>
              <div className="truncate text-xs text-slate-400">
                {p.branchName ? `${p.branchName} · ` : ""}
                {p.detail}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DimPanel({
  dim,
  onChangeDim,
  data,
  unit,
}: {
  dim: WallDim;
  onChangeDim: (d: WallDim) => void;
  data: { title: string; items: WallDimItem[] };
  /** คำต่อท้ายตัวเลข — โหมดเดือนนับเป็น คน-วัน จึงต้องบอกให้ชัด */
  unit: string;
}) {
  const rows = [...data.items].sort((a, b) => b.staff - a.staff);
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <select
          value={dim}
          onChange={(e) => onChangeDim(e.target.value as WallDim)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-semibold text-slate-100"
        >
          {DIMS.map((d) => (
            <option key={d.key} value={d.key}>
              แยกตาม{d.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {rows.length} รายการ{unit ? ` · ${unit}` : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const pct = r.staff > 0 ? (r.arrived / r.staff) * 100 : 0;
            return (
              <li key={r.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate pr-2 text-slate-100">{r.label}</span>
                  <span className="shrink-0 tabular-nums text-xs text-slate-400">
                    มา <span className="text-base font-semibold text-slate-100">{int(r.arrived)}</span>/{int(r.staff)}
                    {r.late > 0 && <span className="ml-2 text-rose-400">สาย {int(r.late)}</span>}
                    {r.absent > 0 && <span className="ml-2 text-rose-400">ขาด {int(r.absent)}</span>}
                    {r.incomplete > 0 && <span className="ml-2 text-amber-400">ไม่ครบ {int(r.incomplete)}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-sky-500"
                    style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function TrendPanel({ trend, title }: { trend: AttendanceWall["trend"]; title: string }) {
  const max = Math.max(1, ...trend.map((d) => d.arrived + d.absent));
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-slate-100">{title}</span>
        <span className="flex gap-3 text-xs">
          <span className="text-sky-400">■ มาทำงาน</span>
          <span className="text-rose-400">■ สาย</span>
          <span className="text-slate-500">■ ขาด</span>
        </span>
      </div>
      <div className="flex h-48 gap-1">
        {trend.map((d) => (
          <div
            key={d.date}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${thDate(d.date)} · มา ${d.arrived} · สาย ${d.late} · ขาด ${d.absent}`}
          >
            <div className="w-full rounded-t bg-slate-700" style={{ height: `${(d.absent / max) * 100}%` }} />
            <div className="w-full bg-rose-500" style={{ height: `${(d.late / max) * 100}%` }} />
            <div className="w-full rounded-b bg-sky-500" style={{ height: `${(Math.max(0, d.arrived - d.late) / max) * 100}%` }} />
            <span className="mt-1 text-center text-[10px] text-slate-500">
              {Number(d.date.slice(8, 10))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

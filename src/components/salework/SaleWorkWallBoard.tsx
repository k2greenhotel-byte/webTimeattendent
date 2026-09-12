"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, intTH, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import { perDay, sharePct } from "@/lib/salework";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import WallPivot, { type PivotDim, type PivotMetric } from "@/components/wall/WallPivot";
import { formatThaiDate } from "@/lib/datetime";
import type { SaleWorkPivotCell, SaleWorkWall } from "@/lib/wall-types";

/** งานประจำวันเปลี่ยนถี่กว่าจออื่น จึงรีเฟรชทุกนาที */
const REFRESH_MS = 60_000;

const PIVOT_DIMS: PivotDim<SaleWorkPivotCell>[] = [
  { key: "task", label: "ประเภทงาน", of: (c) => ({ key: c.task }) },
  { key: "staff", label: "พนักงาน", of: (c) => ({ key: c.staff }) },
  { key: "branch", label: "สาขา", of: (c) => ({ key: c.branch }) },
  { key: "date", label: "วันที่", of: (c) => ({ key: c.date, label: formatThaiDate(c.date) }) },
];

const PIVOT_METRICS: PivotMetric<SaleWorkPivotCell>[] = [
  { key: "done", label: "งานที่ทำ", of: (c) => c.done, fmt: intTH },
  { key: "items", label: "งานในใบ", of: (c) => c.items, fmt: intTH },
  { key: "qty", label: "ปริมาณ", of: (c) => c.qty, fmt: intTH },
];

/**
 * แถวของแผง "ประเภทงานที่ทำ" — เรียงจากน้อยไปมากมาจาก server แล้ว
 *
 * เลือก "ทุกคนรวมกัน" → ยอดรวมของประเภทนั้น + เฉลี่ยต่อวัน
 * เลือกรายคน        → ยอดของคนนั้น + คิดเป็นกี่ % ของยอดรวมประเภทนั้น + เฉลี่ยต่อวันของเขาเอง
 *                     (เช่น โพสต์ FB ทั้งร้าน 62 งาน น้องนุชทำ 10 = 16%)
 *
 * กรองในเครื่องจากตารางที่ server ส่งมาทีเดียว จึงสลับดูได้ทันทีไม่ต้องรอโหลดใหม่
 */
function taskRows(d: SaleWorkWall, staffKey: string) {
  const rows = d.byTask.map((t) => {
    const value = staffKey ? (t.byStaff[staffKey] ?? 0) : t.total;
    const avg = perDay(value, d.days);
    return {
      label: t.label,
      value,
      sub: staffKey
        ? `${sharePct(value, t.total)}% ของงานรวม ${intTH(t.total)} งาน · เฉลี่ย ${avg} งาน/วัน`
        : `เฉลี่ย ${avg} งาน/วัน`,
    };
  });

  // เลือกรายคนแล้วลำดับเปลี่ยนไปจากยอดรวม จึงต้องเรียงใหม่ให้ยังเป็นน้อย → มาก
  return staffKey ? rows.sort((a, b) => a.value - b.value) : rows;
}

export default function SaleWorkWallBoard({ branches }: { branches: Option[] }) {
  const [branch, setBranch] = useState("");
  /** "" = ดูยอดรวมทุกคน · ไม่ใช่ค่าว่าง = ดูเฉพาะพนักงานคนนั้น */
  const [staff, setStaff] = useState("");
  // จอนี้ตอบคำถาม "วันนี้ใครยังไม่ส่งใบงาน" เป็นหลัก จึงเริ่มที่วันนี้ แล้วค่อยขยายช่วงเองได้
  const { state, setState, period } = useWallPeriod("today");

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<SaleWorkWall>
      title="งานประจำวันพนักงานขาย"
      endpoint={`/api/salework/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <>
          <WallPeriodPicker state={state} onChange={setState} period={period} />
          <WallSelect
            value={branch}
            onChange={setBranch}
            options={branches}
            allLabel="ทุกสาขา"
            label="สาขา"
          />
        </>
      }
    >
      {(d) => {
        // เปลี่ยนสาขา/ช่วงวันแล้วคนที่เลือกไว้อาจไม่มีข้อมูลแล้ว — ถอยกลับไปดูรวมทุกคนเอง
        const pick = d.staffOptions.some((o) => o.id === staff) ? staff : "";

        return (
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <StatTile
                label="ยังไม่ส่งใบงาน"
                value={d.counts.notReported}
                sub={`จากพนักงานทั้งหมด ${d.counts.staffTotal} คน`}
                tone="rose"
              />
              <StatTile
                label="ส่งใบงานแล้ว"
                value={d.counts.reported}
                sub={d.period.label}
                tone="emerald"
              />
              <StatTile
                label="งานที่ทำครบ"
                value={`${d.donePct}%`}
                sub={`${d.counts.itemsDone} จาก ${d.counts.itemsTotal} รายการ`}
                tone="sky"
              />
              <StatTile
                label={`รายการงาน ${d.period.label}`}
                value={d.counts.itemsTotal}
                tone="violet"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Panel title="ยังไม่ส่งใบงาน" count={d.counts.notReported} hint={d.period.label}>
                <AlertList rows={d.notReported} tone="rose" empty="ส่งครบทุกคนแล้ว" />
              </Panel>
              <Panel
                title="งานที่ทำรายคน"
                count={d.staffOptions.length}
                hint={`${d.period.label} · น้อย → มาก`}
              >
                <RankBars rows={d.byStaff} unit="งาน" tone="emerald" />
              </Panel>
              <Panel
                title="ประเภทงานที่ทำ"
                hint={`${d.period.label} · น้อย → มาก`}
                action={
                  <select
                    value={pick}
                    onChange={(e) => setStaff(e.target.value)}
                    aria-label="ดูเฉพาะพนักงานคนเดียว"
                    className="max-w-[10rem] rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="">ทุกคนรวมกัน</option>
                    {d.staffOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                }
              >
                <RankBars rows={taskRows(d, pick)} unit="งาน" tone="sky" />
              </Panel>
            </div>

            <WallPivot
              rows={d.pivot}
              dims={PIVOT_DIMS}
              metrics={PIVOT_METRICS}
              initialRow="task"
              initialCol="staff"
              note={d.period.label}
            />
          </div>
        );
      }}
    </WallShell>
  );
}

"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import type { HrWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

export default function HrWallBoard({ branches }: { branches: Option[] }) {
  const [branch, setBranch] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<HrWall>
      title="การลาและขอเบิกเงิน"
      endpoint={`/api/hr/wall?${qs}`}
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
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile
              label="รออนุมัติ"
              value={d.counts.pendingLeave + d.counts.pendingAdvance}
              sub={`ใบลา ${d.counts.pendingLeave} · ขอเบิก ${d.counts.pendingAdvance}`}
              tone="amber"
            />
            <StatTile
              label="วันนี้ลาอยู่"
              value={d.counts.onLeaveToday}
              sub="ใช้วางกำลังคนหน้างาน"
              tone="sky"
            />
            <StatTile
              label="ค้างใบรับรองแพทย์"
              value={d.counts.certOverdue}
              sub="เลยกำหนดส่งแล้ว"
              tone="rose"
            />
            <StatTile
              label="ขอเบิกที่รออนุมัติ"
              value={shortBaht(d.money.advancePending)}
              sub={`อนุมัติไป ${d.period.label} ${shortBaht(d.money.advanceInPeriod)} บาท`}
              tone="violet"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="รออนุมัติ"
              count={d.counts.pendingLeave + d.counts.pendingAdvance}
              hint="ใบลาและใบขอเบิกเงิน"
            >
              <AlertList rows={d.pending} tone="amber" empty="อนุมัติครบทุกใบแล้ว" />
            </Panel>

            <Panel title="วันนี้ลาอยู่" count={d.counts.onLeaveToday}>
              <AlertList rows={d.onLeaveToday} tone="sky" empty="วันนี้ไม่มีใครลา" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="ลาแยกตามประเภท" hint={`${d.period.label} · ${d.counts.leaveInPeriod} ใบ`}>
              <RankBars rows={d.byType} unit="ใบ" tone="violet" />
            </Panel>
            <Panel title="ลาแยกตามสาขา" hint={`แจ้งกระชั้นชิดที่รออนุมัติ ${d.counts.lateNotice} ใบ`}>
              <RankBars rows={d.byBranch} unit="ใบ" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

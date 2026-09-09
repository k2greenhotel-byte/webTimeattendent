"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import type { SaleWorkWall } from "@/lib/wall-types";

/** งานประจำวันเปลี่ยนถี่กว่าจออื่น จึงรีเฟรชทุกนาที */
const REFRESH_MS = 60_000;

export default function SaleWorkWallBoard({ branches }: { branches: Option[] }) {
  const [branch, setBranch] = useState("");
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
      {(d) => (
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
            <Panel title="ทำงานได้มากที่สุด" hint={d.period.label}>
              <RankBars rows={d.byStaff} unit="งาน" tone="emerald" />
            </Panel>
            <Panel title="ประเภทงานที่ทำ" hint={d.period.label}>
              <RankBars rows={d.byTask} unit="งาน" tone="sky" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

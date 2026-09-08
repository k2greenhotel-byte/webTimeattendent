"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import type { SaleWorkWall } from "@/lib/wall-types";

/** งานประจำวันเปลี่ยนถี่กว่าจออื่น จึงรีเฟรชทุกนาที */
const REFRESH_MS = 60_000;

type Branch = { id: string; name: string };

export default function SaleWorkWallBoard({ branches }: { branches: Branch[] }) {
  const [branch, setBranch] = useState("");

  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<SaleWorkWall>
      title="งานประจำวันพนักงานขาย"
      endpoint={`/api/salework/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          aria-label="สาขา"
        >
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      }
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile
              label="ยังไม่ส่งใบงานวันนี้"
              value={d.counts.notReportedToday}
              sub={`จากพนักงานทั้งหมด ${d.counts.staffTotal} คน`}
              tone="rose"
            />
            <StatTile
              label="ส่งใบงานแล้ว"
              value={d.counts.reportedToday}
              sub="วันนี้"
              tone="emerald"
            />
            <StatTile
              label="งานที่ทำครบ"
              value={`${d.donePct}%`}
              sub={`${d.counts.itemsDoneToday} จาก ${d.counts.itemsTotalToday} รายการ`}
              tone="sky"
            />
            <StatTile label="รายการงานวันนี้" value={d.counts.itemsTotalToday} tone="violet" />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="ยังไม่ส่งใบงาน" count={d.counts.notReportedToday} hint="ตามก่อนหมดวัน">
              <AlertList rows={d.notReported} tone="rose" empty="ส่งครบทุกคนแล้ว" />
            </Panel>
            <Panel title="ทำงานได้มากที่สุดวันนี้">
              <RankBars rows={d.byStaff} unit="งาน" tone="emerald" />
            </Panel>
            <Panel title="ประเภทงานที่ทำวันนี้">
              <RankBars rows={d.byTask} unit="งาน" tone="sky" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

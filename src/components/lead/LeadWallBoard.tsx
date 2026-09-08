"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import type { LeadWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

type Branch = { id: string; name: string };

export default function LeadWallBoard({ branches }: { branches: Branch[] }) {
  const [branch, setBranch] = useState("");

  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<LeadWall>
      title="คิวติดตามลูกค้า"
      endpoint={`/api/lead/wall?${qs}`}
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
              label="เลยนัดติดตามแล้ว"
              value={d.counts.overdue}
              sub="ต้องโทรวันนี้ก่อนใคร"
              tone="rose"
            />
            <StatTile label="นัดติดตามวันนี้" value={d.counts.dueToday} tone="amber" />
            <StatTile
              label="ยังไม่ได้นัดวันต่อไป"
              value={d.counts.noPlan}
              sub="หลุดมือง่ายที่สุด"
              tone="violet"
            />
            <StatTile
              label="Lead ที่ยังตามอยู่"
              value={d.counts.open}
              sub={`เดือนนี้รับใหม่ ${d.counts.newThisMonth} · ปิดได้ ${d.counts.won}`}
              tone="sky"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="เลยนัดติดตาม" count={d.counts.overdue}>
              <AlertList rows={d.overdue} tone="rose" empty="ตามครบตามนัดทุกราย" />
            </Panel>
            <Panel title="ต้องตามวันนี้ / ยังไม่ได้นัด" count={d.counts.dueToday + d.counts.noPlan}>
              <AlertList rows={d.dueToday} tone="amber" empty="ไม่มีคิวค้างวันนี้" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Lead ค้างรายพนักงาน">
              <RankBars rows={d.byStaff} unit="ราย" tone="sky" />
            </Panel>
            <Panel title="Lead ค้างรายสาขา">
              <RankBars rows={d.byBranch} unit="ราย" tone="emerald" />
            </Panel>
            <Panel title="ค้างอยู่สถานะไหน">
              <RankBars rows={d.byStatus} unit="ราย" tone="violet" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

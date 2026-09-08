"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import type { ClaimWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

type Branch = { id: string; name: string };

export default function ClaimWallBoard({ branches }: { branches: Branch[] }) {
  const [branch, setBranch] = useState("");

  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<ClaimWall>
      title="งานเคลมค้าง"
      endpoint={`/api/claim/wall?${qs}`}
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
              label="เลยกำหนดเสร็จ"
              value={d.counts.overdue}
              sub="ลูกค้ารอรถอยู่"
              tone="rose"
            />
            <StatTile
              label="รอผลจากผู้ผลิต"
              value={d.counts.waitingMaker}
              sub="แจ้งไปแล้วยังไม่มีคำตอบ"
              tone="amber"
            />
            <StatTile
              label="ซ่อมเสร็จ รอส่งมอบ"
              value={d.counts.waitingDelivery}
              sub="โทรนัดลูกค้ามารับได้"
              tone="violet"
            />
            <StatTile
              label="งานเคลมที่ยังไม่จบ"
              value={d.counts.open}
              sub={`เดือนนี้เปิดใหม่ ${d.counts.openedThisMonth} ใบ`}
              tone="sky"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="เลยกำหนดเสร็จ" count={d.counts.overdue}>
              <AlertList rows={d.overdue} tone="rose" empty="ไม่มีงานเลยกำหนด" />
            </Panel>
            <Panel title="รอผลจากผู้ผลิต" count={d.counts.waitingMaker}>
              <AlertList rows={d.waitingMaker} tone="amber" empty="ไม่มีใบที่รอผู้ผลิต" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="งานค้างรายสาขา">
              <RankBars rows={d.byBranch} unit="ใบ" tone="sky" />
            </Panel>
            <Panel title="งานค้างแยกตามผู้ผลิต">
              <RankBars rows={d.byMaker} unit="ใบ" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

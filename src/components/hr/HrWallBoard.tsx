"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import type { HrWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

type Branch = { id: string; name: string };

export default function HrWallBoard({ branches }: { branches: Branch[] }) {
  const [branch, setBranch] = useState("");

  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<HrWall>
      title="การลาและขอเบิกเงิน"
      endpoint={`/api/hr/wall?${qs}`}
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
              sub={`เดือนนี้อนุมัติไป ${shortBaht(d.money.advanceThisMonth)} บาท`}
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
            <Panel title="ลาเดือนนี้แยกตามประเภท" hint={`ทั้งเดือน ${d.counts.leaveThisMonth} ใบ`}>
              <RankBars rows={d.byType} unit="ใบ" tone="violet" />
            </Panel>
            <Panel title="ลาเดือนนี้แยกตามสาขา" hint={`แจ้งกระชั้นชิด ${d.counts.lateNotice} ใบ`}>
              <RankBars rows={d.byBranch} unit="ใบ" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

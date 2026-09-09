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
import type { ProcurementWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

export default function ProcurementWallBoard({ branches }: { branches: Option[] }) {
  const [branch, setBranch] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<ProcurementWall>
      title="งานซ่อมและจัดซื้อค้าง"
      endpoint={`/api/procurement/wall?${qs}`}
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
              label="เลยกำหนดเสร็จ"
              value={d.counts.overdue}
              sub="งานค้างที่กระทบหน้างาน"
              tone="rose"
            />
            <StatTile
              label="รออนุมัติ"
              value={d.counts.waitingApproval}
              sub="รอผู้มีอำนาจกดอนุมัติ"
              tone="amber"
            />
            <StatTile
              label="งานที่ยังไม่เสร็จ"
              value={d.counts.open}
              sub={`เปิดใหม่ ${d.period.label} ${d.counts.createdInPeriod} ใบ`}
              tone="sky"
            />
            <StatTile
              label="อนุมัติแล้วยังไม่จ่าย"
              value={shortBaht(d.money.unpaid)}
              sub={`จ่ายไปแล้ว ${d.period.label} ${shortBaht(d.money.paid)} บาท`}
              tone="violet"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="เลยกำหนดเสร็จ" count={d.counts.overdue}>
              <AlertList rows={d.overdue} tone="rose" empty="ไม่มีงานเลยกำหนด" />
            </Panel>
            <Panel title="รออนุมัติ" count={d.counts.waitingApproval}>
              <AlertList rows={d.waitingApproval} tone="amber" empty="อนุมัติครบทุกใบแล้ว" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="งานค้างรายสาขา">
              <RankBars rows={d.byBranch} unit="ใบ" tone="sky" />
            </Panel>
            <Panel title="งานค้างตามประเภท">
              <RankBars rows={d.byType} unit="ใบ" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

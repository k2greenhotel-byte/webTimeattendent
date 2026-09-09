"use client";

import { useState } from "react";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import WallShell from "@/components/wall/WallShell";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import type { InspectionWall } from "@/lib/wall-types";

const REFRESH_MS = 5 * 60_000;

export default function InspectionWallBoard({
  companies,
  templates,
  branches,
}: {
  companies: Option[];
  templates: Option[];
  branches: Option[];
}) {
  const [company, setCompany] = useState("");
  const [template, setTemplate] = useState("");
  const [branch, setBranch] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (company) qs.set("company", company);
  if (template) qs.set("template", template);
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<InspectionWall>
      title="ตรวจสอบสาขา"
      endpoint={`/api/inspection/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <>
          <WallPeriodPicker state={state} onChange={setState} period={period} />
          <WallSelect
            value={company}
            onChange={(v) => {
              setCompany(v);
              setBranch("");
            }}
            options={companies}
            allLabel="ทุกบริษัท"
            label="บริษัท"
          />
          <WallSelect
            value={branch}
            onChange={setBranch}
            options={branches}
            allLabel="ทุกสาขา"
            label="สาขา"
          />
          <WallSelect
            value={template}
            onChange={setTemplate}
            options={templates}
            allLabel="ทุกแบบฟอร์ม"
            label="แบบฟอร์ม"
          />
        </>
      }
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            <StatTile
              label={`คะแนนเฉลี่ย ${d.period.label}`}
              value={`${d.avgPct.toFixed(0)}%`}
              sub={`จากการตรวจ ${d.counts.inspectedInPeriod} ครั้ง`}
              tone={d.avgPct >= 90 ? "emerald" : d.avgPct >= 75 ? "amber" : "rose"}
            />
            <StatTile
              label="สาขาที่ตรวจแล้วในช่วงนี้"
              value={`${d.counts.branchesCovered}/${d.counts.branchesTotal}`}
              sub={`วันนี้ตรวจไป ${d.counts.inspectedToday} สาขา`}
              tone="sky"
            />
            <StatTile
              label="ยังไม่เคยตรวจ"
              value={d.counts.branchesNeverInspected}
              sub="สาขาที่ยังไม่มีผลตรวจเลย"
              tone="rose"
            />
            <StatTile
              label="ค่าปรับในช่วงนี้"
              value={shortBaht(d.money.fineInPeriod)}
              sub="บาท"
              tone="amber"
            />
            <StatTile
              label="เงินรางวัลในช่วงนี้"
              value={shortBaht(d.money.bonusInPeriod)}
              sub={d.counts.draft > 0 ? `ยังค้างฉบับร่าง ${d.counts.draft} ใบ` : "บาท"}
              tone="emerald"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="สาขาคะแนนต่ำสุด (ผลตรวจล่าสุด)" count={d.worstBranches.length}>
              <AlertList rows={d.worstBranches} tone="rose" empty="ยังไม่มีผลการตรวจ" />
            </Panel>
            <Panel title="สาขาที่หลุดคิวตรวจ" count={d.overdueBranches.length}>
              <AlertList rows={d.overdueBranches} tone="amber" empty="ตรวจครบตามรอบทุกสาขา" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="ข้อที่ตกบ่อยที่สุด" hint={`${d.period.label} · ควรอบรมก่อน`}>
              <RankBars rows={d.topFailedItems} unit="ครั้ง" tone="rose" empty="ไม่มีข้อที่ตก" />
            </Panel>
            <Panel title="คะแนนเฉลี่ยรายสาขา" hint={d.period.label}>
              <RankBars rows={d.byBranch} unit="%" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

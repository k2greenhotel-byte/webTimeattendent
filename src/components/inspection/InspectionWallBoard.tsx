"use client";

import { useState } from "react";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import WallShell from "@/components/wall/WallShell";
import type { InspectionWall } from "@/lib/wall-types";

const REFRESH_MS = 5 * 60_000;

type Option = { id: string; name: string };

export default function InspectionWallBoard({
  companies,
  templates,
}: {
  companies: Option[];
  templates: Option[];
}) {
  const [company, setCompany] = useState("");
  const [template, setTemplate] = useState("");

  const qs = new URLSearchParams();
  if (company) qs.set("company", company);
  if (template) qs.set("template", template);

  const selectClass =
    "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100";

  return (
    <WallShell<InspectionWall>
      title="ตรวจสอบสาขา"
      endpoint={`/api/inspection/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={selectClass}
            aria-label="บริษัท"
          >
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className={selectClass}
            aria-label="แบบฟอร์ม"
          >
            <option value="">ทุกแบบฟอร์ม</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </>
      }
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            <StatTile
              label="คะแนนเฉลี่ยเดือนนี้"
              value={`${d.avgPct.toFixed(0)}%`}
              sub={`จากการตรวจ ${d.counts.inspectedThisMonth} ครั้ง`}
              tone={d.avgPct >= 90 ? "emerald" : d.avgPct >= 75 ? "amber" : "rose"}
            />
            <StatTile
              label="สาขาที่ตรวจแล้วเดือนนี้"
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
              label="ค่าปรับเดือนนี้"
              value={shortBaht(d.money.fineThisMonth)}
              sub="บาท"
              tone="amber"
            />
            <StatTile
              label="เงินรางวัลเดือนนี้"
              value={shortBaht(d.money.bonusThisMonth)}
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
            <Panel title="ข้อที่ตกบ่อยที่สุดเดือนนี้" hint="ควรอบรม/แก้กระบวนการก่อน">
              <RankBars rows={d.topFailedItems} unit="ครั้ง" tone="rose" empty="ไม่มีข้อที่ตก" />
            </Panel>
            <Panel title="คะแนนเฉลี่ยรายสาขาเดือนนี้">
              <RankBars rows={d.byBranch} unit="%" tone="emerald" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

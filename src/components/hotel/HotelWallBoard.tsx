"use client";

import { useState } from "react";
import { AlertList, Panel, RankBars, StatTile } from "@/components/wall/WallParts";
import WallShell from "@/components/wall/WallShell";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import type { HotelWall } from "@/lib/wall-types";

const REFRESH_MS = 5 * 60_000;

export default function HotelWallBoard({
  companies,
  branches,
}: {
  companies: Option[];
  branches: Option[];
}) {
  const [company, setCompany] = useState("");
  const [branch, setBranch] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (company) qs.set("company", company);
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<HotelWall>
      title="ตรวจเช็คโรงแรมประจำวัน"
      endpoint={`/api/hotel/wall?${qs}`}
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
        </>
      }
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
            <StatTile
              label="ตรวจอาคารวันนี้"
              value={`${d.counts.checkedToday}/${d.counts.branchesTotal}`}
              sub={
                d.counts.draft > 0 ? `ยังค้างฉบับร่าง ${d.counts.draft} ใบ` : "สาขาที่ส่งผลตรวจแล้ว"
              }
              tone={d.counts.checkedToday >= d.counts.branchesTotal ? "emerald" : "amber"}
            />
            <StatTile
              label="ตรวจห้องพักวันนี้"
              value={`${d.counts.roomsCheckedToday}/${d.counts.roomsTotal}`}
              sub="ห้องที่ส่งผลตรวจแล้ว"
              tone={
                d.counts.roomsTotal > 0 && d.counts.roomsCheckedToday >= d.counts.roomsTotal
                  ? "emerald"
                  : "violet"
              }
            />
            <StatTile
              label={`ผลปกติ ${d.period.label}`}
              value={`${d.passPct.toFixed(0)}%`}
              sub={`จากการตรวจ ${d.counts.roundsInPeriod} ใบ`}
              tone={d.passPct >= 95 ? "emerald" : d.passPct >= 85 ? "amber" : "rose"}
            />
            <StatTile
              label="เร่งด่วนทันที"
              value={d.counts.urgentOpen}
              sub="ข้อที่ยังไม่ได้แก้"
              tone="rose"
            />
            <StatTile
              label="เลยกำหนดแก้ไข"
              value={d.counts.overdueIssues}
              sub={`ค้างทั้งหมด ${d.counts.openIssues} ข้อ`}
              tone="rose"
            />
            <StatTile
              label="ยังไม่เปิดใบซ่อม"
              value={d.counts.noRepairDoc}
              sub={`ช่วงนี้ปิดงานไป ${d.counts.fixedInPeriod} ข้อ`}
              tone="amber"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="เร่งด่วนทันที — ต้องแก้ก่อน" count={d.urgentIssues.length}>
              <AlertList rows={d.urgentIssues} tone="rose" empty="ไม่มีงานเร่งด่วนค้างอยู่" />
            </Panel>
            <Panel title="เลยกำหนดแก้ไขแล้ว" count={d.overdueIssues.length}>
              <AlertList rows={d.overdueIssues} tone="amber" empty="ไม่มีงานเลยกำหนด" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="สาขาที่ยังไม่ได้ตรวจอาคารวันนี้" count={d.notCheckedToday.length}>
              <AlertList
                rows={d.notCheckedToday}
                tone="amber"
                empty="วันนี้ตรวจอาคารครบทุกสาขาแล้ว"
              />
            </Panel>
            <Panel title="ห้องพักที่ยังไม่ได้ตรวจวันนี้" count={d.notCheckedRoomsToday.length}>
              <AlertList
                rows={d.notCheckedRoomsToday}
                tone="violet"
                empty="วันนี้ตรวจครบทุกห้องแล้ว"
              />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="ข้อค้างแยกตามประเภทงาน" hint="ปัญหากระจุกที่ระบบไหน">
              <RankBars rows={d.byGroup} unit="ข้อ" tone="rose" empty="ไม่มีข้อค้าง" />
            </Panel>
            <Panel title="ข้อค้างแยกตามสาขา" hint="สาขาที่ต้องเข้าไปดูแลก่อน">
              <RankBars rows={d.byBranch} unit="ข้อ" tone="amber" empty="ไม่มีข้อค้าง" />
            </Panel>
            <Panel title="แนวโน้มผลปกติรายวัน" hint={d.period.label}>
              <RankBars rows={d.trend} unit="%" tone="emerald" empty="ยังไม่มีผลตรวจในช่วงนี้" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

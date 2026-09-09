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
import { MKT_SLOW_DAYS, type MarketingWall } from "@/lib/wall-types";

/** ยอดเงินไม่ได้เปลี่ยนทุกนาทีเหมือนการลงเวลา จึงรีเฟรชห่างกว่า */
const REFRESH_MS = 2 * 60_000;

export default function MarketingWallBoard({
  companies,
  activityTypes = [],
}: {
  companies: Option[];
  activityTypes?: Option[];
}) {
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (company) qs.set("company", company);
  if (type) qs.set("type", type);

  return (
    <WallShell<MarketingWall>
      title="เงินค่าส่งเสริมการขาย"
      endpoint={`/api/marketing/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <>
          <WallPeriodPicker state={state} onChange={setState} period={period} />
          <WallSelect
            value={company}
            onChange={setCompany}
            options={companies}
            allLabel="ทุกบริษัท"
            label="บริษัทที่ขอเบิก"
          />
          {activityTypes.length > 0 && (
            <WallSelect
              value={type}
              onChange={setType}
              options={activityTypes}
              allLabel="ทุกประเภทกิจกรรม"
              label="ประเภทกิจกรรม"
            />
          )}
        </>
      }
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          {/* ---------- เงินที่ต้องรู้ก่อน ---------- */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile
              label="ยังไม่ได้เงินคืน"
              value={shortBaht(d.money.outstanding)}
              sub={`จากที่ขอเบิก ${shortBaht(d.money.request)} บาท`}
              tone="rose"
            />
            <StatTile
              label="ได้รับเงินแล้ว"
              value={shortBaht(d.money.received)}
              sub={d.period.label}
              tone="emerald"
            />
            <StatTile
              label="อนุมัติเบิกแล้ว"
              value={shortBaht(d.money.approved)}
              sub="ยอดที่บริษัทรถอนุมัติ"
              tone="amber"
            />
            <StatTile
              label={`ใบกิจกรรม ${d.period.label}`}
              value={d.counts.activities}
              sub={`Memo ${d.counts.memos} ใบ`}
              tone="sky"
            />
          </div>

          {/* ---------- ค้างอยู่ขั้นตอนไหน ---------- */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile label="ยังไม่ตั้งเบิก" value={d.counts.draft} tone="amber" />
            <StatTile label="ส่งเบิกแล้ว รอเงิน" value={d.counts.submitted} tone="sky" />
            <StatTile label="รับเงินแล้ว" value={d.counts.received} tone="emerald" />
          </div>

          {/* ---------- ต้องตามวันนี้ ---------- */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="ส่งเบิกแล้วเงินยังไม่เข้า"
              count={d.counts.submitted}
              hint={`ค้างเกิน ${MKT_SLOW_DAYS} วันควรโทรตาม`}
            >
              <AlertList rows={d.waiting} tone="rose" empty="ไม่มีใบที่รอเงิน" />
            </Panel>

            <Panel title="จัดงานแล้วแต่ยังไม่ตั้งเบิก" count={d.counts.draft}>
              <AlertList rows={d.notSubmitted} tone="amber" empty="ตั้งเบิกครบทุกใบแล้ว" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="ยอดคงค้างรายบริษัท" hint="บาท">
              <RankBars rows={d.byCompany} unit="฿" tone="rose" empty="ไม่มียอดค้าง" />
            </Panel>

            <Panel title="Memo ที่ต้องดูแล" hint="ใกล้หมดอายุ / เลยกำหนด">
              <AlertList rows={d.memoAlerts} tone="violet" empty="ไม่มี Memo ที่ต้องเร่ง" />
              <div className="mt-3 border-t border-slate-800 pt-3">
                <RankBars rows={d.memoByStatus} unit="ใบ" tone="violet" empty="ยังไม่มี Memo" />
              </div>
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

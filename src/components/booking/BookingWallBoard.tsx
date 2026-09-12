"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, intTH, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import {
  useWallPeriod,
  WallPeriodPicker,
  WallSelect,
  type Option,
} from "@/components/wall/WallFilters";
import WallPivot, { type PivotDim, type PivotMetric } from "@/components/wall/WallPivot";
import { BOOK_SLOW_DAYS, type BookingPivotCell, type BookingWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

const PIVOT_DIMS: PivotDim<BookingPivotCell>[] = [
  { key: "branch", label: "สาขา", of: (c) => ({ key: c.branch }) },
  { key: "staff", label: "พนักงานขาย", of: (c) => ({ key: c.staff }) },
  { key: "brand", label: "ยี่ห้อ", of: (c) => ({ key: c.brand }) },
  { key: "model", label: "รุ่น", of: (c) => ({ key: c.model }) },
  { key: "purchase", label: "ประเภทการซื้อ", of: (c) => ({ key: c.purchase }) },
  { key: "vehicle", label: "สถานะรถ", of: (c) => ({ key: c.vehicle }) },
  { key: "booking", label: "สถานะการจอง", of: (c) => ({ key: c.booking }) },
  { key: "contract", label: "สถานะสัญญา", of: (c) => ({ key: c.contract }) },
];

const PIVOT_METRICS: PivotMetric<BookingPivotCell>[] = [
  { key: "bookings", label: "จำนวนใบจอง", of: (c) => c.bookings, fmt: intTH },
  { key: "deposit", label: "เงินมัดจำ", of: (c) => c.deposit, fmt: shortBaht },
];

export default function BookingWallBoard({ branches }: { branches: Option[] }) {
  const [branch, setBranch] = useState("");
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<BookingWall>
      title="คิวจองรถและการส่งมอบ"
      endpoint={`/api/booking/wall?${qs}`}
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
              label="รอส่งมอบ"
              value={d.counts.awaitingDelivery}
              sub={`รถยังไม่มีในสต็อก ${d.counts.outOfStock} ใบ`}
              tone="rose"
            />
            <StatTile
              label="ใบจองที่ยังดำเนินการ"
              value={d.counts.openBookings}
              sub={`วันนี้รับจอง ${d.counts.bookedToday} ใบ`}
              tone="sky"
            />
            <StatTile
              label={`รับจอง ${d.period.label}`}
              value={d.counts.bookedInPeriod}
              sub={`มัดจำในช่วงนี้ ${shortBaht(d.money.inPeriod)} บาท`}
              tone="emerald"
            />
            <StatTile
              label="เงินมัดจำที่ถืออยู่"
              value={shortBaht(d.money.total)}
              sub="เฉพาะใบที่ยังไม่จบงาน"
              tone="amber"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="รอส่งมอบนานที่สุด"
              count={d.counts.awaitingDelivery}
              hint={`เกิน ${BOOK_SLOW_DAYS} วันควรเร่ง`}
            >
              <AlertList rows={d.waitingLong} tone="rose" empty="ไม่มีใบค้างส่งมอบ" />
            </Panel>

            <Panel title="สัญญายังไม่ผ่าน" count={d.counts.docPending}>
              <AlertList rows={d.docPending} tone="amber" empty="สัญญาผ่านครบทุกใบ" />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="รับจองรายสาขา" hint={d.period.label}>
              <RankBars rows={d.byBranch} unit="ใบ" tone="sky" />
            </Panel>
            <Panel title="พนักงานขายที่รับจองสูงสุด" hint={d.period.label}>
              <RankBars rows={d.byStaff} unit="ใบ" tone="emerald" />
            </Panel>
            <Panel title="รุ่นรถที่ต้องเร่งสั่ง">
              <RankBars rows={d.byModel} unit="ใบ" tone="amber" />
            </Panel>
          </div>

          <WallPivot
            rows={d.pivot}
            dims={PIVOT_DIMS}
            metrics={PIVOT_METRICS}
            initialRow="model"
            initialCol="branch"
            note={`ใบจองที่รับใน ${d.period.label}`}
          />
        </div>
      )}
    </WallShell>
  );
}

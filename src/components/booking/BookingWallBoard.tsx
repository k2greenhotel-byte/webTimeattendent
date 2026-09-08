"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import { BOOK_SLOW_DAYS, type BookingWall } from "@/lib/wall-types";

const REFRESH_MS = 2 * 60_000;

type Branch = { id: string; name: string };

export default function BookingWallBoard({ branches }: { branches: Branch[] }) {
  const [branch, setBranch] = useState("");

  const qs = new URLSearchParams();
  if (branch) qs.set("branch", branch);

  return (
    <WallShell<BookingWall>
      title="คิวจองรถและการส่งมอบ"
      endpoint={`/api/booking/wall?${qs}`}
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
              label="รับจองเดือนนี้"
              value={d.counts.bookedThisMonth}
              sub={`มัดจำเดือนนี้ ${shortBaht(d.money.thisMonth)} บาท`}
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
            <Panel title="รับจองรายสาขา">
              <RankBars rows={d.byBranch} unit="ใบ" tone="sky" />
            </Panel>
            <Panel title="พนักงานขายที่รับจองสูงสุด">
              <RankBars rows={d.byStaff} unit="ใบ" tone="emerald" />
            </Panel>
            <Panel title="รุ่นรถที่ต้องเร่งสั่ง">
              <RankBars rows={d.byModel} unit="ใบ" tone="amber" />
            </Panel>
          </div>
        </div>
      )}
    </WallShell>
  );
}

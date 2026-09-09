"use client";

import Link from "next/link";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import { useWallPeriod, WallPeriodPicker } from "@/components/wall/WallFilters";
import { APV_SLOW_DAYS, type ApprovalWall } from "@/lib/wall-types";

/**
 * จอ War Room กล่องอนุมัติรวม — งานที่ค้างรออนุมัติทุกโปรแกรมในจอเดียว
 *
 * ตัวเลขเกือบทั้งหมดเป็นสถานะปัจจุบัน ไม่ขึ้นกับตัวกรองช่วงเวลา
 * มีแค่ "ยื่นเข้ามาในช่วงนี้" ที่ขยับตามช่วง ไว้ดูว่างานไหลเข้ามาเยอะแค่ไหน
 *
 * กล่องตัวเลขที่เป็นของค้างกดเข้าหน้ากล่องรออนุมัติได้เลย เห็นตัวเลขแล้วไปเคลียร์ต่อได้ทันที
 * ไม่ต้องกลับไปหาเมนูเอง (เปิดบนทีวีก็ไม่เสียอะไร เพราะไม่มีใครกด)
 */

const REFRESH_MS = 60_000;

/** ครอบกล่องตัวเลขให้กดเข้าหน้าอนุมัติได้ พร้อมขอบเรืองตอนชี้ ให้รู้ว่ากดได้ */
function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // [&>div]:h-full — ดันกล่องข้างในให้เต็มความสูงช่อง grid ทุกกล่องจะได้สูงเท่ากัน
    <Link
      href={href}
      className="block h-full rounded-2xl transition [&>div]:h-full hover:ring-2 hover:ring-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {children}
    </Link>
  );
}

export default function ApprovalWallBoard() {
  const { state, setState, period } = useWallPeriod();

  const qs = new URLSearchParams({ from: period.from, to: period.to });

  return (
    <WallShell<ApprovalWall>
      title="งานรออนุมัติ"
      endpoint={`/api/approvals/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={<WallPeriodPicker state={state} onChange={setState} period={period} />}
    >
      {(d) => (
        <div className="space-y-3 sm:space-y-4">
          {d.unavailable.length > 0 && (
            <p className="rounded-xl border border-amber-800 bg-amber-950 px-4 py-2 text-sm text-amber-200">
              ตัวเลขยังไม่ครบ — อ่านข้อมูลจาก {d.unavailable.join(" · ")} ไม่ได้ชั่วคราว
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <TileLink href="/approvals">
              <StatTile
                label="รออนุมัติตอนนี้"
                value={d.counts.pending}
                sub={`ดองเกิน ${APV_SLOW_DAYS} วัน ${d.counts.slow} เรื่อง`}
                tone={d.counts.slow > 0 ? "rose" : "sky"}
              />
            </TileLink>
            <TileLink href="/approvals">
              <StatTile
                label="ยอดเงินที่รออนุมัติ"
                value={shortBaht(d.money.pendingAmount)}
                sub="บาท (เฉพาะเรื่องที่มียอดเงิน)"
                tone="amber"
              />
            </TileLink>
            <TileLink href="/approvals">
              <StatTile
                label="ค้างนานที่สุด"
                value={d.oldest.length > 0 ? d.oldest[0].right : "—"}
                sub={d.oldest.length > 0 ? d.oldest[0].title : "ไม่มีเรื่องค้าง"}
                tone="rose"
              />
            </TileLink>
            <StatTile
              label={`ยื่นเข้ามา ${d.period.label}`}
              value={d.counts.submittedInPeriod}
              sub="งานที่ไหลเข้ามาในช่วงที่เลือก"
              tone="emerald"
            />
          </div>

          <p className="text-xs text-slate-500">
            กดที่กล่องตัวเลขเพื่อเปิด{" "}
            <Link href="/approvals" className="text-sky-400 hover:underline">
              กล่องรออนุมัติ
            </Link>{" "}
            แล้วกดอนุมัติได้ทันที
          </p>

          {/* แยกว่างานกองอยู่โปรแกรมไหน — ดูแล้วรู้ทันทีว่าต้องไปเคลียร์ที่ไหน
              ทุกกล่องพาไปหน้าเดียวกัน เพราะตอนนี้กล่องรออนุมัติกดจบได้ครบทุกประเภทแล้ว */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <TileLink href="/approvals">
              <StatTile label="เรื่องส่วนกลาง" value={d.counts.central} tone="violet" />
            </TileLink>
            <TileLink href="/approvals">
              <StatTile label="ขอซ่อม / จัดซื้อ" value={d.counts.procurement} tone="sky" />
            </TileLink>
            <TileLink href="/approvals">
              <StatTile label="ใบลา" value={d.counts.leave} tone="emerald" />
            </TileLink>
            <TileLink href="/approvals">
              <StatTile label="ขอเบิกเงินเดือน" value={d.counts.advance} tone="amber" />
            </TileLink>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel
                title="ค้างนานที่สุด — ต้องเคลียร์ก่อน"
                count={d.counts.pending}
                hint={`เกิน ${APV_SLOW_DAYS} วันถือว่าดอง`}
              >
                <AlertList rows={d.oldest} tone="rose" empty="ไม่มีเรื่องรออนุมัติ 🎉" />
              </Panel>
            </div>

            <div className="space-y-3">
              <Panel title="ค้างอยู่ที่โปรแกรมไหน">
                <RankBars rows={d.byModule} unit="เรื่อง" tone="sky" empty="ไม่มีเรื่องค้าง" />
              </Panel>
              <Panel title="ใครยื่นเข้ามามากที่สุด">
                <RankBars rows={d.byRequester} unit="เรื่อง" tone="violet" empty="ไม่มีเรื่องค้าง" />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </WallShell>
  );
}

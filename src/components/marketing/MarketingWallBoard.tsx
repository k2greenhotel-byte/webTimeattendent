"use client";

import { useState } from "react";
import WallShell from "@/components/wall/WallShell";
import { AlertList, Panel, RankBars, shortBaht, StatTile } from "@/components/wall/WallParts";
import { MKT_SLOW_DAYS, type MarketingWall } from "@/lib/wall-types";

/** ยอดเงินไม่ได้เปลี่ยนทุกนาทีเหมือนการลงเวลา จึงรีเฟรชห่างกว่า */
const REFRESH_MS = 2 * 60_000;

type Option = { id: string; name: string };

export default function MarketingWallBoard({
  companies,
  activityTypes = [],
}: {
  companies: Option[];
  activityTypes?: Option[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (company) qs.set("company", company);
  if (type) qs.set("type", type);

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100";

  return (
    <WallShell<MarketingWall>
      title="เงินค่าส่งเสริมการขาย"
      endpoint={`/api/marketing/wall?${qs}`}
      refreshMs={REFRESH_MS}
      controls={
        <>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
            aria-label="ตั้งแต่วันที่"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
            aria-label="ถึงวันที่"
          />
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
            aria-label="บริษัทที่ขอเบิก"
          >
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {activityTypes.length > 0 && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputCls}
              aria-label="ประเภทกิจกรรม"
            >
              <option value="">ทุกประเภทกิจกรรม</option>
              {activityTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {(from || to || company || type) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
                setCompany("");
                setType("");
              }}
              className="rounded-md bg-sky-500 px-3 py-1 text-sm text-white"
            >
              ล้างตัวกรอง
            </button>
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
              label="ใบกิจกรรมที่ใช้งาน"
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

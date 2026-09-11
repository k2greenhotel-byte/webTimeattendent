"use client";

import { useMemo, useState } from "react";
import type { Db2Jobs, Db2OpenJob } from "@/lib/db2-api";
import {
  OPEN_BUCKET,
  OPEN_BUCKET_ORDER,
  OPEN_STATUS,
  SW_STATUS_LABEL,
  openStatusOf,
  type Db2OpenBucket,
  type Db2OpenStatus,
} from "@/lib/db2-jobs";

/**
 * กล่อง "งานซ่อมที่ค้างปิด job" — ให้หัวหน้าสาขาไล่เคลียร์ได้จริง
 *
 * ยอดรวมอย่างเดียวหลอกตา (2 ใน 3 เป็นงานเคลมซึ่งเป็นเรื่องปกติของกระบวนการเคลม)
 * จอนี้จึงแยกเป็น 4 กลุ่มตามสิ่งที่ต้องลงมือทำ แล้วให้กรอง/ค้น/โหลดเป็นไฟล์ไปแจกสาขาได้
 *
 * ตัวเลขทั้งหมดมาจาก API (นับทั้งฐาน) — ฝั่งนี้แค่กรองรายการที่ส่งมาแล้วเท่านั้น
 */

const TONE: Record<"bad" | "warn" | "info", { box: string; text: string; bar: string }> = {
  bad: { box: "border-rose-300 bg-rose-50", text: "text-rose-700", bar: "bg-rose-500" },
  warn: { box: "border-amber-300 bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  info: { box: "border-slate-300 bg-slate-50", text: "text-slate-600", bar: "bg-slate-400" },
};
/**
 * วาดตารางสูงสุดกี่แถว — ทั้ง 1,229 ใบทำให้หน้าหนักเกิน 2 MB และเปิดช้าบนมือถือ
 * ข้อมูลยังอยู่ครบในหน่วยความจำ ปุ่มโหลดไฟล์จึงได้ครบทุกใบตามตัวกรองเสมอ
 */
const MAX_ROWS = 200;

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};

export default function OpenJobsPanel({
  open,
  branchFilter,
  branchLabel,
}: {
  open: Db2Jobs["open"];
  branchFilter: string;
  branchLabel?: string | null;
}) {
  const [bucket, setBucket] = useState<Db2OpenBucket | "">("");
  const [status, setStatus] = useState<Db2OpenStatus | "">("");
  const [q, setQ] = useState("");
  const [olderThan, setOlderThan] = useState(0);

  // แอป Db2 เวอร์ชันก่อนหน้าไม่มีสามฟิลด์นี้ — ต้องยังเปิดหน้าได้ ไม่ใช่จอขาว
  const byBucket = open.byBucket ?? [];
  const byType = open.byType ?? [];
  const legacy = !open.byBucket;
  const bucketOf = useMemo(() => new Map(byBucket.map((b) => [b.key, b])), [byBucket]);

  /**
   * แยกตามสถานะในโปรแกรมเดิม — ทุกใบที่ยังไม่ปิดเป็น W หรือ R อย่างใดอย่างหนึ่งเสมอ
   * นับจากรายการที่ส่งมา ถ้ารายการถูกตัด (แอปเวอร์ชันเก่า) ให้ถอยไปใช้ยอดรวมลบจำนวน W รายสาขา
   */
  const byStatus = useMemo(() => {
    const full = open.list.length >= open.totals.jobs;
    if (full) {
      let w = 0;
      for (const j of open.list) if (openStatusOf(j) === "W") w += 1;
      return { W: w, R: open.list.length - w, exact: true };
    }
    const w = open.byBranch.reduce((s, b) => s + (b.waiting ?? 0), 0);
    return { W: w, R: open.totals.jobs - w, exact: true };
  }, [open.list, open.byBranch, open.totals.jobs]);

  const allRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return open.list.filter((j) => {
      if (bucket && (j.bucket ?? "idle") !== bucket) return false;
      if (status && openStatusOf(j) !== status) return false;
      if (olderThan && j.ageDays <= olderThan) return false;
      if (!needle) return true;
      return [j.jobno, j.branch ?? j.locat, j.customer, j.regno, j.repName ?? j.repcod, j.modelName ?? j.model]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [open.list, bucket, q, olderThan]);
  const rows = allRows.slice(0, MAX_ROWS);

  function downloadCsv() {
    const head = [
      "เลขที่ใบงาน", "สาขา", "วันรับรถ", "ค้าง (วัน)", "กลุ่ม", "ประเภทงาน", "สถานะงานซ่อม",
      "ช่าง", "ผู้รับรถ", "รุ่นรถ", "ทะเบียน", "เลขตัวถัง", "ลูกค้า", "โทร",
      "วันซ่อมเสร็จ", "วันที่ใบกำกับ", "เงินในหัวใบ", "ยอดต้องเก็บ",
    ];
    const lines = [head];
    for (const j of allRows) {
      lines.push([
        j.jobno,
        j.branch ?? j.locat,
        j.recvDate ?? "",
        String(j.ageDays),
        OPEN_BUCKET[j.bucket]?.label ?? j.bucket ?? "",
        j.reptypeName ?? j.reptype,
        SW_STATUS_LABEL[j.swstatus] ?? j.swstatus,
        j.repName ?? j.repcod,
        j.recvName ?? j.recvcod,
        j.modelName ?? j.model,
        j.regno,
        j.strno,
        j.customer,
        j.mobile || j.tel,
        j.finishDate ?? "",
        j.taxDate ?? "",
        String(j.net),
        String(j.billable ?? 0),
      ]);
    }
    // BOM หน้าไฟล์ ไม่งั้น Excel เปิดภาษาไทยเป็นตัวยึกยือ
    const csv = "﻿" + lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const suffix = [bucket ? OPEN_BUCKET[bucket].label : "", status ? OPEN_STATUS[status].label : ""]
      .filter(Boolean)
      .join("-");
    a.download = `งานค้างปิดjob-${branchFilter || "ทุกสาขา"}${suffix ? `-${suffix}` : ""}.csv`;
    a.click();
  }

  const hidden = allRows.length - rows.length;

  const truncated = open.totals.jobs > open.list.length;

  return (
    <section className="card border-amber-200 bg-amber-50/40">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-800">
          งานซ่อมที่ค้างปิด job — {int(open.totals.jobs)} ใบ
          {branchFilter ? ` (สาขา ${branchLabel ?? branchFilter})` : " (ทุกสาขา)"}
        </h2>
        <span className="text-xs text-slate-500">นับทั้งฐานข้อมูล ไม่ขึ้นกับช่วงวันที่ที่เลือกด้านบน</span>
      </div>

      {legacy && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
          แอป Db2 ในบริษัทยังเป็นเวอร์ชันก่อนหน้า จึงยังไม่มีการแยกสาเหตุและยอดที่ต้องเก็บ —
          ยอดรวมและรายการด้านล่างยังถูกต้อง
        </p>
      )}

      {/* แยกตามสถานะในโปรแกรมเดิม — คำถามแรกคือ "รถยังค้างซ่อมอยู่กี่ใบ" */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(["W", "R"] as Db2OpenStatus[]).map((k) => {
          const meta = OPEN_STATUS[k];
          const active = status === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(active ? "" : k)}
              className={`rounded-xl border bg-white p-3 text-left transition ${active ? "ring-2 ring-brand-500" : "hover:bg-slate-50"}`}
              style={{ borderColor: meta.color }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
                <span className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>
                  {int(byStatus[k])}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-500">{meta.hint}</p>
            </button>
          );
        })}
      </div>

      {/* แยกตามสิ่งที่ต้องลงมือทำ — กดเพื่อกรอง */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {OPEN_BUCKET_ORDER.map((k) => {
          const b = bucketOf.get(k);
          const meta = OPEN_BUCKET[k];
          const t = TONE[meta.tone];
          const active = bucket === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setBucket(active ? "" : k)}
              className={`rounded-xl border p-3 text-left transition ${t.box} ${active ? "ring-2 ring-brand-500" : "hover:brightness-95"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
                <span className={`text-2xl font-bold tabular-nums ${t.text}`}>{int(b?.jobs ?? 0)}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-500">{meta.hint}</p>
              <p className="mt-1 text-xs text-slate-500">
                {(b?.billable ?? 0) > 0 && <span className="font-semibold text-rose-700">ยอดต้องเก็บ {baht(b!.billable)} บาท · </span>}
                ค้างเกิน 1 ปี {int(b?.overYear ?? 0)} ใบ
              </p>
            </button>
          );
        })}
      </div>

      {/* แยกตามประเภทงานซ่อม — อธิบายว่ายอดรวมมาจากไหน */}
      <p className="mt-3 text-xs text-slate-600">
        ตามประเภทงาน:{" "}
        {byType.map((t, i) => (
          <span key={t.key}>
            {i > 0 && " · "}
            {t.label ?? t.key} <span className="font-semibold tabular-nums">{int(t.jobs)}</span>
          </span>
        ))}
      </p>

      {/* รายสาขา */}
      <h3 className="mt-4 mb-1 text-sm font-semibold text-slate-700">แยกตามสาขา</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">สาขา</th>
              <th className="py-1 text-right">ใบค้างทั้งหมด</th>
              <th className="py-1 text-right">ค้างซ่อม (W)</th>
              <th className="py-1 text-right">เปิดงานค้าง (R)</th>
              <th className="py-1 text-right">ไม่ใช่งานเคลม</th>
              <th className="py-1 text-right">มีเงินค้างเก็บ</th>
              <th className="py-1 text-right">ยอดต้องเก็บ</th>
              <th className="py-1 text-right">เกิน 1 ปี</th>
              <th className="py-1">ใบเก่าสุดรับเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {open.byBranch.map((b) => (
              <tr key={b.key} className="border-t border-amber-100">
                <td className="py-1">
                  {b.label ?? b.key} <span className="text-slate-400">({b.key})</span>
                </td>
                <td className="py-1 text-right tabular-nums">{int(b.jobs)}</td>
                <td className={`py-1 text-right font-bold tabular-nums ${(b.waiting ?? 0) > 0 ? "text-rose-700" : "text-slate-400"}`}>
                  {int(b.waiting ?? 0)}
                </td>
                <td className="py-1 text-right tabular-nums text-sky-700">{int(b.jobs - (b.waiting ?? 0))}</td>
                <td className="py-1 text-right font-semibold tabular-nums">{int(b.nonClaim ?? 0)}</td>
                <td className={`py-1 text-right tabular-nums ${(b.withMoney ?? 0) > 0 ? "text-rose-700" : "text-slate-400"}`}>
                  {int(b.withMoney ?? 0)}
                </td>
                <td className="py-1 text-right tabular-nums">{(b.billable ?? 0) > 0 ? baht(b.billable) : "—"}</td>
                <td className="py-1 text-right tabular-nums text-slate-500">{int(b.overYear)}</td>
                <td className="py-1">{thDate(b.oldest)}</td>
              </tr>
            ))}
            {open.byBranch.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-center text-slate-500">
                  ไม่มีงานค้างปิด
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* รายการทีละใบ + ตัวกรอง + ส่งออก */}
      <div className="mt-4 mb-2 flex flex-wrap items-end gap-2">
        <h3 className="mr-auto text-sm font-semibold text-slate-700">
          รายการงานค้าง {int(allRows.length)} ใบ
          {(bucket || status) && (
            <span className="font-normal text-slate-500">
              {" "}
              (กรอง: {[bucket && OPEN_BUCKET[bucket].label, status && OPEN_STATUS[status].label].filter(Boolean).join(" + ")})
            </span>
          )}
          {!bucket && truncated && (
            <span className="font-normal text-slate-500"> จากทั้งหมด {int(open.totals.jobs)} ใบ</span>
          )}
        </h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นเลขที่ใบงาน / ลูกค้า / ทะเบียน / ช่าง"
          className="input w-64 text-sm"
        />
        <select value={olderThan} onChange={(e) => setOlderThan(Number(e.target.value))} className="input text-sm">
          <option value={0}>ทุกอายุ</option>
          <option value={30}>ค้างเกิน 30 วัน</option>
          <option value={90}>ค้างเกิน 90 วัน</option>
          <option value={365}>ค้างเกิน 1 ปี</option>
        </select>
        {(bucket || status) && (
          <button
            type="button"
            onClick={() => {
              setBucket("");
              setStatus("");
            }}
            className="btn-secondary text-sm"
          >
            ล้างตัวกรอง
          </button>
        )}
        <button type="button" onClick={downloadCsv} className="btn-secondary text-sm" disabled={rows.length === 0}>
          โหลดเป็นไฟล์ Excel (CSV)
        </button>
      </div>

      <div className="max-h-[30rem] overflow-auto rounded-lg border border-amber-100 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-amber-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1">เลขที่ใบงาน</th>
              <th className="px-2 py-1">สาขา</th>
              <th className="px-2 py-1">รับรถ</th>
              <th className="px-2 py-1 text-right">ค้าง (วัน)</th>
              <th className="px-2 py-1">กลุ่ม</th>
              <th className="px-2 py-1">สถานะในโปรแกรม</th>
              <th className="px-2 py-1">ประเภทงาน</th>
              <th className="px-2 py-1">ช่าง</th>
              <th className="px-2 py-1">รถ / ทะเบียน</th>
              <th className="px-2 py-1">ลูกค้า</th>
              <th className="px-2 py-1">โทร</th>
              <th className="px-2 py-1 text-right">ยอดต้องเก็บ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <Row key={j.jobno} j={j} />
            ))}
            {hidden > 0 && (
              <tr>
                <td colSpan={12} className="bg-amber-50 px-2 py-2 text-center text-xs text-slate-600">
                  แสดง {int(MAX_ROWS)} ใบแรกจาก {int(allRows.length)} ใบ — กรองให้แคบลง
                  หรือกดโหลดเป็นไฟล์เพื่อดูครบทุกใบ (อีก {int(hidden)} ใบ)
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-4 text-center text-slate-500">
                  ไม่มีใบงานที่ตรงเงื่อนไข
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        &ldquo;ค้างซ่อม&rdquo; คือใบที่สถานะในโปรแกรมเดิมยังเป็น W · ใบสถานะ W ที่ถูกยกเลิกไปแล้วไม่ถูกนับ ·
        &ldquo;ยอดต้องเก็บ&rdquo; นับเฉพาะรายการที่เรียกเก็บจากลูกค้า (ไม่รวมของเคลมและประกัน ซึ่งเบิกจากค่ายรถ) ·
        ระบบนี้อ่านข้อมูลอย่างเดียว การกดปิด job ต้องทำในโปรแกรมขายเดิม
      </p>
    </section>
  );
}

function Row({ j }: { j: Db2OpenJob }) {
  const meta = OPEN_BUCKET[j.bucket];
  const billable = j.billable ?? 0;
  const t = TONE[meta?.tone ?? "info"];
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-2 py-1 font-mono text-xs">{j.jobno}</td>
      <td className="px-2 py-1">{j.branch ?? j.locat}</td>
      <td className="px-2 py-1 whitespace-nowrap">{thDate(j.recvDate)}</td>
      <td
        className={`px-2 py-1 text-right tabular-nums ${j.ageDays > 365 ? "font-semibold text-rose-700" : j.ageDays > 30 ? "text-amber-700" : ""}`}
      >
        {int(j.ageDays)}
      </td>
      <td className="px-2 py-1">
        {meta && (
          <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${t.box} ${t.text}`}>{meta.label}</span>
        )}
      </td>
      <td className="px-2 py-1">
        {j.swstatus ? (
          <span className={`whitespace-nowrap font-medium ${j.swstatus === "W" ? "text-rose-700" : "text-slate-600"}`}>
            {SW_STATUS_LABEL[j.swstatus] ?? j.swstatus} ({j.swstatus})
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-2 py-1">{j.reptypeName ?? j.reptype}</td>
      <td className="px-2 py-1">{j.repName ?? (j.repcod || "—")}</td>
      <td className="px-2 py-1">
        {j.modelName ?? j.model}
        {j.regno && <span className="block text-xs text-slate-500">{j.regno}</span>}
      </td>
      <td className="px-2 py-1">{j.customer || "—"}</td>
      <td className="px-2 py-1 whitespace-nowrap">{j.mobile || j.tel || "—"}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${billable > 0 ? "font-semibold text-rose-700" : "text-slate-400"}`}>
        {billable > 0 ? baht(billable) : "—"}
      </td>
    </tr>
  );
}

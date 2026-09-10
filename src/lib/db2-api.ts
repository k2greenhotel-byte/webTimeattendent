import "server-only";
import { Db2Unreachable, db2Fetch, type Db2Upstream } from "./db2-fetch";

/**
 * ไคลเอนต์เรียก "แอปข้อมูลสดจากระบบขาย (Db2)" ที่รันในบริษัท (เซิร์ฟเวอร์ 192.168.1.200)
 *
 *   DB2_API_URL           https://sales.kmsgroup.app            (Cloudflare Tunnel — หลัก)
 *   DB2_API_URL_FALLBACK  https://db2-sales.tail9c6195.ts.net  (Tailscale Funnel — สำรอง) — ดู db2-fetch.ts
 *   DB2_API_KEY           ค่าเดียวกับ API_KEY ใน .env.local ของแอป Db2   (wrangler secret / .env.local)
 *
 * ทุกคำขอเป็น server-to-server เท่านั้น (header x-api-key) — ห้ามเรียกจากฝั่ง browser
 * ข้อมูลเป็นของสดจาก Db2 ณ เวลาที่เรียก จึงไม่ cache
 */

export class Db2ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 20_000;

/** เรียกแอป Db2 ผ่าน db2Fetch (ลอง DB2_API_URL แล้วถอยไป DB2_API_URL_FALLBACK ให้เอง) */
async function call<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const pathWithQuery = qs.size ? `${path}?${qs}` : path;

  let upstream: Db2Upstream;
  try {
    upstream = await db2Fetch(pathWithQuery, TIMEOUT_MS);
  } catch (err) {
    // คง status ไว้ด้วย — 404 คือ "ยังไม่ได้ build เอนด์พอยต์นี้บนเซิร์ฟเวอร์" ไม่ใช่ "เครื่องดับ"
    throw new Db2ApiError(
      err instanceof Error ? err.message : "ต่อระบบขาย (Db2) ไม่ได้",
      err instanceof Db2Unreachable ? err.status : undefined,
    );
  }

  let body: { ok?: boolean; error?: string };
  try {
    body = JSON.parse(upstream.text);
  } catch {
    body = {};
  }
  if (!upstream.res.ok || body.ok === false) {
    throw new Db2ApiError(body.error ?? `ระบบขายตอบ HTTP ${upstream.res.status}`, upstream.res.status);
  }
  return body as T;
}

/* -------------------------------------------------------------------------- */
/* ชนิดข้อมูลตามที่แอป Db2 ส่งกลับ                                              */
/* -------------------------------------------------------------------------- */

/**
 * ตัวเลขเงินทุกชุด: sale = ราคาขายก่อน VAT · vat = VAT ขาย · gross = รวม VAT ·
 * cost = ต้นทุนรถก่อน VAT · profit = sale − cost (ก่อน VAT ทั้งคู่)
 */
export type Db2Money = { sale: number; vat: number; gross: number; cost: number; profit: number };
export type Db2Group = Db2Money & { key: string; units: number };

export type Db2Dashboard = {
  filters: { from: string; to: string; locat?: string; tsale?: string; stat?: string };
  summary: Db2Money & { units: number; marginPct: number | null; noCost: number; noNet: number };
  monthly: (Db2Money & { year: number; month: number; units: number })[];
  byChannel: Db2Group[];
  byBranch: Db2Group[];
  byCondition: Db2Group[];
  byModel: Db2Group[];
  byStatus: Db2Group[];
  branches: string[];
};

export type Db2Stock = {
  filters: { locat?: string; stat?: string };
  summary: { units: number; cost: number; avgAgeDays: number | null; oldest: string | null };
  aging: { bucket: number; label: string; units: number; cost: number }[];
  byBranch: { key: string; units: number; cost: number }[];
  byModel: { key: string; units: number; cost: number }[];
  oldest: {
    strno: string;
    model: string;
    color: string;
    locat: string;
    stat: string;
    receivedDate: string | null;
    ageDays: number;
    cost: number | null;
  }[];
  branches: string[];
};

export type Db2Customer = {
  cuscod: string;
  title: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nickname: string;
  idcard: string;
  birthDate: string | null;
  mobile: string;
  phone: string;
  address: { line: string; moo: string; subdistrict: string; districtCode: string; provinceCode: string; zip: string };
  occupation: string;
  branch: string;
};

export type Db2CustomerDetail = {
  customer: Db2Customer;
  hirePurchase: {
    count: number;
    remainingTotal: number;
    contracts: {
      locat: string;
      contno: string;
      strno: string;
      saleDate: string | null;
      total: number | null;
      downPayment: number | null;
      remaining: number;
      paidSum: number;
      lastPayDate: string | null;
      lastPayAmount: number | null;
      contstat: string;
    }[];
  };
  purchases: {
    locat: string;
    channel: string;
    channelLabel: string;
    contno: string;
    saleDate: string | null;
    model: string;
    color: string;
    strno: string;
    condition: string;
    price: number | null;
  }[];
};

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

export const TSALE_LABEL: Record<string, string> = { H: "ผ่อน", C: "สด", F: "ไฟแนนซ์", A: "ส่งเอเย่นต์" };
export const STAT_LABEL: Record<string, string> = { N: "รถใหม่", O: "รถเก่า" };

/** ยอดขายรวมทุกช่องทางในช่วงวันที่ (ค่าเริ่มต้นฝั่ง Db2ตั้งแต่ต้นปีถึงวันนี้) */
export function db2Dashboard(f: { from?: string; to?: string; locat?: string; tsale?: string; stat?: string } = {}) {
  return call<Db2Dashboard>("/api/dashboard", f);
}

/** สต็อกรถคงเหลือ (INVTRAN FLAG='D') */
export function db2Stock(f: { locat?: string; stat?: string } = {}) {
  return call<Db2Stock>("/api/stock", f);
}

/** ค้นลูกค้าจากรหัส ชื่อ นามสกุล เลขบัตร เบอร์ — สูงสุด 50 ราย */
export function db2SearchCustomers(q: string) {
  return call<{ count: number; truncated: boolean; customers: Db2Customer[] }>("/api/customers", { q });
}

/** ลูกค้าหนึ่งราย + สัญญาผ่อน (คงเหลือจริง) + รถที่เคยซื้อทุกช่องทาง */
export function db2Customer(cuscod: string) {
  return call<Db2CustomerDetail>(`/api/customers/${encodeURIComponent(cuscod)}`);
}

/* -------------------------------------------------------------------------- */
/* จัดรูปตัวเลข/วันที่สำหรับหน้าเว็บ                                             */
/* -------------------------------------------------------------------------- */

export const fmtInt = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString("th-TH");

export const fmtBaht = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** 2026, 9 → "ก.ย. 69" */
export const fmtMonth = (y: number, m: number) => `${TH_MONTH[m - 1] ?? m} ${String(y + 543).slice(-2)}`;

/** "2026-08-16" → "16 ส.ค. 2569" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

/** วันนี้ตามเวลาไทยเป็น YYYY-MM-DD */
export function todayTH(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* ข้อมูลหลักรถ + รายการสต็อกรายคัน (ใช้โดยระบบจองรถ)                            */
/* -------------------------------------------------------------------------- */

/** ชนิดข้อมูลหลักที่ระบบจองรถเลือกได้ — ตรงกับ MASTER_KINDS ฝั่งแอป Db2 */
export type Db2MasterKind = "brand" | "model" | "variant" | "color" | "group";

export const DB2_MASTER_TITLE: Record<Db2MasterKind, string> = {
  brand: "ยี่ห้อรถ",
  model: "รุ่นรถ",
  variant: "แบบรถ",
  color: "สีรถ",
  group: "ประเภทรถ",
};

export type Db2MasterItem = {
  code: string;
  name: string;
  /** ยี่ห้อของรุ่นรถ (เฉพาะ kind = model) */
  parent: string | null;
};

export type Db2MasterResult = {
  kind: Db2MasterKind;
  title: string;
  /** จำนวนที่ตรงเงื่อนไขทั้งหมด (ก่อนตัดตาม limit) */
  matched: number;
  truncated: boolean;
  count: number;
  items: Db2MasterItem[];
};

/**
 * ค้นข้อมูลหลักรถจากระบบขาย — ออกแบบให้ "พิมพ์ค้นทีละน้อย" ไม่ใช่ดึงทั้งตาราง
 * (SETMODEL ~500 แถว · SETBAAB มากกว่านั้น — ทำ dropdown ไม่ไหว)
 *   q     คำค้น เทียบทั้งรหัสและชื่อ
 *   brand กรองรุ่นตามยี่ห้อ (เฉพาะ kind = model)
 *   codes ดึงเฉพาะรหัสที่ระบุ — ใช้แสดงชื่อของค่าที่บันทึกไว้แล้ว
 */
export function db2Masters(f: {
  kind: Db2MasterKind;
  q?: string;
  brand?: string;
  codes?: string[];
  limit?: number;
}) {
  const params: Record<string, string | undefined> = {
    kind: f.kind,
    q: f.q,
    brand: f.brand,
    limit: f.limit ? String(f.limit) : undefined,
  };
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  for (const code of f.codes ?? []) search.append("code", code);

  return call<Db2MasterResult>(`/api/masters?${search.toString()}`);
}

/** รถหนึ่งคันในสต็อก — ไม่มีราคาทุนโดยตั้งใจ (หน้านี้พนักงานขายทุกคนเปิดดูได้) */
export type Db2StockUnit = {
  strno: string;
  engno: string;
  group: string;
  groupName: string;
  brand: string;
  model: string;
  modelName: string;
  variant: string;
  variantName: string;
  color: string;
  locat: string;
  stat: string;
  receivedDate: string | null;
  ageDays: number | null;
};

/**
 * ยอดรถในสต็อกหนึ่งแถว = รุ่น + แบบ + สี + **สถานที่เก็บ**
 * ฝั่งหน้าเว็บรวมเป็นระดับ รุ่น/แบบ/สี เพื่อ map กับใบจอง แล้วกางดูสาขาได้จากแถวเดิม
 */
export type Db2StockCombo = {
  model: string;
  modelName: string;
  variant: string;
  variantName: string;
  color: string;
  locat: string;
  units: number;
};

export type Db2StockList = {
  total: number;
  count: number;
  truncated: boolean;
  units: Db2StockUnit[];
  combos: Db2StockCombo[];
  dims: Record<string, { title: string; values: { key: string; label: string; units: number }[] }>;
};

export type Db2StockFilter = {
  brand?: string;
  model?: string;
  variant?: string;
  color?: string;
  branch?: string;
  condition?: string;
  q?: string;
  limit?: number;
};

/** รายการรถคงเหลือรายคัน กรองตามยี่ห้อ/รุ่น/แบบ/สี/สาขาที่เก็บ */
export function db2StockList(f: Db2StockFilter = {}) {
  return call<Db2StockList>("/api/stock/list", {
    brand: f.brand,
    model: f.model,
    variant: f.variant,
    color: f.color,
    branch: f.branch,
    condition: f.condition,
    q: f.q,
    limit: f.limit ? String(f.limit) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* War room: ยอดขายแยกตามมิติ (ใช้โดยระบบบันทึกงานประจำวันพนักงานขาย)            */
/* -------------------------------------------------------------------------- */

export type Db2WallItem = Db2Money & { key: string; label: string | null; units: number };

/**
 * ผลลัพธ์ /api/wall เท่าที่ฝั่ง server ใช้ — มิติที่มี:
 * branch · salesman · model · brand · channel · condition · color · group · finance
 */
export type Db2Wall = {
  range: { from: string; to: string; days: number };
  kpi: Db2Money & { units: number };
  dims: Record<string, { title: string; items: Db2WallItem[] }>;
};

/** ยอดขายในช่วงวันที่ แยกตามทุกมิติ (ค่าเริ่มต้นฝั่ง Db2 = ตั้งแต่ต้นเดือนถึงวันนี้ · กว้างสุด 400 วัน) */
export function db2Wall(f: { from?: string; to?: string; locat?: string } = {}) {
  return call<Db2Wall>("/api/wall", f);
}

/**
 * รายชื่อพนักงานขายที่มีการขายจริงในช่วงที่ระบุ (SALCOD + ชื่อเท่าที่ระบบขายมี)
 * ใช้เป็นตัวเลือกในหน้าจอจับคู่พนักงานขาย — ระบบขายไม่มีทะเบียนพนักงานขายแยกต่างหาก
 */
export async function db2Salesmen(f: { from?: string; to?: string } = {}) {
  const wall = await db2Wall(f);
  return (wall.dims?.salesman?.items ?? [])
    .filter((i) => i.key && i.key !== "?")
    .map((i) => ({ salcod: i.key, name: i.label, units: i.units }));
}

/* -------------------------------------------------------------------------- */
/* รถของลูกค้า (ใช้โดยระบบแจ้งเคลม)                                             */
/* -------------------------------------------------------------------------- */

/**
 * รถหนึ่งคันที่ค้นเจอจากระบบขาย — รวมข้อมูลรถ การขาย และลูกค้าไว้ในแถวเดียว
 * (แอป Db2 ต่อ INVTRAN + VIEW_SALEALL + CUSTMAST ให้แล้วที่ /api/vehicles)
 * ไม่มีราคาขาย/ต้นทุนโดยตั้งใจ — หน้าจอแจ้งเคลมเปิดให้พนักงานหน้าร้านทุกคนใช้
 */
export type Db2Vehicle = {
  strno: string;
  engno: string;
  brand: string;
  model: string;
  modelName: string;
  variant: string;
  variantName: string;
  color: string;
  group: string;
  groupName: string;
  /** N รถใหม่ · O รถเก่า */
  stat: string;
  /** C = ขายออกไปแล้ว · D = ยังอยู่ในสต็อก */
  flag: string;
  stockLocat: string;
  sale: { locat: string; contno: string; date: string | null; tsale: string };
  customer: { cuscod: string; fullName: string; mobile: string; phone: string; address: string };
};

export type Db2VehicleResult = {
  /** จำนวนที่ตรงเงื่อนไขทั้งหมด (ก่อนตัดตาม limit) */
  matched: number;
  count: number;
  truncated: boolean;
  vehicles: Db2Vehicle[];
};

/**
 * ค้นรถของลูกค้าจากระบบขาย — คำค้นเดียวเทียบได้ทั้ง
 * เลขตัวถัง · เลขเครื่อง · เลขที่สัญญา · รหัสลูกค้า · ชื่อ · นามสกุล · เบอร์มือถือ
 *   sold = true  เฉพาะรถที่ขายออกไปแล้ว (งานเคลมตามปกติ)
 */
export function db2Vehicles(f: { q: string; limit?: number; sold?: boolean }) {
  return call<Db2VehicleResult>("/api/vehicles", {
    q: f.q,
    limit: f.limit ? String(f.limit) : undefined,
    sold: f.sold ? "1" : undefined,
  });
}

/** เบอร์ที่ใช้ติดต่อลูกค้าได้จริง — มือถือมาก่อน ไม่มีจึงใช้เบอร์บ้าน */
export function db2VehiclePhone(v: Db2Vehicle): string {
  return v.customer.mobile || v.customer.phone || "";
}

/* -------------------------------------------------------------------------- */
/* ทะเบียนพนักงานในระบบขาย (OFFICER) — ใช้จับคู่ชื่อพนักงานขาย                    */
/* -------------------------------------------------------------------------- */

/**
 * พนักงานหนึ่งคนในทะเบียนของระบบขาย (`ASVSHPV.OFFICER`)
 *
 * `code` เป็นรหัสเดียวกับ `SALCOD` ในรายการขาย — ตรวจกับข้อมูลจริง 2026-09-07 แล้วว่า
 * ครอบคลุมคนที่ขายจริงรอบ 12 เดือนครบ 33/33 รหัส
 * ตารางนี้มีทั้งพนักงานทุกแผนกและรายการที่ไม่ใช่คน (ชื่อบริษัท/ระบบ) จึงต้องดู `units`
 * ประกอบว่ารหัสไหนคือพนักงานขายตัวจริง — `department` ใช้แยกไม่ได้ (คนขายกระจายหลายแผนก)
 */
export type Db2Officer = {
  code: string;
  name: string;
  branch: string | null;
  department: string | null;
  position: string | null;
  /** ยังทำงานอยู่ (OFFICER.STATUS = 'Y') */
  active: boolean;
  /** จำนวนคันที่ขายได้ในช่วงที่ถาม (null = ไม่ได้สั่งให้นับ) */
  units: number | null;
};

export type Db2OfficerResult = {
  filters: { q: string | null; status: string; locat: string | null };
  range: { from: string; to: string } | null;
  matched: number;
  truncated: boolean;
  count: number;
  officers: Db2Officer[];
};

/**
 * ทะเบียนพนักงานจากระบบขาย — ค่าเริ่มต้นคือคนที่ยังทำงานอยู่ พร้อมยอดขาย 365 วันล่าสุด
 *   status  "Y" ยังทำงานอยู่ (ค่าเริ่มต้น) · "N" ออกแล้ว · "all" ทั้งหมด
 *   codes   ดึงเฉพาะรหัสที่ระบุ — ใช้แสดงชื่อของค่าที่บันทึกไว้แล้ว
 *   units   false = ไม่ต้องนับยอดขาย (เร็วขึ้นมากเมื่อไม่ได้ใช้)
 */
export function db2Officers(
  f: {
    q?: string;
    status?: "Y" | "N" | "all";
    locat?: string;
    codes?: string[];
    from?: string;
    to?: string;
    units?: boolean;
    limit?: number;
  } = {},
) {
  const search = new URLSearchParams();
  if (f.q) search.set("q", f.q);
  if (f.status) search.set("status", f.status);
  if (f.locat) search.set("locat", f.locat);
  if (f.from) search.set("from", f.from);
  if (f.to) search.set("to", f.to);
  if (f.units === false) search.set("units", "0");
  if (f.limit) search.set("limit", String(f.limit));
  for (const code of f.codes ?? []) search.append("code", code);

  const qs = search.toString();
  return call<Db2OfficerResult>(`/api/officers${qs ? `?${qs}` : ""}`);
}

/* -------------------------------------------------------------------------- */
/* รายการขายรายใบในช่วงวันที่ (ใช้โดยระบบตรวจสอบบัญชี)                            */
/* -------------------------------------------------------------------------- */

/**
 * ใบสั่งขายหนึ่งใบจาก VIEW_SALEALL พร้อมชื่อที่ผู้ตรวจสอบต้องเห็น
 * (ลูกค้า · สาขาที่ขาย · พนักงานขาย · ยี่ห้อ/รุ่น · บริษัทไฟแนนซ์)
 * `contno` = เลขที่สัญญาขาย ใช้เป็นกุญแจคู่ขนานกับตาราง aud_checks ฝั่ง Supabase
 */
export type Db2Sale = {
  locat: string;
  contno: string;
  saleDate: string | null;
  /** H ผ่อน · C สด · F ไฟแนนซ์ · A ส่งเอเย่นต์ */
  channel: string;
  channelLabel: string;
  /** N รถใหม่ · O รถเก่า */
  condition: string;
  strno: string;
  brand: string;
  model: string;
  modelName: string;
  color: string;
  salcod: string;
  salesman: string;
  fincod: string;
  /** ชื่อบริษัทไฟแนนซ์ (มีเฉพาะการขายผ่านไฟแนนซ์) */
  finance: string;
  cuscod: string;
  customer: string;
  mobile: string;
  /** ราคาขายก่อน VAT */
  price: number | null;
  /** ราคารวม VAT */
  gross: number | null;
};

export type Db2SaleResult = {
  filters: { from: string; to: string; locat?: string; tsale?: string };
  matched: number;
  count: number;
  truncated: boolean;
  sales: Db2Sale[];
  branches: string[];
};

/**
 * รายการขายรายใบในช่วงวันที่ — ต้องมีเอนด์พอยต์ `/api/sales` ในแอป Db2 (เพิ่มไว้แล้วในโปรเจกต์แอป Db2)
 * ถ้าแอปฝั่งบริษัทยังไม่ได้ build เวอร์ชันที่มีเอนด์พอยต์นี้ จะได้ Db2ApiError สถานะ 404
 * หน้าจอที่เรียกต้องดักไว้แล้วบอกผู้ใช้ว่าให้อัปเดตแอป Db2 ก่อน
 */
export function db2Sales(f: {
  from: string;
  to: string;
  locat?: string;
  tsale?: string;
  limit?: number;
}) {
  return call<Db2SaleResult>("/api/sales", {
    from: f.from,
    to: f.to,
    locat: f.locat,
    tsale: f.tsale,
    limit: f.limit ? String(f.limit) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* งานซ่อม (ศูนย์บริการ) — JOBORDER                                             */
/* -------------------------------------------------------------------------- */

/**
 * ตัวเลขงานซ่อมหนึ่งชุด (นิยามฝั่งแอป Db2 — ดูเหตุผลเต็มใน hp.ts ของแอปนั้น)
 *   net    รายได้ก่อน VAT = อะไหล่ + น้ำมัน + ค่าแรง + งานนอก + งานสี
 *   gross  รวม VAT · vat = VAT ของ 5 หมวดนั้น
 *   cost   ต้นทุนอะไหล่ + น้ำมัน (ค่าแรงไม่มีต้นทุนในใบงาน)
 *   profit net − cost · labour = ค่าแรงล้วน · open = จำนวนใบที่ยังไม่ปิด job ในชุดนี้
 * ใบที่ถูกยกเลิก (STATUS='C') ถูกตัดออกจากทุกตัวเลขแล้ว
 */
export type Db2JobAgg = {
  jobs: number;
  net: number;
  vat: number;
  gross: number;
  cost: number;
  profit: number;
  labour: number;
  open: number;
};

export type Db2JobItem = Db2JobAgg & { key: string; label: string | null };

export type Db2JobDim = "branch" | "tech" | "reptype" | "receiver" | "model";

/** ใบงานที่ยังค้างปิด — ข้อมูลพอให้ไล่ตามรถได้จริง (ทะเบียน เบอร์โทร ช่างที่รับผิดชอบ) */
export type Db2OpenJob = {
  jobno: string;
  locat: string;
  branch: string | null;
  recvDate: string | null;
  ageDays: number;
  repcod: string;
  repName: string | null;
  recvcod: string;
  recvName: string | null;
  reptype: string;
  reptypeName: string | null;
  /** F เสร็จ · R กำลังซ่อม · W รอ (ว่าง = ใบเก่าก่อนมีฟิลด์นี้) */
  swstatus: string;
  status: string;
  finishDate: string | null;
  taxDate: string | null;
  model: string;
  modelName: string | null;
  strno: string;
  regno: string;
  cuscod: string;
  customer: string;
  mobile: string;
  tel: string;
  net: number;
};

export type Db2Jobs = {
  generatedAt: string;
  today: string;
  range: { from: string; to: string; days: number };
  filters: { locat: string | null; reptype: string | null; repcod: string | null };
  truncated: boolean;
  kpi: Db2JobAgg;
  today_kpi: Db2JobAgg;
  quality: {
    /** วันเฉลี่ยจากวันรับรถถึงวันซ่อมเสร็จ */
    leadDaysAvg: number | null;
    sameDayPct: number | null;
    finished: number;
    /** ใบที่ยังไม่มีวันที่ใบกำกับภาษี */
    noTax: number;
  };
  compare: {
    prev: { range: { from: string; to: string }; kpi: Db2JobAgg; label: string };
    lastYear: { range: { from: string; to: string }; kpi: Db2JobAgg; label: string };
  };
  dims: Record<Db2JobDim, { title: string; items: Db2JobItem[] }>;
  daily: (Db2JobAgg & { date: string })[];
  monthly: (Db2JobAgg & { year: number; month: number })[];
  /** งานค้างปิด job — ยอดสะสมทั้งฐาน ไม่ขึ้นกับช่วงวันที่ (กรองตามสาขาเดียวกัน) */
  open: {
    totals: {
      jobs: number;
      net: number;
      age: { d7: number; d30: number; d90: number; d365: number; over: number };
    };
    byBranch: { key: string; label: string | null; jobs: number; oldest: string | null; overYear: number }[];
    listLimit: number;
    list: Db2OpenJob[];
  };
  branches: { key: string; label: string | null }[];
  repTypes: { key: string; label: string }[];
};

/**
 * สรุปงานซ่อมในช่วงวันรับรถ + งานค้างปิด job — ต้องมีเอนด์พอยต์ `/api/jobs` ในแอป Db2
 * ถ้าเครื่องในบริษัทยังไม่ได้ build เวอร์ชันที่มีเอนด์พอยต์นี้ จะได้ Db2ApiError สถานะ 404
 * หน้าจอที่เรียกต้องดักไว้แล้วบอกผู้ใช้ว่าให้อัปเดตแอป Db2 ก่อน (ไม่ใช่ปล่อยหน้าขาว)
 */
export function db2Jobs(f: { from?: string; to?: string; locat?: string; reptype?: string; repcod?: string } = {}) {
  return call<Db2Jobs>("/api/jobs", {
    from: f.from,
    to: f.to,
    locat: f.locat,
    reptype: f.reptype,
    repcod: f.repcod,
  });
}

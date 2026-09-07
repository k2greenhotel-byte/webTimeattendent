import "server-only";

/**
 * ไคลเอนต์เรียก "แอปข้อมูลสดจากระบบขาย (Db2)" ที่รันในบริษัทและเปิดออกมาผ่าน Tailscale Funnel
 *
 *   DB2_API_URL  เช่น https://db2-sales.tail9c6195.ts.net   (wrangler.jsonc vars / .env.local)
 *   DB2_API_KEY  ค่าเดียวกับ API_KEY ใน .env.local ของแอป Db2   (wrangler secret / .env.local)
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

async function call<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const base = process.env.DB2_API_URL;
  const key = process.env.DB2_API_KEY;
  if (!base || !key) {
    throw new Db2ApiError("ยังไม่ได้ตั้งค่า DB2_API_URL / DB2_API_KEY");
  }

  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": key },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || body.ok === false) {
      throw new Db2ApiError(body.error ?? `ระบบขายตอบ HTTP ${res.status}`, res.status);
    }
    return body as T;
  } catch (err) {
    if (err instanceof Db2ApiError) throw err;
    const reason = err instanceof Error && err.name === "AbortError" ? "หมดเวลารอ" : (err as Error).message;
    throw new Db2ApiError(`ต่อระบบขาย (Db2) ไม่ได้ — เครื่องในบริษัทอาจปิดอยู่ (${reason})`);
  } finally {
    clearTimeout(timer);
  }
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

export type Db2StockCombo = { model: string; variant: string; color: string; units: number };

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

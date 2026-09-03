/**
 * เก็บ "ร่างฟอร์ม" ไว้ชั่วคราวตอนผู้ใช้กดออกไปเพิ่มข้อมูลเบื้องต้นกลางคัน
 * แล้วเอากลับมาเติมให้เหมือนเดิมเมื่อกลับเข้าหน้าเดิม
 *
 * เก็บใน sessionStorage ของเบราว์เซอร์ (ปิดแท็บแล้วหายไปเอง ไม่ส่งขึ้น server)
 * ฟังก์ชันในไฟล์นี้เป็น pure/ไม่มี side effect นอกจาก sessionStorage จึงเรียกจาก client component ได้เลย
 */

/** ค่าที่เก็บได้หลายค่าต่อหนึ่งชื่อฟิลด์ (เช่น ไฟล์แนบหลายไฟล์ใช้ name เดียวกัน) */
export type FormDraft = Record<string, string[]>;

const STORAGE_KEY = "kk-form-draft";

/** ชนิดข้อมูลเบื้องต้นที่กดออกไปเพิ่มระหว่างทำใบจองได้ */
export type PickKind = "customer" | "brand" | "model" | "variant" | "color";

/** ช่องบนใบจองที่ค่าที่เพิ่งเพิ่มจะถูกเติมกลับเข้าไป */
export const PICK_FIELD: Record<PickKind, string> = {
  customer: "customer_id",
  brand: "brand_id",
  model: "model_id",
  variant: "variant_id",
  color: "color_id",
};

export function isPickKind(value: string | null | undefined): value is PickKind {
  return value === "customer" || value === "brand" || value === "model" || value === "variant" || value === "color";
}

/**
 * ตรวจเส้นทางที่จะเด้งกลับ — รับเฉพาะ path ภายในเว็บนี้เท่านั้น
 * (กัน open redirect: `//evil.com` และ `https://evil.com` ถูกปฏิเสธ)
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  const path = (raw ?? "").trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (path.includes("\\") || path.includes("\n")) return null;
  return path;
}

/** URL ที่ให้หน้าข้อมูลเบื้องต้นเด้งกลับมาที่ใบจอง พร้อมค่าที่เพิ่งเพิ่ม */
export function returnUrl(returnTo: string, pick: PickKind, pickedId: string): string {
  const params = new URLSearchParams({ restore: "1", pick, picked: pickedId });
  return `${returnTo}?${params.toString()}`;
}

// ---------- ฝั่งเบราว์เซอร์ ----------

type StoredDraft = { formKey: string; values: FormDraft };

/**
 * อ่านร่างจาก sessionStorage ครั้งเดียวต่อการโหลดหนึ่งหน้า แล้วลบทิ้งทันที
 * (จำไว้ในตัวแปรของโมดูล เพื่อให้ทุกช่องบนฟอร์มอ่านชุดเดียวกันได้ ไม่ว่าใครจะ mount ก่อน)
 */
let cached: StoredDraft | null | undefined;

function readOnce(): StoredDraft | null {
  if (cached !== undefined) return cached;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** เก็บค่าทุกช่องในฟอร์มไว้ก่อนออกจากหน้า — เรียกตอนกดลิงก์ "เพิ่มข้อมูลใหม่" */
export function saveFormDraft(form: HTMLFormElement, formKey: string): void {
  const values: FormDraft = {};

  for (const [name, value] of new FormData(form).entries()) {
    // ช่องภายในของ server action (ขึ้นต้นด้วย $ACTION) ไม่ใช่ข้อมูลของผู้ใช้
    if (typeof value !== "string" || name.startsWith("$ACTION") || value === "") continue;
    values[name] = [...(values[name] ?? []), value];
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ formKey, values }));
  } catch {
    // เบราว์เซอร์ปิด storage ไว้ก็ไม่ควรทำให้กดลิงก์ไม่ได้ — แค่ค่าที่กรอกไว้จะไม่ถูกจำ
  }
}

/** เอาร่างของฟอร์มนี้กลับมา (ไม่ใช่ฟอร์มเดียวกันคืน null) */
export function takeFormDraft(formKey: string): FormDraft | null {
  const stored = readOnce();
  return stored && stored.formKey === formKey ? stored.values : null;
}

/** ค่าเดียวของช่องหนึ่งจากร่าง */
export function draftValue(draft: FormDraft | null, name: string): string | null {
  return draft?.[name]?.[0] ?? null;
}

/** ค่าทั้งหมดของช่องหนึ่งจากร่าง (ใช้กับไฟล์แนบ) */
export function draftValues(draft: FormDraft | null, name: string): string[] {
  return draft?.[name] ?? [];
}

/** ค่าที่เพิ่งเพิ่มจากหน้าข้อมูลเบื้องต้น ที่ติดกลับมากับ URL */
export function pickedFromLocation(): { pick: PickKind; id: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const pick = params.get("pick");
  const id = params.get("picked");
  return isPickKind(pick) && id ? { pick, id } : null;
}

/** หน้านี้กำลังกลับมาจากการไปเพิ่มข้อมูลเบื้องต้นหรือเปล่า */
export function isRestoring(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("restore") === "1";
}

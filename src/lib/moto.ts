/**
 * กฎของระบบข้อมูลเบื้องต้นธุรกิจรถจักรยานยนต์ อยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / db layer อ่านนิยามของข้อมูลหลักทั้ง 10 ชุดจาก MOTO_MASTERS ตัวเดียวกัน
 * เพิ่มข้อมูลหลักชุดใหม่ = เพิ่มหนึ่งรายการที่นี่ + หนึ่งตารางใน migration เท่านั้น
 */
import type { MotoMasterInput, MotoMasterKind, MotoOption } from "./moto-types";

export type MotoMasterSpec = {
  kind: MotoMasterKind;
  /** ส่วนท้าย URL: /moto/setup/<slug> */
  slug: string;
  /** ตารางใน Postgres */
  table: string;
  /** รหัสเมนูในระบบส่วนกลาง ใช้ตรวจสิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ */
  menuCode: string;
  /** ลำดับที่ผู้ใช้ระบุมา (1-10) */
  order: number;
  title: string;
  description: string;
  codeLabel: string;
  nameLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
  /** ข้อมูลหลักตัวแม่ที่ต้องเลือก (ถ้ามี) เช่น รุ่นรถอ้างยี่ห้อ */
  parent?: { kind: MotoMasterKind; column: "brand_id" | "model_id"; label: string };
};

export const MOTO_MASTERS: MotoMasterSpec[] = [
  {
    kind: "brand",
    slug: "brands",
    table: "mc_brands",
    menuCode: "MC_BRAND",
    order: 1,
    title: "ยี่ห้อรถ",
    description: "ยี่ห้อรถจักรยานยนต์ที่ร้านขาย ใช้เป็นตัวเลือกของรุ่นรถและเอกสารขาย",
    codeLabel: "รหัสยี่ห้อ",
    nameLabel: "ชื่อยี่ห้อรถ",
    codePlaceholder: "BR09",
    namePlaceholder: "Suzuki",
  },
  {
    kind: "model",
    slug: "models",
    table: "mc_models",
    menuCode: "MC_MODEL",
    order: 2,
    title: "รุ่นรถ",
    description: "รุ่นรถของแต่ละยี่ห้อ เช่น Wave110i, Fino, Grand Filano",
    codeLabel: "รหัสรุ่น",
    nameLabel: "ชื่อรุ่น",
    codePlaceholder: "MD01",
    namePlaceholder: "Wave 110i",
    parent: { kind: "brand", column: "brand_id", label: "ยี่ห้อรถ" },
  },
  {
    kind: "variant",
    slug: "variants",
    table: "mc_variants",
    menuCode: "MC_VARIANT",
    order: 3,
    title: "แบบรถ",
    description: "แบบย่อยของแต่ละรุ่น เช่น ล้อซี่ลวดดรัมเบรก / ล้อแม็กดิสก์เบรก",
    codeLabel: "รหัสแบบ",
    nameLabel: "ชื่อแบบ",
    codePlaceholder: "VR01",
    namePlaceholder: "ล้อแม็ก ดิสก์เบรก",
    parent: { kind: "model", column: "model_id", label: "รุ่นรถ" },
  },
  {
    kind: "color",
    slug: "colors",
    table: "mc_colors",
    menuCode: "MC_COLOR",
    order: 4,
    title: "สีรถ",
    description: "สีรถที่ใช้ระบุในใบจอง ใบขาย และสต๊อกรถ",
    codeLabel: "รหัสสี",
    nameLabel: "ชื่อสี",
    codePlaceholder: "CL01",
    namePlaceholder: "ดำ-แดง",
  },
  {
    kind: "vendor",
    slug: "vendors",
    table: "mc_vendors",
    menuCode: "MC_VENDOR",
    order: 5,
    title: "บริษัทรถ / เจ้าหนี้",
    description: "บริษัทรถหรือเจ้าหนี้ที่ร้านติดต่อซื้อรถและอะไหล่",
    codeLabel: "รหัสบริษัท/เจ้าหนี้",
    nameLabel: "ชื่อบริษัท",
    codePlaceholder: "VD01",
    namePlaceholder: "ไทยฮอนด้า จำกัด",
  },
  {
    kind: "finance",
    slug: "finance",
    table: "mc_finance_companies",
    menuCode: "MC_FINANCE",
    order: 6,
    title: "บริษัทไฟแนนซ์",
    description: "บริษัทไฟแนนซ์ที่รับจัดเช่าซื้อให้ลูกค้า",
    codeLabel: "รหัสบริษัท",
    nameLabel: "ชื่อบริษัท",
    codePlaceholder: "FN01",
    namePlaceholder: "ศรีสวัสดิ์ แคปปิตอล",
  },
  {
    kind: "income",
    slug: "income",
    table: "mc_income_types",
    menuCode: "MC_INCOME",
    order: 7,
    title: "รายการรับชำระเงิน",
    description: "ประเภทเงินที่ร้านรับเข้า เช่น เงินดาวน์ ค่างวด ค่าจดทะเบียน",
    codeLabel: "รหัสรับเงิน",
    nameLabel: "ชื่อรายการรับเงิน",
    codePlaceholder: "IN01",
    namePlaceholder: "เงินดาวน์",
  },
  {
    kind: "expense",
    slug: "expense",
    table: "mc_expense_types",
    menuCode: "MC_EXPENSE",
    order: 8,
    title: "รายการค่าใช้จ่าย",
    description: "ประเภทเงินที่ร้านจ่ายออก เช่น ค่าน้ำมัน ค่าขนส่ง ค่าคอมมิชชั่น",
    codeLabel: "รหัสค่าใช้จ่าย",
    nameLabel: "ชื่อรายการค่าใช้จ่าย",
    codePlaceholder: "EX01",
    namePlaceholder: "ค่าคอมมิชชั่นพนักงานขาย",
  },
  {
    kind: "channel",
    slug: "channels",
    table: "mc_contact_channels",
    menuCode: "MC_CHANNEL",
    order: 9,
    title: "ช่องทางการติดต่อ",
    description: "ช่องทางที่ลูกค้าติดต่อเข้ามา ใช้ดูว่าลูกค้ามาจากทางไหนมากที่สุด",
    codeLabel: "รหัสการติดต่อ",
    nameLabel: "ชื่อช่องทาง",
    codePlaceholder: "CH05",
    namePlaceholder: "หน้าร้าน (Walk-in)",
  },
  {
    kind: "salesJob",
    slug: "salesjobs",
    table: "mc_sales_jobs",
    menuCode: "MC_SALESJOB",
    order: 10,
    title: "งานด้านการขาย",
    description: "งานที่พนักงานขายทำเพื่อหาลูกค้า ใช้บันทึกผลงานประจำวัน",
    codeLabel: "รหัสงาน",
    nameLabel: "ชื่องาน",
    codePlaceholder: "SJ05",
    namePlaceholder: "ออกบูธนอกสถานที่",
  },
];

/** หานิยามข้อมูลหลักจาก kind — ไม่พบคืน null (ผู้เรียกเป็นคนตัดสินใจว่าจะแจ้งผู้ใช้อย่างไร) */
export function specOf(kind: string): MotoMasterSpec | null {
  return MOTO_MASTERS.find((m) => m.kind === kind) ?? null;
}

/** หานิยามข้อมูลหลักจากส่วนท้าย URL เช่น "brands" → ยี่ห้อรถ */
export function specOfSlug(slug: string): MotoMasterSpec | null {
  return MOTO_MASTERS.find((m) => m.slug === slug.toLowerCase()) ?? null;
}

/** รหัสเก็บเป็นตัวพิมพ์ใหญ่ไม่มีช่องว่างเสมอ เพื่อให้ค้นหาและเรียงลำดับได้ตรงกันทุกหน้าจอ */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/** ข้อความบอกชนิดข้อมูลหลักในรูปแบบ "1. ยี่ห้อรถ" */
export function masterTitle(spec: MotoMasterSpec): string {
  return `${spec.order}. ${spec.title}`;
}

/**
 * ตรวจค่าจากฟอร์มก่อนบันทึก — คืนข้อความภาษาไทยบอกวิธีแก้ ถ้าผ่านคืน null
 * (หน้าจอกับ server action ใช้ฟังก์ชันเดียวกัน ข้อความจะได้ไม่เพี้ยนกัน)
 */
export function validateMasterInput(
  spec: MotoMasterSpec,
  input: MotoMasterInput,
): string | null {
  if (!input.code) return `กรุณากรอก${spec.codeLabel}`;
  if (input.code.length > 20) return `${spec.codeLabel}ยาวเกินไป (ไม่เกิน 20 ตัวอักษร)`;
  if (!input.name) return `กรุณากรอก${spec.nameLabel}`;
  if (input.name.length > 120) return `${spec.nameLabel}ยาวเกินไป (ไม่เกิน 120 ตัวอักษร)`;
  return null;
}

/** ชื่อตัวแม่ของแถวนี้ เช่น ยี่ห้อของรุ่นรถ — ยังไม่ได้เลือกจะแสดงว่า "— ไม่ระบุ —" */
export function parentNameOf(row: MotoOption, parents: MotoOption[]): string {
  const parentId = row.brand_id ?? row.model_id ?? null;
  if (!parentId) return "— ไม่ระบุ —";
  const found = parents.find((p) => p.id === parentId);
  return found ? `${found.code} · ${found.name}` : "— ไม่ระบุ —";
}

/** ค้นหาด้วยคำเดียว ใช้ได้ทั้งรหัสและชื่อ (ตัดช่องว่างหัวท้าย ไม่สนตัวพิมพ์) */
export function filterOptions(rows: MotoOption[], keyword: string): MotoOption[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
  );
}

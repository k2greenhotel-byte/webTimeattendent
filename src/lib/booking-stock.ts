/**
 * จับคู่ "สต็อกรถจากระบบขาย (Db2)" กับ "ใบจองในระบบนี้" — pure function ล้วน
 *
 * จับคู่ในระดับ **รุ่น (MODEL) + แบบ (BAAB) + สี (COLOR)** ตามที่ตกลงกันไว้
 * ไม่ได้จับถึงระดับเลขตัวถัง เพราะตอนรับจองลูกค้ายังไม่ได้เลือกคันไหน
 * ผลลัพธ์จึงเป็น "กลุ่มนี้มีในสต็อกกี่คัน ติดจองไปแล้วกี่ใบ เหลือขายได้กี่คัน"
 */

export type StockCombo = { model: string; variant: string; color: string; units: number };

/** ใบจองเท่าที่ต้องใช้จับคู่ (ทั้งหมดมาจาก v_bk_bookings) */
export type BookingForMatch = {
  id: string;
  doc_no: string;
  db2_model_code: string | null;
  db2_variant_code: string | null;
  db2_color_code: string | null;
  customer_name?: string | null;
  pickup_date?: string | null;
};

/** รหัสของกลุ่ม — ตัดช่องว่างและไม่สนตัวพิมพ์ เพราะ Db2 เก็บเป็น CHAR ความยาวคงที่ */
export function comboKey(
  model: string | null | undefined,
  variant: string | null | undefined,
  color: string | null | undefined,
): string {
  const norm = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();
  return [norm(model), norm(variant), norm(color)].join("|");
}

/** รวมใบจองเข้ากลุ่ม รุ่น+แบบ+สี — ใบที่ยังไม่ได้ระบุรถครบทั้ง 3 ช่องจะถูกข้าม */
export function groupBookingsByCombo(
  bookings: BookingForMatch[],
): Map<string, BookingForMatch[]> {
  const map = new Map<string, BookingForMatch[]>();
  for (const b of bookings) {
    if (!b.db2_model_code || !b.db2_variant_code || !b.db2_color_code) continue;
    const key = comboKey(b.db2_model_code, b.db2_variant_code, b.db2_color_code);
    const list = map.get(key);
    if (list) list.push(b);
    else map.set(key, [b]);
  }
  return map;
}

export type ComboMatch = StockCombo & {
  key: string;
  /** จำนวนใบจองที่รออยู่ในกลุ่มนี้ */
  booked: number;
  /** คันที่ยังไม่มีใบจองรออยู่ (ติดลบไม่ได้) */
  free: number;
  /** จองเกินจำนวนรถที่มี — ต้องรีบสั่งเพิ่ม */
  shortage: number;
  bookings: BookingForMatch[];
};

/**
 * จับคู่สต็อกกับใบจอง แล้วเรียงกลุ่มที่ "ติดจองแล้ว" ขึ้นก่อน
 * กลุ่มที่จองไว้แต่ไม่มีรถในสต็อกเลย ก็ต้องโผล่ในผลลัพธ์ด้วย (units = 0) — เป็นของที่ต้องสั่ง
 */
export function matchStockWithBookings(
  combos: StockCombo[],
  bookings: BookingForMatch[],
): ComboMatch[] {
  const byCombo = groupBookingsByCombo(bookings);
  const seen = new Set<string>();
  const out: ComboMatch[] = [];

  for (const combo of combos) {
    const key = comboKey(combo.model, combo.variant, combo.color);
    seen.add(key);
    const matched = byCombo.get(key) ?? [];
    out.push({
      ...combo,
      key,
      booked: matched.length,
      free: Math.max(0, combo.units - matched.length),
      shortage: Math.max(0, matched.length - combo.units),
      bookings: matched,
    });
  }

  // กลุ่มที่มีใบจองรออยู่ แต่ไม่มีรถในสต็อกเลย
  for (const [key, matched] of byCombo) {
    if (seen.has(key)) continue;
    const [model, variant, color] = key.split("|");
    out.push({
      model,
      variant,
      color,
      units: 0,
      key,
      booked: matched.length,
      free: 0,
      shortage: matched.length,
      bookings: matched,
    });
  }

  return out.sort(
    (a, b) =>
      b.shortage - a.shortage ||
      b.booked - a.booked ||
      b.units - a.units ||
      a.model.localeCompare(b.model, "th"),
  );
}

/** สถานะการจองของรถหนึ่งคัน — อ้างจากกลุ่มที่คันนั้นสังกัด */
export type UnitBooking = { booked: number; units: number; free: number; bookings: BookingForMatch[] };

/** ตารางค้นหาเร็วสำหรับหน้าจอรายคัน */
export function comboIndex(matches: ComboMatch[]): Map<string, ComboMatch> {
  return new Map(matches.map((m) => [m.key, m]));
}

export function unitBookingOf(
  unit: { model: string; variant: string; color: string },
  index: Map<string, ComboMatch>,
): UnitBooking {
  const m = index.get(comboKey(unit.model, unit.variant, unit.color));
  if (!m) return { booked: 0, units: 0, free: 0, bookings: [] };
  return { booked: m.booked, units: m.units, free: m.free, bookings: m.bookings };
}

/** ยอดรวมของทั้งหน้า */
export function summarizeMatches(matches: ComboMatch[]) {
  let units = 0;
  let booked = 0;
  let free = 0;
  let shortage = 0;
  for (const m of matches) {
    units += m.units;
    booked += m.booked;
    free += m.free;
    shortage += m.shortage;
  }
  return { combos: matches.length, units, booked, free, shortage };
}

export type LatLng = { lat: number; lng: number };

/**
 * อ่านพิกัดจากสิ่งที่ผู้ใช้วางมาจาก Google Maps
 * รองรับ
 *   - "13.756331, 100.501765"            (คัดลอกพิกัดจากแผนที่)
 *   - "https://www.google.com/maps/@13.7563,100.5018,17z"
 *   - ".../place/ชื่อร้าน/@13.7563,100.5018,17z/data=!3m1!4b1!4d100.5018!3d13.7563"
 *   - "https://maps.google.com/?q=13.7563,100.5018"
 * (ลิงก์ย่อ maps.app.goo.gl / goo.gl/maps อ่านไม่ได้ ต้องเปิดลิงก์แล้วคัดลอกพิกัดมา)
 */
export function parseLatLng(input: string): LatLng | null {
  const text = (input ?? "").trim();
  if (!text) return null;

  const valid = (lat: number, lng: number): LatLng | null =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;

  // รูปแบบ !3d<lat>!4d<lng> ในลิงก์ Google Maps (แม่นที่สุด ชี้ที่หมุดจริง)
  const dParam = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(text);
  if (dParam) return valid(Number(dParam[1]), Number(dParam[2]));

  // ?q=lat,lng หรือ ?ll=lat,lng
  const query = /[?&](?:q|ll|daddr|center)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(text);
  if (query) return valid(Number(query[1]), Number(query[2]));

  // /@lat,lng,zoom
  const at = /@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(text);
  if (at) return valid(Number(at[1]), Number(at[2]));

  // "lat, lng" ล้วน ๆ
  const plain = /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/.exec(text);
  if (plain) return valid(Number(plain[1]), Number(plain[2]));

  return null;
}

/** ลิงก์เปิดพิกัดใน Google Maps */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** ข้อความพิกัดสำหรับใส่ในช่องกรอก */
export function formatLatLng(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? "" : `${lat}, ${lng}`;
}

/** ระยะทางระหว่างพิกัด 2 จุด (เมตร) — สูตร Haversine */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

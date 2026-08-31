"use client";

/** ปุ่มดาวน์โหลด Excel / CSV และสั่งพิมพ์ (บันทึกเป็น PDF ได้จากหน้าต่างพิมพ์) */
export default function ExportButtons({ query }: { query: string }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <a className="btn-secondary" href={`/api/export?${query}&format=xlsx`}>
        ⬇ Excel
      </a>
      <a className="btn-secondary" href={`/api/export?${query}&format=csv`}>
        ⬇ CSV
      </a>
      <button type="button" className="btn-secondary" onClick={() => window.print()}>
        🖨 พิมพ์ / PDF
      </button>
    </div>
  );
}

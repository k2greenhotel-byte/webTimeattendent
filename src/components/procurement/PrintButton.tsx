"use client";

/** ปุ่มสั่งพิมพ์ / บันทึกเป็น PDF จากหน้าต่างพิมพ์ของเบราว์เซอร์ */
export default function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      🖨 พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}

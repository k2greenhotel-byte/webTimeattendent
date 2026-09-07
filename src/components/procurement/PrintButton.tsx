"use client";

import { useEffect } from "react";

/**
 * ปุ่มสั่งพิมพ์ / บันทึกเป็นไฟล์ PDF
 *
 * ใช้หน้าต่างพิมพ์ของเบราว์เซอร์ ไม่ได้สร้างไฟล์ PDF จากฝั่ง server
 * เพราะไลบรารีสร้าง PDF ฝั่ง server (pdf-lib และพวกเดียวกัน) วางสระและวรรณยุกต์ไทยผิดตำแหน่ง
 * ("ที่" กลายเป็น "ท ี ่") ส่วนหน้าต่างพิมพ์ของเบราว์เซอร์ใช้เอนจินจัดข้อความของเครื่อง
 * จึงได้ไฟล์ PDF ที่ภาษาไทยถูกต้อง และสั่งพิมพ์ออกเครื่องพิมพ์ได้ตรง ๆ ด้วย
 *
 * วิธีได้ไฟล์ PDF: กดปุ่มนี้ แล้วเลือกปลายทางเป็น "บันทึกเป็น PDF" (Save as PDF)
 */
export default function PrintButton({
  /** เปิดหน้าต่างพิมพ์ให้เองทันทีที่เข้าหน้า (ใช้กับลิงก์ที่ตั้งใจจะพิมพ์เลย) */
  auto = false,
  label = "🖨 พิมพ์ / บันทึกเป็น PDF",
}: {
  auto?: boolean;
  label?: string;
}) {
  useEffect(() => {
    if (!auto) return;
    // รอให้รูปและฟอนต์โหลดเสร็จก่อน ไม่งั้นหน้าที่พิมพ์ออกมาจะขาดรูป
    const timer = setTimeout(() => window.print(), 700);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <div className="no-print flex flex-wrap items-center justify-end gap-2">
      <p className="text-xs text-slate-500">
        ต้องการไฟล์ PDF: กดปุ่มนี้แล้วเลือกปลายทางเป็น “บันทึกเป็น PDF”
      </p>
      <button type="button" className="btn-primary" onClick={() => window.print()}>
        {label}
      </button>
    </div>
  );
}

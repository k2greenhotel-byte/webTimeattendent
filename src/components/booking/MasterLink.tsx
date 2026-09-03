"use client";

import { saveFormDraft, type PickKind } from "@/lib/form-draft";

/**
 * ลิงก์ "ไปเพิ่ม/แก้ไขข้อมูลเบื้องต้น" ที่อยู่ข้างช่องบนใบจอง
 *
 * กดแล้วระบบจะจำค่าที่กรอกค้างไว้ทั้งใบก่อน แล้วค่อยพาไปหน้าข้อมูลเบื้องต้น
 * เมื่อบันทึกที่นั่นเสร็จ ระบบจะพากลับมาที่ใบจองใบเดิม พร้อมเติมค่าที่เพิ่งเพิ่มให้อัตโนมัติ
 */
export default function MasterLink({
  href,
  pick,
  label,
  parentId,
}: {
  /** หน้าข้อมูลเบื้องต้นปลายทาง เช่น /moto/setup/colors */
  href: string;
  pick: PickKind;
  label: string;
  /** ตัวแม่ที่เลือกไว้แล้ว (ยี่ห้อของรุ่น / รุ่นของแบบ) — ส่งไปให้หน้าปลายทางเลือกไว้ให้เลย */
  parentId?: string | null;
}) {
  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const form = e.currentTarget.closest("form");
    if (form) saveFormDraft(form, window.location.pathname);

    const params = new URLSearchParams({ return: window.location.pathname, pick });
    if (parentId) params.set("parent", parentId);

    // เปลี่ยนหน้าแบบเต็ม เพื่อให้หน้าปลายทางอ่านค่าใหม่จาก server ทุกครั้ง
    window.location.href = `${href}?${params.toString()}`;
  };

  return (
    <a
      href={href}
      onClick={go}
      className="text-xs text-brand-600 hover:underline"
      title={`เปิดหน้า${label} — บันทึกแล้วระบบจะพากลับมาที่ใบจองใบนี้พร้อมค่าที่เพิ่งเพิ่ม`}
    >
      {label}
    </a>
  );
}

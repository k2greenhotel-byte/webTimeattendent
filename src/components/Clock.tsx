"use client";

import { useEffect, useState } from "react";

/** นาฬิกาแสดงผลฝั่งผู้ใช้ (เวลาที่บันทึกจริงใช้เวลาของ server เสมอ) */
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <span className="tabular-nums">--:--:--</span>;

  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString("th-TH", { hour12: false, timeZone: "Asia/Bangkok" })}
    </span>
  );
}

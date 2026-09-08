/**
 * ชนิดข้อมูลและค่าคงที่ของจอ War Room ทุกโปรแกรม
 *
 * แยกออกมาจากไฟล์ที่คำนวณ (ซึ่งเป็น "server-only") เพราะ client component
 * ต้องใช้ทั้งชนิดข้อมูลและค่าคงที่บางตัว ถ้า import จากไฟล์ server-only
 * Next จะ build ไม่ผ่าน
 */

/** แถวรายการที่ต้องตามในจอ War Room */
export type WallRow = { key: string; title: string; detail: string; right: string };

/** แถวจัดอันดับแบบแท่ง */
export type WallRank = { label: string; value: number; sub?: string };

// ---------- กิจกรรมการตลาด ----------

/** ส่งเบิกแล้วเกินกี่วันถือว่าค้างนาน ควรโทรตาม */
export const MKT_SLOW_DAYS = 30;

export type MarketingWall = {
  generatedAt: string;
  today: string;
  period: { from: string | null; to: string | null; label: string };
  money: { request: number; approved: number; received: number; outstanding: number };
  counts: {
    activities: number;
    draft: number;
    submitted: number;
    received: number;
    memos: number;
  };
  waiting: WallRow[];
  notSubmitted: WallRow[];
  memoAlerts: WallRow[];
  byCompany: WallRank[];
  memoByStatus: WallRank[];
};

// ---------- จองรถ ----------

export type BookingWall = {
  generatedAt: string;
  today: string;
  counts: {
    openBookings: number;
    bookedToday: number;
    bookedThisMonth: number;
    awaitingDelivery: number;
    outOfStock: number;
    docPending: number;
  };
  money: { total: number; thisMonth: number };
  waitingLong: WallRow[];
  docPending: WallRow[];
  byBranch: WallRank[];
  byStaff: WallRank[];
  byModel: WallRank[];
};

/** รอส่งมอบเกินกี่วันถือว่าช้า */
export const BOOK_SLOW_DAYS = 14;

// ---------- Lead การขาย ----------

export type LeadWall = {
  generatedAt: string;
  today: string;
  counts: {
    open: number;
    newToday: number;
    newThisMonth: number;
    dueToday: number;
    overdue: number;
    noPlan: number;
    won: number;
  };
  overdue: WallRow[];
  dueToday: WallRow[];
  byStaff: WallRank[];
  byBranch: WallRank[];
  byStatus: WallRank[];
};

// ---------- จัดซื้อ / แจ้งซ่อม ----------

export type ProcurementWall = {
  generatedAt: string;
  today: string;
  counts: {
    open: number;
    waitingApproval: number;
    overdue: number;
    createdToday: number;
    createdThisMonth: number;
  };
  money: { requested: number; approved: number; paid: number; unpaid: number };
  overdue: WallRow[];
  waitingApproval: WallRow[];
  byBranch: WallRank[];
  byType: WallRank[];
};

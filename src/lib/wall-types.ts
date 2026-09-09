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

/**
 * ช่วงเวลาที่จอกำลังแสดงอยู่ — ส่งกลับไปให้จอขึ้นหัวข้อว่ากำลังดูช่วงไหน
 *
 * ตัวเลขในจอแบ่งเป็นสองพวก อย่าปนกัน:
 *   1. "ค้างอยู่ตอนนี้" (รออนุมัติ เลยกำหนด รอส่งมอบ) — สถานะปัจจุบัน ไม่ขึ้นกับช่วงที่เลือก
 *   2. "เกิดขึ้นในช่วง" (เปิดใบ รับจอง ตรวจ ลา) — นับเฉพาะในช่วง from–to ที่ผู้ใช้เลือก
 */
export type WallPeriodInfo = { from: string; to: string; label: string };

// ---------- กิจกรรมการตลาด ----------

/** ส่งเบิกแล้วเกินกี่วันถือว่าค้างนาน ควรโทรตาม */
export const MKT_SLOW_DAYS = 30;

export type MarketingWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
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
  period: WallPeriodInfo;
  counts: {
    openBookings: number;
    bookedToday: number;
    bookedInPeriod: number;
    awaitingDelivery: number;
    outOfStock: number;
    docPending: number;
  };
  money: { total: number; inPeriod: number };
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
  period: WallPeriodInfo;
  counts: {
    open: number;
    newToday: number;
    newInPeriod: number;
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
  period: WallPeriodInfo;
  counts: {
    open: number;
    waitingApproval: number;
    overdue: number;
    createdToday: number;
    createdInPeriod: number;
  };
  money: { requested: number; approved: number; paid: number; unpaid: number };
  overdue: WallRow[];
  waitingApproval: WallRow[];
  byBranch: WallRank[];
  byType: WallRank[];
};

// ---------- ขอลา / ขอเบิกเงินเดือน ----------

export type HrWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    pendingLeave: number;
    pendingAdvance: number;
    onLeaveToday: number;
    leaveInPeriod: number;
    certOverdue: number;
    lateNotice: number;
  };
  money: { advancePending: number; advanceInPeriod: number };
  pending: WallRow[];
  onLeaveToday: WallRow[];
  byType: WallRank[];
  byBranch: WallRank[];
};

// ---------- แจ้งเคลม ----------

export type ClaimWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    open: number;
    overdue: number;
    waitingMaker: number;
    waitingDelivery: number;
    openedToday: number;
    openedInPeriod: number;
  };
  overdue: WallRow[];
  waitingMaker: WallRow[];
  byBranch: WallRank[];
  byMaker: WallRank[];
};

// ---------- งานประจำวันพนักงานขาย ----------

export type SaleWorkWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    staffTotal: number;
    /** ส่งใบงานอย่างน้อยหนึ่งวันในช่วงที่เลือก */
    reported: number;
    notReported: number;
    itemsDone: number;
    itemsTotal: number;
  };
  /** เปอร์เซ็นต์งานที่ทำครบในช่วงที่เลือก */
  donePct: number;
  /** จำนวนวันที่นับจริงในช่วง (ตัดที่วันนี้) — ตัวหารของค่าเฉลี่ยต่อวัน */
  days: number;
  notReported: WallRow[];
  /** งานที่ทำรายคน เรียงจากน้อยไปมาก (คนที่ต้องตามอยู่บนสุด) */
  byStaff: WallRank[];
  /** พนักงานที่มีข้อมูลในช่วง — ใช้เป็นตัวเลือกกรองแผงประเภทงาน */
  staffOptions: { id: string; name: string }[];
  /**
   * งานรายประเภทแยกตามคน เรียงจากน้อยไปมาก
   * ส่งทั้งตารางมาให้จอ เพื่อสลับดูรวม/รายคน และคิด % เทียบยอดรวมได้เองโดยไม่ต้องยิง API ใหม่
   */
  byTask: { label: string; total: number; byStaff: Record<string, number> }[];
};

// ---------- กล่องอนุมัติรวม ----------

/** รออนุมัติเกินกี่วันถือว่าดองนาน ต้องเร่ง */
export const APV_SLOW_DAYS = 3;

export type ApprovalWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    /** รออนุมัติตอนนี้ทั้งหมด (ทุกโปรแกรมที่ผู้ใช้คนนี้มีสิทธิ์เห็น) */
    pending: number;
    central: number;
    procurement: number;
    leave: number;
    advance: number;
    /** ค้างเกิน APV_SLOW_DAYS วัน */
    slow: number;
    /** ยื่นเข้ามาในช่วงที่เลือก */
    submittedInPeriod: number;
  };
  money: { pendingAmount: number };
  /** ค้างนานที่สุดขึ้นก่อน — คิวที่ต้องเคลียร์ */
  oldest: WallRow[];
  /** แยกตามโปรแกรม */
  byModule: WallRank[];
  /** แยกตามผู้ยื่น */
  byRequester: WallRank[];
  /** โปรแกรมที่อ่านข้อมูลไม่ได้ตอนนี้ — บอกบนจอว่าตัวเลขยังไม่ครบ */
  unavailable: string[];
};

// ---------- ตรวจสอบสาขา ----------

/** ไม่ได้ตรวจสาขานี้มากี่วันถือว่านานเกินไป ควรจัดคิวเข้าไปตรวจ */
export const INSP_STALE_DAYS = 45;

export type InspectionWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    inspectedInPeriod: number;
    inspectedToday: number;
    branchesCovered: number;
    branchesTotal: number;
    branchesNeverInspected: number;
    draft: number;
  };
  money: { fineInPeriod: number; bonusInPeriod: number };
  /** เฉลี่ยเปอร์เซ็นต์คะแนนของใบที่ส่งผลแล้วในช่วงที่เลือก */
  avgPct: number;
  /** สาขาคะแนนต่ำสุดจากผลตรวจล่าสุดของแต่ละสาขา */
  worstBranches: WallRow[];
  /** สาขาที่ไม่ได้ตรวจมานาน หรือยังไม่เคยตรวจเลย */
  overdueBranches: WallRow[];
  /** ข้อที่สาขาต่าง ๆ ตกบ่อยที่สุด — บอกว่าควรอบรมเรื่องอะไร */
  topFailedItems: WallRank[];
  /** คะแนนเฉลี่ยรายสาขา (สูงสุดก่อน) */
  byBranch: WallRank[];
};

// ---------- ตรวจเช็คโรงแรมประจำวัน ----------

/** งานประจำวัน — ไม่ได้ตรวจสาขานี้เกินกี่วันถือว่าหลุดคิว */
export const HTL_STALE_DAYS = 2;

export type HotelWall = {
  generatedAt: string;
  today: string;
  period: WallPeriodInfo;
  counts: {
    branchesTotal: number;
    /** สาขาที่ส่งผลตรวจอาคารของวันนี้แล้ว */
    checkedToday: number;
    /** ห้องพักทั้งหมดที่เปิดใช้งาน และที่ตรวจไปแล้ววันนี้ */
    roomsTotal: number;
    roomsCheckedToday: number;
    roundsInPeriod: number;
    draft: number;
    openIssues: number;
    urgentOpen: number;
    overdueIssues: number;
    fixedInPeriod: number;
    noRepairDoc: number;
  };
  /** เปอร์เซ็นต์ข้อที่ตรวจแล้วปกติ ในช่วงที่เลือก */
  passPct: number;
  /** ข้อเร่งด่วนที่ยังไม่ได้แก้ */
  urgentIssues: WallRow[];
  /** ข้อที่เลยกำหนดแก้ไขแล้ว */
  overdueIssues: WallRow[];
  /** สาขาที่ยังไม่ได้ส่งผลตรวจอาคารของวันนี้ */
  notCheckedToday: WallRow[];
  /** ห้องพักที่ยังไม่ได้ตรวจวันนี้ */
  notCheckedRoomsToday: WallRow[];
  /** ข้อไม่ปกติที่ยังค้าง แยกตามประเภทงาน */
  byGroup: WallRank[];
  /** ข้อไม่ปกติที่ยังค้าง แยกตามสาขา */
  byBranch: WallRank[];
  /** แนวโน้มเปอร์เซ็นต์ผ่านรายวันในช่วงที่เลือก */
  trend: WallRank[];
};

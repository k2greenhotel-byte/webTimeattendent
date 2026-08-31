# Master Prompt — ระบบลงเวลาเข้า-ออกงานด้วยรูปถ่าย (Photo Time Attendance)

> วิธีใช้: คัดลอกเนื้อหาตั้งแต่ `=== เริ่ม PROMPT ===` จนถึง `=== จบ PROMPT ===` ไปวางใน Claude Code / AI ตัวอื่น
> เพื่อให้สร้างระบบนี้ตั้งแต่ต้น หรือใช้เป็นสเปกอ้างอิงเวลาสั่งแก้ไขทีละส่วน

---

=== เริ่ม PROMPT ===

## 1. บทบาทและเป้าหมาย

คุณคือ Full-stack engineer ที่ต้องสร้าง **ระบบบันทึกเวลาเข้า-ออกงานของพนักงานแบบ web-based**
สำหรับร้าน/สำนักงานขนาดเล็ก (10-50 คน) ที่ต้องการหลักฐานการเข้างานที่ปลอมแปลงยาก

หัวใจของระบบ: พนักงาน **ถ่ายรูปตัวเองสด ๆ** ทุกครั้งที่ลงเวลา ระบบประทับ **วัน-เวลา-พิกัด** ลงบนรูป
แล้วเก็บทั้งรูปและข้อมูลเวลาไว้ในฐานข้อมูล เพื่อนำไปออกรายงานสรุป

พนักงานลงเวลา **วันละ 4 ครั้ง**:

| ครั้งที่ | รหัส | ความหมาย |
|---|---|---|
| 1 | `check_in` | เข้างานตอนเช้า |
| 2 | `break_out` | ออกพักกลางวัน (ออกจากร้าน) |
| 3 | `break_in` | กลับเข้างานตอนบ่าย |
| 4 | `check_out` | เลิกงาน / ออกจากงาน |

## 2. ขอบเขต

**ต้องทำ (v1)**
- ลงเวลา 4 ครั้ง/วัน พร้อมรูปถ่ายสดและพิกัด GPS
- ฐานข้อมูลเก็บ: ชื่อพนักงาน, วันที่, เวลาเข้า-ออกแต่ละครั้ง, รูปภาพ
- คำนวณ สาย / กลับก่อนเวลา / เวลาพัก / ชั่วโมงทำงานสุทธิ / OT
- รายงาน 3 แบบ: **รายบุคคล**, **รายวัน**, **รายเดือน** + export Excel/CSV + หน้าพิมพ์ PDF
- หน้าแอดมิน: จัดการพนักงาน, ตั้งค่าเวลาทำงานมาตรฐาน, แก้ไขเวลาย้อนหลังพร้อม audit log

**ไม่ต้องทำ (v1)**
- จดจำใบหน้า (face recognition), คำนวณเงินเดือน, ระบบใบลา/อนุมัติ OT, แอปมือถือ native, แจ้งเตือน LINE/อีเมล

## 3. Tech stack (บังคับ)

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**
- **Supabase**: Postgres (ข้อมูล) + Storage (รูปภาพ, bucket แบบ private)
- Timezone ระบบ: **Asia/Bangkok** — เก็บ `timestamptz` เป็น UTC แต่แสดงผลและตัดวันตามเวลาไทยเสมอ
- UI ภาษาไทยทั้งหมด, mobile-first (พนักงานใช้บนมือถือ), แอดมินใช้บนเดสก์ท็อป
- Deploy ได้บน Vercel

## 4. ผู้ใช้และการเข้าระบบ

- **พนักงาน**: เข้าระบบด้วย **รหัสพนักงาน + PIN 4 หลัก** (แป้นตัวเลขขนาดใหญ่บนจอมือถือ) ที่ `/login`
- **หลังบ้าน (แอดมิน)**: เข้าได้จาก **`/admin` เท่านั้น** และต้องกรอก **PIN 6 หลัก** (ค่าเริ่มต้น `123456`, ตั้งค่าได้ที่ `ADMIN_PIN`)
  แยก session คนละ cookie กับฝั่งพนักงาน เส้นทางย่อยทั้งหมดของ `/admin/*` ถ้ายังไม่ผ่าน PIN ต้องเด้งกลับมาที่ `/admin`
- PIN เก็บเป็น **bcrypt hash** เท่านั้น, กรอกผิดครบ 5 ครั้ง ล็อกบัญชี 5 นาที
- Session = JWT ใน cookie แบบ `httpOnly` + `sameSite=lax` อายุ 12 ชั่วโมง, ตรวจสิทธิ์ที่ `middleware.ts`

## 5. Data model (Postgres)

**`branches`** (รองรับหลายสาขา)
`id uuid pk`, `code text unique`, `name`, `address`, `phone`,
`work_start time null`, `work_end time null` (null = ใช้ค่ากลาง),
`site_lat`, `site_lng`, `radius_m`, `is_active`
→ เวลาที่ใช้คำนวณจริง = ค่าของสาขา ถ้าสาขาไม่กำหนดจึงใช้ `work_settings`

**`employees`**
`id uuid pk`, `emp_code text unique`, `full_name`, `nickname`, `department`, `position`, `branch_id fk`,
`pin_hash`, `role ('employee'|'admin')`, `is_active bool`, `hire_date`,
`failed_attempts int`, `locked_until timestamptz`, `created_at`

**`work_settings`** (แถวเดียว, แอดมินแก้ไขได้)
`work_start time` (เช่น 08:00), `work_end time` (เช่น 17:00),
`break_start time`, `break_end time` (เวลาพักอ้างอิงสำหรับแสดงผล),
`break_allow_minutes int default 60` (โควตาพักกลางวัน),
`break_policy ('actual'|'fixed')`, `late_grace_min int`, `early_leave_grace_min int`,
`count_ot bool`, `workdays int[]` (0=อาทิตย์...6=เสาร์),
`require_gps bool`, `site_lat`, `site_lng`, `radius_m`, `timezone default 'Asia/Bangkok'`

**`attendance_records`**
`id uuid pk`, `employee_id fk`, `work_date date`,
`punch_type ('check_in'|'break_out'|'break_in'|'check_out')`, `branch_id fk` (สาขา ณ เวลาที่ลงเวลา),
`punched_at timestamptz` (**ต้องเป็นเวลาจาก server เท่านั้น ห้ามรับจาก client**),
`photo_path text`, `lat`, `lng`, `accuracy_m`, `distance_m`, `device_info`,
`note`, `is_manual bool`, `edited_by`, `created_at`
→ **UNIQUE (employee_id, work_date, punch_type)** กันลงซ้ำช่องเดิม

**`holidays`**: `holiday_date date pk`, `name` — ใช้แยก "ขาดงาน" ออกจาก "วันหยุด"

**`audit_logs`**: `id`, `actor_id`, `action`, `target_table`, `target_id`, `before jsonb`, `after jsonb`, `created_at`

**Storage**: bucket `attendance-photos` (private)
path = `{emp_code}/{YYYY-MM}/{YYYY-MM-DD}_{punch_type}_{uuid}.jpg`
เข้าถึงผ่าน **signed URL อายุสั้น** เท่านั้น ห้ามเปิด public

**RLS**: เปิดทุกตาราง และไม่สร้าง policy สาธารณะ — ทุก query ผ่าน server ด้วย service-role key

## 6. หน้าจอ

**ฝั่งพนักงาน**
- `/login` — รหัสพนักงาน + PIN (แป้นตัวเลข)
- `/punch` — ชื่อ + วันเวลาปัจจุบัน + ปุ่ม 4 ช่อง แสดงสถานะแต่ละช่อง (ทำแล้ว / พร้อมทำ / ยังไม่ถึงคิว)
  ระบบเลือกช่องถัดไปให้อัตโนมัติ และแสดงเวลาที่ลงไว้แล้วของวันนี้
- `/punch/capture?type=...` — เปิดกล้องหน้าด้วย `getUserMedia`
  (**ห้ามใช้ `<input type="file">` เด็ดขาด** เพื่อกันการอัปโหลดรูปเก่า)
  พรีวิว → กดยืนยัน → วาดลง `<canvas>` พร้อม watermark: ชื่อ-รหัสพนักงาน, ประเภทการลงเวลา,
  วันที่-เวลาไทย, พิกัด → บีบอัด JPEG คุณภาพ ~0.7 กว้างสูงสุด 1080px → ส่งขึ้น server
- `/me` — ประวัติของตัวเอง รายวัน/รายเดือน + ชั่วโมงสะสม

**ฝั่งแอดมิน (หลังบ้าน — ต้องผ่าน PIN 6 หลักก่อน)**
- `/admin` — จอกรอก PIN ถ้ายังไม่ผ่าน / dashboard วันนี้ถ้าผ่านแล้ว: มาแล้ว / สาย / ลงไม่ครบ / ขาดงาน (กรองตามสาขาได้)
- `/admin/branches` — เพิ่ม-แก้-ลบสาขา พร้อมเวลาทำงานและพิกัด GPS เฉพาะสาขา
- `/admin/holidays` — เพิ่ม-ลบวันหยุดประจำปี
- `/admin/employees` — เพิ่ม-แก้-ปิดใช้งาน-**ลบ**พนักงาน, ย้ายสาขา, ตั้ง/รีเซ็ต PIN
- `/admin/settings` — เวลามาตรฐาน, นาทีผ่อนผัน, โควตาพัก, นโยบายหักพัก, วันทำงาน, GPS/รัศมี
- `/admin/reports/employee` — **รายบุคคล**: เลือกพนักงาน + ช่วงวันที่ → ตารางรายวัน + รูป 4 ใบ/วัน (คลิกขยาย) + สรุปรวม
- `/admin/reports/daily` — **รายวัน**: พนักงานทุกคนของวันที่เลือก + สถานะ
- `/admin/reports/monthly` — **รายเดือน**: ตาราง พนักงาน × วันที่ + รวมชั่วโมง/สาย/ขาด/พักเกิน
- `/admin/records/[id]/edit` — แก้ไขเวลาย้อนหลัง (ตั้ง `is_manual = true` + เขียน `audit_logs` เสมอ)

## 7. กฎการคำนวณ (ต้องอยู่ในไฟล์เดียว `lib/attendance.ts` และถูกใช้ซ้ำทุกที่)

ให้เขียนฟังก์ชัน `computeDaySummary(punches, settings, isHoliday)` เป็น **แหล่งความจริงเดียว**
ห้ามคำนวณซ้ำในหน้าเว็บหรือใน SQL แยกต่างหาก

- `late_minutes = max(0, check_in − work_start − late_grace_min)`
- `early_leave_minutes = max(0, work_end − check_out − early_leave_grace_min)`
- `break_actual = break_in − break_out` (ถ้าขาด punch ใดใน 2 ตัวนี้ ให้ใช้ `break_allow_minutes` แทน)
- `over_break = max(0, break_actual − break_allow_minutes)` → ติดธง "พักเกินเวลา"
- `work_minutes = max(0, (check_out − check_in) − deduct)`
  โดย `deduct = break_actual` เมื่อ `break_policy = 'actual'` (ค่าเริ่มต้น)
  หรือ `deduct = break_allow_minutes` เมื่อ `break_policy = 'fixed'`
- `ot_minutes = max(0, check_out − work_end)` เฉพาะเมื่อ `count_ot = true`
- สถานะวัน: `complete` (ครบ 4) / `incomplete` (ลงไม่ครบ) / `absent` (วันทำงานแต่ไม่มี punch เลย) / `holiday`

**หมายเหตุสำคัญ**: ช่วงพักกลางวัน**ยืดหยุ่น** พนักงานออก-เข้าเวลาใดก็ได้ ไม่นับว่าสาย
แต่มีโควตาพัก 1 ชั่วโมง — พักเกินจะถูกหักออกจากชั่วโมงทำงานและติดธงในรายงาน

## 8. ความถูกต้องและความปลอดภัย (ห้ามละเลย)

1. `punched_at` ต้องมาจาก **นาฬิกาของ server** เสมอ — ไม่รับเวลาจาก client
2. รูปต้องมาจากกล้องสดเท่านั้น (ไม่มี file picker) และตรวจว่าเป็น JPEG ขนาดไม่เกิน ~2MB
3. ตรวจซ้ำที่ server: ห้ามลง punch ประเภทเดิมซ้ำในวันเดียวกัน และต้องลงตามลำดับ 1→2→3→4
4. ถ้า `require_gps = true` ต้องคำนวณระยะห่างจากพิกัดร้าน (Haversine) และปฏิเสธถ้าเกินรัศมี
5. `SUPABASE_SERVICE_ROLE_KEY` ใช้ได้เฉพาะฝั่ง server — ห้ามหลุดเข้า client bundle
6. ทุกการแก้ไขข้อมูลย้อนหลังโดยแอดมินต้องบันทึก `audit_logs`

## 9. รายงานและ export

ทุกหน้ารายงานต้องมีปุ่ม **Excel (.xlsx)**, **CSV**, และ **พิมพ์ (PDF)** โดยใช้ชุดข้อมูลเดียวกับที่แสดงบนหน้าจอ
คอลัมน์มาตรฐาน: วันที่ | ชื่อพนักงาน | เข้าเช้า | ออกพัก | เข้าบ่าย | เลิกงาน | สาย(นาที) | กลับก่อน(นาที) | พัก(นาที) | ชั่วโมงทำงาน | OT | สถานะ | หมายเหตุ

## 10. Acceptance criteria

- [ ] พนักงาน login ด้วยรหัส + PIN แล้วลงเวลาครบ 4 ครั้งได้ใน 1 วัน
- [ ] ลง punch ประเภทเดิมซ้ำ → ถูกปฏิเสธพร้อมข้อความภาษาไทย
- [ ] รูปที่บันทึกมี watermark ชื่อ, วัน-เวลา, พิกัด และไฟล์อยู่ใน Storage ตาม path ที่กำหนด
- [ ] แก้เวลามาตรฐานในหน้า settings แล้วรายงานคำนวณสายใหม่ตามค่าใหม่ทันที
- [ ] รายงานทั้ง 3 แบบแสดงผลถูกต้อง และ export Excel/CSV ได้ยอดตรงกับหน้าจอ
- [ ] พักเกิน 1 ชั่วโมง → ชั่วโมงทำงานลดลงและมีธง "พักเกินเวลา"
- [ ] เข้า `/admin` ต้องกรอก PIN 6 หลักก่อนเสมอ และเปิด `/admin/employees` ตรง ๆ ต้องถูกเด้งกลับ
- [ ] พนักงานคนละสาขาที่ลงเวลาเวลาเดียวกัน ต้องคิดสายตามเวลาเข้างานของสาขาตัวเอง
- [ ] `npm run build` ผ่านโดยไม่มี type error และ unit test กฎคำนวณผ่านทั้งหมด

## 11. Prompt ต่อยอด (ใช้ภายหลัง)

- "เพิ่มระบบใบลา: ตาราง `leaves` (ลาป่วย/ลากิจ/ลาพักร้อน) + อนุมัติโดยแอดมิน + ให้รายงานแสดงเป็น 'ลา' แทน 'ขาดงาน'"
- "เพิ่มการแจ้งเตือน LINE Notify เมื่อพนักงานยังไม่ลงเวลาเข้างานภายใน 30 นาทีหลังเวลาเริ่มงาน"
- "เพิ่มการคำนวณค่าแรงรายวัน/รายชั่วโมง และ export สรุปเงินเดือนรายเดือน"
- "เพิ่ม face matching เปรียบเทียบรูปที่ถ่ายกับรูปโปรไฟล์พนักงาน"

=== จบ PROMPT ===

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client ฝั่ง server (service role) — bypass RLS
 * ห้าม import ไฟล์นี้จาก client component เด็ดขาด
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env.local",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const PHOTO_BUCKET = process.env.SUPABASE_PHOTO_BUCKET || "attendance-photos";

/** ถังแยกสำหรับไฟล์แนบของ Memo — รับไฟล์เอกสารได้ ต่างจากถังรูปลงเวลาที่รับเฉพาะ JPEG */
export const MEMO_BUCKET = process.env.SUPABASE_MEMO_BUCKET || "marketing-files";

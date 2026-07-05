// lib/supabase/admin.js — client ฝั่งเซิร์ฟเวอร์ใช้ secret key (ข้าม RLS)
// ⚠️ ใช้ได้เฉพาะใน API route / server เท่านั้น — ห้าม import จาก component ฝั่ง client
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } }
  );
}

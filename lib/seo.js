// lib/seo.js — SEO-3: ตัวอ่านค่า seo_pages ใช้ซ้ำทุกหน้า public
// อ่านอย่างเดียวด้วย key public (RLS เปิด select ให้ทุกคน) — ใช้ได้ทั้งใน generateMetadata และ sitemap
// อ่านพลาด/ยังไม่มีแถว = คืน null ให้หน้า fallback ค่าในโค้ด (SEO ห้ามทำหน้าล่ม)
import { createClient } from "@supabase/supabase-js";

export async function getSeoPage(pageKey) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("seo_pages").select("*").eq("page_key", pageKey).single();
    return data || null;
  } catch { return null; }
}

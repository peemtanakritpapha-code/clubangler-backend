// app/sitemap.js — SEO1: แผนที่เว็บให้ Google (หน้า static + สินค้า active ทั้งหมด)
// เข้าถึงที่ https://clubangler.com/sitemap.xml — Next สร้าง XML ให้อัตโนมัติ
// ใช้ supabase-js ตรงๆ (ไม่ผ่าน lib/supabase/server) เพราะ sitemap ไม่มี request/cookies context
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600; // cache 1 ชั่วโมง — สินค้าใหม่โผล่ใน sitemap ภายใน 1 ชม.

const BASE = "https://clubangler.com";

export default async function sitemap() {
  // หน้า static ที่อยากให้ Google เก็บ (หน้าส่วนตัว/แอดมิน ไม่ใส่ — robots.js กันไว้อีกชั้น)
  const staticPages = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/market`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  let productPages = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data: products } = await supabase
      .from("products")
      .select("id, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5000);

    productPages = (products || []).map((p) => ({
      url: `${BASE}/product/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : undefined,
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch {
    // ดึงสินค้าไม่ได้ → ส่งอย่างน้อยหน้า static (อย่าให้ sitemap ล่มทั้งไฟล์)
  }

  return [...staticPages, ...productPages];
}

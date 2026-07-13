// app/sitemap.js — SEO1 + AEO-5: แผนที่เว็บ (static + หมวดหมู่ + สินค้า active + สินค้า sold ล่าสุด)
// วางแทนที่ไฟล์เดิมทั้งไฟล์
// เข้าถึงที่ https://clubangler.com/sitemap.xml — Next สร้าง XML ให้อัตโนมัติ
// ใช้ supabase-js ตรงๆ (ไม่ผ่าน lib/supabase/server) เพราะ sitemap ไม่มี request/cookies context
//
// ของใหม่รอบ AEO:
//   1) หน้าหมวด /market/[cat] ทุกหมวด (เว้นหมวดที่มี "/" ในชื่อ — ชน URL encoding)
//   2) สินค้า sold ล่าสุด 1,500 ชิ้น priority ต่ำ — หน้า SOLD คือฐานราคาอ้างอิงตลาดมือสอง
//      ที่ AI ใช้ตอบ "ราคา X มือสองเท่าไหร่" (คู่แข่งไม่มีข้อมูลชุดนี้)
import { createClient } from "@supabase/supabase-js";
import { productPath } from "@/lib/slug";
import { CAT_MAINS } from "@/lib/catalog";

export const revalidate = 3600; // cache 1 ชั่วโมง — สินค้าใหม่โผล่ใน sitemap ภายใน 1 ชม.

const BASE = "https://clubangler.com";

export default async function sitemap() {
  // หน้า static ที่อยากให้ search engine เก็บ (หน้าส่วนตัว/แอดมิน ไม่ใส่ — robots.js กันไว้อีกชั้น)
  const staticPages = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/market`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // AEO-5: หน้าหมวดถาวร — หน่วยหลักของ SEO/AEO (ประกาศหมดอายุได้ หน้าหมวดอยู่ตลอด)
  const categoryPages = CAT_MAINS.filter(c => !c.includes("/")).map(cat => ({
    url: `${BASE}/market/${encodeURIComponent(cat)}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  let productPages = [];
  let soldPages = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );

    const [{ data: actives }, { data: solds }] = await Promise.all([
      supabase.from("products")
        .select("id, name, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("products")
        .select("id, name, created_at")
        .eq("status", "sold")
        .order("created_at", { ascending: false })
        .limit(1500),
    ]);

    productPages = (actives || []).map((p) => ({
      url: `${BASE}${productPath(p)}`, // SEO2: URL แบบมีชื่อ
      lastModified: p.created_at ? new Date(p.created_at) : undefined,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    soldPages = (solds || []).map((p) => ({
      url: `${BASE}${productPath(p)}`,
      lastModified: p.created_at ? new Date(p.created_at) : undefined,
      changeFrequency: "monthly",
      priority: 0.4,
    }));
  } catch {
    // ดึงสินค้าไม่ได้ → ส่งอย่างน้อยหน้า static + หมวด (อย่าให้ sitemap ล่มทั้งไฟล์)
  }

  return [...staticPages, ...categoryPages, ...productPages, ...soldPages];
}

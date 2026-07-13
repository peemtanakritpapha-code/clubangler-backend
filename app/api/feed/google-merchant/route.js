// app/api/feed/google-merchant/route.js — AEO-3: product feed มาตรฐาน Google Merchant (RSS 2.0 + namespace g:)
// วางที่: app/api/feed/google-merchant/route.js — เข้าถึงที่ /api/feed/google-merchant
//
// ใช้กับ:
//   1) Google Merchant Center (free listings) → สินค้าเข้า Shopping Graph ที่ Gemini/AI Mode ใช้แนะนำ
//   2) Microsoft Merchant Center → Copilot/Bing Shopping
//   ทั้งสองที่ตั้ง scheduled fetch ชี้มาที่ URL นี้ (ดึงวันละ 1 ครั้ง)
//
// กติกา: เฉพาะ active + มีสต๊อคจริง (feed คือของที่ "ซื้อได้เดี๋ยวนี้" — sold ไม่เอาเข้า
//   ต่างจาก sitemap ที่ใส่ sold เป็นฐานราคา) · สินค้าไม่มีรูปถูกตัดทิ้ง (merchant บังคับ image_link)
import { createClient } from "@supabase/supabase-js";
import { productPath } from "@/lib/slug"; // Iron Rule 22: ลิงก์สินค้าผ่าน productPath ที่เดียว

export const dynamic = "force-dynamic"; // ถูกเรียกวันละครั้งจาก merchant center — สดทุกครั้ง ไม่หนัก

const BASE = "https://clubangler.com";
// กัน CDATA แตก (ข้อความผู้ขายพิมพ์อะไรก็ได้) + escape ค่าใน tag ธรรมดา
const cdata = s => String(s ?? "").replace(/]]>/g, "]]&gt;");
const xesc = s => String(s ?? "").replace(/[<>&"']/g, ch =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[ch]));

export async function GET() {
  let items = "";
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data: products } = await supabase
      .from("products")
      .select("id, name, description, price, brand, cond, cond_label, images, cat_main, cat_sub, stock")
      .eq("status", "active")
      .gte("stock", 1)
      .order("created_at", { ascending: false })
      .limit(2500);

    items = (products || []).map(p => {
      const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
      if (!img) return ""; // ไม่มีรูป = merchant ปฏิเสธทั้งรายการ — ตัดทิ้งดีกว่าลาก feed ทั้งไฟล์ติด error
      const link = `${BASE}${productPath(p)}`;
      const condition = p.cond === "ของใหม่" ? "new" : "used";
      // description สั้นเกิน = ใช้สูตรสำรอง (แนวเดียวกับ SEO-1 หน้าสินค้า)
      const desc = (p.description || "").trim().length >= 20
        ? p.description.slice(0, 4900)
        : `${p.name} สภาพ${p.cond_label || p.cond || "ดี"} ซื้อขายปลอดภัยผ่านระบบพักเงิน escrow ที่ ClubAngler`;
      const type = [p.cat_main, ...String(p.cat_sub || "").split(" › ")]
        .map(x => (x || "").trim()).filter(Boolean).join(" > ");

      return [
        "  <item>",
        `    <g:id>${p.id}</g:id>`,
        `    <g:title><![CDATA[${cdata(p.name)}]]></g:title>`,
        `    <g:description><![CDATA[${cdata(desc)}]]></g:description>`,
        `    <g:link>${xesc(link)}</g:link>`,
        `    <g:image_link>${xesc(img)}</g:image_link>`,
        `    <g:condition>${condition}</g:condition>`,
        `    <g:availability>in_stock</g:availability>`,
        `    <g:price>${(Number(p.price) || 0).toFixed(2)} THB</g:price>`,
        p.brand ? `    <g:brand><![CDATA[${cdata(p.brand)}]]></g:brand>` : null,
        // ของมือสองส่วนใหญ่ไม่มี GTIN/MPN — condition=used ผ่อนเงื่อนไข identifier ให้อยู่แล้ว
        `    <g:google_product_category>Sporting Goods &gt; Outdoor Recreation &gt; Fishing</g:google_product_category>`,
        type ? `    <g:product_type><![CDATA[${cdata(type)}]]></g:product_type>` : null,
        "  </item>",
      ].filter(Boolean).join("\n");
    }).filter(Boolean).join("\n");
  } catch (e) {
    // fail-soft: ส่ง feed โครงเปล่าดีกว่า 500 — merchant center จะ retry รอบถัดไปเอง
    console.error("feed/google-merchant:", e?.message || e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>ClubAngler — อุปกรณ์ตกปลามือสอง</title>
  <link>${BASE}</link>
  <description>ตลาดซื้อขายอุปกรณ์ตกปลามือสองและมือหนึ่ง ทุกออเดอร์ผ่านระบบพักเงิน escrow</description>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

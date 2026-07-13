// app/market/page.js — ตลาดสินค้า (A4 ก้าว 2: ข้อมูลครบสำหรับสกิน Masonry · W5.5 เพิ่ม avatar_path)
import { createClient } from "@/lib/supabase/server";
import MarketClient from "./MarketClient";
import Link from "next/link"; // SEO-5
import { CAT_MAINS } from "@/lib/catalog"; // SEO-5
import { getExtraBrands } from "@/lib/brands"; // BRAND-ADM
import { getSeoPage } from "@/lib/seo"; // SEO-4

export const dynamic = "force-dynamic";

// SEO1: title/description เฉพาะหน้าตลาด (เดิมใช้ title กลางจาก layout ซ้ำทุกหน้า)
export async function generateMetadata() {
  const seo = await getSeoPage("market"); // SEO-4: ค่าจากแอดมินมาก่อน ไม่มี/อ่านพลาด = fallback ค่าในโค้ด
  return {
    title: seo?.title || "ตลาดสินค้า — ClubAngler ซื้อขายอุปกรณ์ตกปลา มือหนึ่ง/มือสอง",
    description: seo?.description || "รวมคันเบ็ด รอก เหยื่อปลอม และอุปกรณ์ตกปลาทุกชนิด ซื้อขายปลอดภัยผ่านระบบเงินฝากคนกลาง (escrow)",
  };
}

export default async function MarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id, preorder_days")
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .limit(60);

  // ข้อมูลผู้ขายสำหรับแถวล่างการ์ด (prototype MasonryCard บรรทัด 753–767)
  const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));

  const rows = (products || []).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));
  const extraBrands = await getExtraBrands(supabase); // BRAND-ADM
  return (
    <>
      <MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} />
      {/* SEO-5: ลิงก์หมวดจริงท้ายหน้า — ผู้ใช้กดเข้าหมวดได้ + Google เดินตามลิงก์ไปเก็บหน้าหมวด */}
      <nav aria-label="หมวดหมู่สินค้า" style={{ maxWidth: 1200, margin: "0 auto", padding: "6px 16px 28px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6B7678", marginBottom: 8 }}>เลือกดูตามหมวดหมู่</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CAT_MAINS.map((cat) => (
            <Link key={cat} href={`/market/${encodeURIComponent(cat)}`} style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 999, textDecoration: "none",
              border: "1px solid #E5E9EA", background: "#fff", color: "#0E7E8C", fontWeight: 600,
            }}>{cat}</Link>
          ))}
        </div>
      </nav>
    </>
  );
}

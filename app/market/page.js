// app/market/page.js — ตลาดสินค้า (A4 ก้าว 2: ข้อมูลครบสำหรับสกิน Masonry · W5.5 เพิ่ม avatar_path)
import { createClient } from "@/lib/supabase/server";
import MarketClient from "./MarketClient";
import CatSlider from "./CatSlider"; // SEO-5c
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

export default async function MarketPage({ searchParams }) { // LOADMORE
  const sp = await searchParams; // Next 15+: searchParams เป็น Promise ต้อง await
  const page = Math.max(1, parseInt(sp?.page, 10) || 1);
  const PER = 60;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id, preorder_days")
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .range((page - 1) * PER, page * PER); // LOADMORE: ดึงเกินไว้ 1 ชิ้นเพื่อเช็คว่ามีหน้าถัดไป

  // ข้อมูลผู้ขายสำหรับแถวล่างการ์ด (prototype MasonryCard บรรทัด 753–767)
  const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));

  const hasMore = (products || []).length > PER; // LOADMORE
  const rows = (products || []).slice(0, PER).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));
  const extraBrands = await getExtraBrands(supabase); // BRAND-ADM
  return (
    <>
      <MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} catBar={<CatSlider title="ช้อปตามหมวดหมู่" auto />} />
      {/* LOADMORE: แบ่งหน้าแบบลิงก์จริง — Google เดินตามเก็บสินค้าได้ทุกหน้า */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "6px 0 26px" }}>
        {page > 1 && (
          <a href={page === 2 ? "/market" : `/market?page=${page - 1}`}
            style={{ height: 44, lineHeight: "44px", padding: "0 22px", borderRadius: 999, border: "1.5px solid #E5E9EA", background: "#fff", color: "#6B7678", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>‹ ก่อนหน้า</a>
        )}
        {hasMore && (
          <a href={`/market?page=${page + 1}`}
            style={{ height: 44, lineHeight: "44px", padding: "0 26px", borderRadius: 999, border: "1.5px solid #0E7E8C", background: "#fff", color: "#0E7E8C", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>ดูเพิ่มเติม ›</a>
        )}
      </div>
      {/* SEO-5: ลิงก์หมวดจริงท้ายหน้า — ผู้ใช้กดเข้าหมวดได้ + Google เดินตามลิงก์ไปเก็บหน้าหมวด */}
    </>
  );
}

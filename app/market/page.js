// app/market/page.js — ตลาดสินค้า (A4 ก้าว 2: ข้อมูลครบสำหรับสกิน Masonry · W5.5 เพิ่ม avatar_path)
import { createClient } from "@/lib/supabase/server";
import MarketClient from "./MarketClient";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, status, cat_main, cat_sub, shipping, views, created_at, seller_id")
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
  return <MarketClient products={rows} loggedIn={!!user} />;
}

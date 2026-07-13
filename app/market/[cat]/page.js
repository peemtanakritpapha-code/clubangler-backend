// app/market/[cat]/page.js — SEO-5: หน้าหมวดหมู่ (ตัวคูณ SEO — 13 หน้า landing ให้ Google เก็บ)
// URL: /market/รอกตกปลา ฯลฯ · หมวดไม่มีจริง → 404 · title/description/ย่อหน้าแนะนำ อ่านจาก seo_pages (แก้ได้ในแท็บ SEO)
import { notFound } from "next/navigation";
import fs from "fs"; // SEO-5h
import path from "path"; // SEO-5h
import { createClient } from "@/lib/supabase/server";
import { CAT_MAINS } from "@/lib/catalog";
import { getSeoPage } from "@/lib/seo";
import { getExtraBrands } from "@/lib/brands";
import MarketClient from "../MarketClient";
import Link from "next/link"; // SEO-5d
import { ChevronLeft } from "lucide-react"; // SEO-5d

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { cat: raw } = await params;
  const cat = decodeURIComponent(raw);
  if (!CAT_MAINS.includes(cat)) return { title: "ไม่พบหมวดหมู่ — ClubAngler" };

  const seo = await getSeoPage(`cat:${cat}`);
  return {
    title: seo?.title || `${cat}มือสอง ราคาดี ซื้อขายปลอดภัยมีระบบพักเงิน | ClubAngler`,
    description: seo?.description ||
      `รวมประกาศขาย${cat} มือหนึ่งและมือสอง ตรวจสอบได้ทุกชิ้น เงินถูกพักไว้จนกว่าคุณได้รับสินค้า`,
    alternates: { canonical: `/market/${encodeURIComponent(cat)}` },
  };
}

export default async function CategoryPage({ params }) {
  const { cat: raw } = await params;
  const cat = decodeURIComponent(raw);
  if (!CAT_MAINS.includes(cat)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const seo = await getSeoPage(`cat:${cat}`);

  // สินค้าเฉพาะหมวดนี้ — ฟิลด์ชุดเดียวกับหน้า /market
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id, preorder_days")
    .eq("cat_main", cat)
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .limit(60);

  const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));
  const rows = (products || []).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));
  const extraBrands = await getExtraBrands(supabase);

  // SEO-5h: ภาพพื้นหลังหัวหมวด — วางไฟล์ public/cats/cat-hero-XX.jpg (XX = เลขหมวด) แล้วขึ้นเอง
  const heroFile = `cat-hero-${String(CAT_MAINS.indexOf(cat) + 1).padStart(2, "0")}.jpg`;
  const hero = fs.existsSync(path.join(process.cwd(), "public", "cats", heroFile)) ? `/cats/${heroFile}` : null;

  return (
    <>
      {/* SEO-5h: ผืนภาพหัวหมวด + ม่านขาวไล่เฉดให้อ่านชัด */}
      <div style={hero ? { backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url(${hero})` /* SEO-5j */, backgroundSize: "cover", backgroundPosition: "center", borderBottom: "1px solid #E5E9EA" } : undefined}>
      {/* SEO-5d: ปุ่มกลับตลาด (แทนสไลด์หมวด) */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px 0" }}>
        <Link href="/market" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 700, color: hero ? "#fff" : "#0E7E8C", textDecoration: "none", background: hero ? "rgba(0,0,0,.35)" : "#E3F1F3", padding: "6px 13px 6px 8px", borderRadius: 999 }}>
          <ChevronLeft size={16} />กลับสู่หน้าตลาด
        </Link>
      </div>
      {/* h1 + ย่อหน้าแนะนำ (จากแท็บ SEO) = เนื้อหาที่ทำให้หน้าหมวดติดอันดับ — intro มาจากแอดมินเท่านั้น (เขียนได้เฉพาะ service key) จึงปลอดภัยพอสำหรับ dangerouslySetInnerHTML */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: hero ? "8px 16px 12px" : "18px 16px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: hero ? "#fff" : "#101314", margin: 0, textShadow: hero ? "0 1px 6px rgba(0,0,0,.45)" : "none" }}>{cat} มือสอง และมือหนึ่ง</h1>
        {seo?.intro_html ? (
          <div style={{ fontSize: 13, color: hero ? "rgba(255,255,255,.94)" : "#6B7678", lineHeight: 1.45, marginTop: 4, maxWidth: 760, textShadow: hero ? "0 1px 5px rgba(0,0,0,.5)" : "none" }}
            dangerouslySetInnerHTML={{ __html: seo.intro_html }} />
        ) : null}
      </section>
      </div>
      <MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} hideCat searchCat={cat} />
    </>
  );
}

// app/market/[cat]/[sub]/page.js — REEL-1: หน้าหมวดย่อยรอก 3 หน้า (โครงเดียวกับหน้าหมวด SEO-5)
// URL: /market/รอกตกปลา/สปินนิ่ง · /market/รอกตกปลา/เบทหยดน้ำ · /market/รอกตกปลา/เบทกลม-ทะเล
// route dynamic ทั้ง [cat] และ [sub] (ห้ามตั้งโฟลเดอร์ชื่อไทย) — ตอนนี้เปิดเฉพาะ cat "รอกตกปลา"
// + slug ที่อยู่ใน lib/reelSubs.js เท่านั้น นอกนั้น 404 · โครงยืดหยุ่นรองรับหมวดอื่นในอนาคต
// title/description/ย่อหน้าแนะนำ อ่านจาก seo_pages คีย์ "sub:รอกตกปลา/<slug>" (แก้ได้ในแท็บ SEO)
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { REEL_CAT, reelBySlug } from "@/lib/reelSubs";
import { getSeoPage } from "@/lib/seo";
import { getExtraBrands } from "@/lib/brands";
import MarketClient from "../../MarketClient";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// แกะ params → entry ใน reelSubs (ใช้ร่วมกัน generateMetadata/หน้าเพจ) — ไม่ผ่านเงื่อนไข = null
async function resolveReel(params) {
  const { cat: rawCat, sub: rawSub } = await params;
  const cat = decodeURIComponent(rawCat);
  if (cat !== REEL_CAT) return null;
  return reelBySlug(decodeURIComponent(rawSub));
}

export async function generateMetadata({ params }) {
  const r = await resolveReel(params);
  if (!r) return { title: "ไม่พบหมวดหมู่ — ClubAngler" };

  const seo = await getSeoPage(`sub:${REEL_CAT}/${r.slug}`);
  return {
    title: seo?.title || `${r.label}มือสอง ราคาดี ซื้อขายปลอดภัยมีระบบพักเงิน | ClubAngler`,
    description: seo?.description ||
      `รวมประกาศขาย${r.label} มือหนึ่งและมือสอง ตรวจสอบได้ทุกชิ้น เงินถูกพักไว้จนกว่าคุณได้รับสินค้า`,
    alternates: { canonical: `/market/${encodeURIComponent(REEL_CAT)}/${encodeURIComponent(r.slug)}` },
  };
}

export default async function ReelSubPage({ params }) {
  const r = await resolveReel(params);
  if (!r) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const seo = await getSeoPage(`sub:${REEL_CAT}/${r.slug}`);

  // สินค้าเฉพาะประเภทรอกนี้ — cat_sub เก็บเส้นทางต่อด้วย " › ":
  //   sub ไม่มีลูก (สปินนิ่ง) = ค่าตรงตัว · sub มีลูก = ค่าตรงตัว หรือ "sub › ลูก"
  //   เงื่อนไขเดียวกับตัวกรองฝั่ง client ใน MarketClient (eq ตรง หรือ startsWith "sub › ")
  //   ⚠️ ค่ามี " / " — ผ่านการเทสกับ PostgREST ด้วย scripts/test-reel-query.mjs แล้วเท่านั้นจึงเชื่อได้
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id, preorder_days")
    .eq("cat_main", REEL_CAT)
    .or(`cat_sub.eq.${r.sub},cat_sub.like.${r.sub} › %`)
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

  // ภาพพื้นหลังหัวหน้า (ไม่บังคับ) — วางไฟล์ public/cats/cat-hero-reel-<slug>.jpg แล้วขึ้นเอง
  const heroFile = `cat-hero-reel-${r.slug}.jpg`;
  const hero = fs.existsSync(path.join(process.cwd(), "public", "cats", heroFile)) ? `/cats/${heroFile}` : null;

  return (
    <>
      <div style={hero ? { backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url(${hero})`, backgroundSize: "cover", backgroundPosition: "center", borderBottom: "1px solid #E5E9EA" } : undefined}>
      {/* ปุ่มกลับสู่หน้าตลาด (REEL-1FIX: เคาะให้เหมือนหน้าหมวดเดิม) — ลิงก์เลี้ยงหน้าแม่ย้ายไปใส่ในย่อหน้าแนะนำแท็บ SEO (REEL-3) แทน */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px 0" }}>
        <Link href="/market" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "clamp(11px, 2.9vw, 13px)", fontWeight: 700, color: "#fff", textDecoration: "none", background: "#0E7E8C", padding: "6px 13px 6px 8px", borderRadius: 999 }}>
          <ChevronLeft size={16} />กลับสู่หน้าตลาด
        </Link>
      </div>
      {/* h1 + ย่อหน้าแนะนำ (จากแท็บ SEO) — intro มาจากแอดมินเท่านั้น (เขียนได้เฉพาะ service key) จึงปลอดภัยพอสำหรับ dangerouslySetInnerHTML */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: hero ? "8px 16px 12px" : "18px 16px 0" }}>
        <h1 style={{ fontSize: "clamp(14px, 3.6vw, 20px)", fontWeight: 800, color: hero ? "#fff" : "#101314", margin: 0, textShadow: hero ? "0 1px 6px rgba(0,0,0,.45)" : "none" }}>{r.label} มือสอง และมือหนึ่ง</h1>
        {seo?.intro_html ? (
          <div style={{ fontSize: "clamp(10px, 2.6vw, 13px)", color: hero ? "rgba(255,255,255,.94)" : "#6B7678", lineHeight: 1.45, marginTop: 4, maxWidth: 760, textShadow: hero ? "0 1px 5px rgba(0,0,0,.5)" : "none" }}
            dangerouslySetInnerHTML={{ __html: seo.intro_html }} />
        ) : null}
      </section>
      </div>
      <MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} hideCat searchCat={REEL_CAT} basePath={[REEL_CAT, r.sub]} /> {/* REEL-1FIX2: ตัวกรองเริ่มลึกถึงประเภทรอกของหน้านี้ */}
    </>
  );
}

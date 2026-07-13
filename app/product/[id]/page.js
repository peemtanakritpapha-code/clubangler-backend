// app/product/[id]/page.js — หน้าสินค้า (A3 ปุ่มตะกร้า + A4 ตัวนับวิว + W5.4 โฉมเว็บ 2 คอลัมน์)
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductClient from "./ProductClient";
import { productPath, productIdFromParam } from "@/lib/slug";

export const dynamic = "force-dynamic";

// SHARE1: Open Graph — แชร์ไป LINE/FB/ชีตระบบ แล้วขึ้นการ์ดรูป+ชื่อ+ราคา (ไม่ใช่ลิงก์โล้นๆ)
export async function generateMetadata({ params }) {
  const { id: rawId } = await params;
  const id = productIdFromParam(rawId); // SEO2: รับทั้ง /product/14 และ /product/14-ชื่อ
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("name, price, description, images, brand, location, cond, cond_label, cat_main, cat_sub, status").eq("id", id).single();
  if (!p) return { title: "ไม่พบสินค้า — ClubAngler" };
  // SEO-1: title = ชื่อ + แบรนด์(ถ้าชื่อยังไม่มี) + มือสอง(ตามสภาพจริง) + จังหวัด — คีย์เวิร์ด long-tail ที่คนค้นจริง
  //        เอาราคาออก (stale ง่าย ไม่ช่วยอันดับ — ราคายังโชว์ใน rich result ผ่าน Product schema)
  // SEO-1b: หมวด 2 ชั้นท้ายสุด (ข้าม "อื่นๆ") แทนจังหวัด — จังหวัดยังเก็บแต้มอยู่ใน description
  const catParts = [p.cat_main, ...String(p.cat_sub || "").split(" › ")].map(x => (x || "").trim()).filter(c => c && c !== "อื่นๆ");
  const nameLow = (p.name || "").toLowerCase();
  const catWords = catParts.slice(-2).filter(c => !nameLow.includes(c.toLowerCase())); // คำที่มีในชื่อแล้วไม่ต่อซ้ำ กัน keyword stuffing
  const brandWord = p.brand && !nameLow.includes(p.brand.toLowerCase()) ? p.brand : "";
  const condWord = p.cond === "ของใหม่" ? "ของใหม่" : "มือสอง";
  const compose = ws => ws.filter(Boolean).join(" ");
  let title = compose([p.name, brandWord, ...catWords, condWord]);
  if (title.length > 60 && catWords.length > 1) title = compose([p.name, brandWord, catWords[catWords.length - 1], condWord]); // ถอดหมวดชั้นบน
  if (title.length > 60) title = compose([p.name, catWords[catWords.length - 1] || "", condWord]); // ถอดแบรนด์
  if (title.length > 60) title = title.slice(0, 59) + "…";
  title += " | ClubAngler";
  // SEO-1: detail สั้นกว่า 50 ตัวอักษร = ใช้สูตรสำรองแทนปล่อยโหรงเหรง
  const description = ((p.description || "").trim().length >= 50)
    ? p.description.slice(0, 150)
    : `ขาย ${p.name} สภาพ${p.cond_label || p.cond || "ดี"} ${p.location ? `จาก${p.location} ` : ""}ซื้อขายปลอดภัยผ่านระบบพักเงิน escrow ที่ ClubAngler`.slice(0, 160);
  const images = p.images?.length ? [p.images[0]] : [];
  return {
    title,
    description,
    // AEO-6: active/sold เท่านั้นที่ให้ index — review/suspended เข้าด้วย URL ตรงได้แต่ห้ามติด search
    ...(["active", "sold"].includes(p.status) ? {} : { robots: { index: false, follow: false } }),
    alternates: { canonical: productPath({ id, name: p.name }) }, // SEO2: ชี้ URL แบบ slug เป็นตัวจริงกัน Google นับซ้ำ
    openGraph: { title, description, images, type: "website", siteName: "ClubAngler" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function ProductPage({ params }) {
  const { id: rawId } = await params;
  const id = productIdFromParam(rawId); // SEO2: รับทั้ง /product/14 และ /product/14-ชื่อ
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
  if (!p) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user && user.id === p.seller_id;
  const canBuy = p.status === "active" && (Number(p.stock) || 0) > 0 && !isOwner; // สต๊อค 0 = ปุ่มซื้อไม่โชว์

  // A4: ตัวนับวิว — นับเมื่อคนอื่นเปิดดู (เจ้าของดูเองไม่นับ) ผ่านฟังก์ชัน DB
  if (!isOwner) await supabase.rpc("increment_product_views", { pid: Number(id) });
  const views = (p.views || 0) + (isOwner ? 0 : 1);

  // W5.4: ผู้ขาย (เพิ่ม is_shop + avatar_path จาก W5.2) + สินค้าคล้ายกัน (หมวดเดียวกัน)
  const [{ data: seller }, { data: similar }] = await Promise.all([
    supabase.from("profiles").select("name, kyc_status, is_shop, avatar_path").eq("id", p.seller_id).single(),
    supabase.from("products")
      .select("id, name, price, images, status")
      .eq("cat_main", p.cat_main).eq("status", "active").neq("id", p.id)
      .order("created_at", { ascending: false }).limit(8),
  ]);

  // SEO1: JSON-LD Product schema — ให้ Google โชว์ราคา/สถานะสินค้าในผลค้นหา (rich result)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images || [],
    description: (p.description || "").slice(0, 300),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    itemCondition: p.cond === "ของใหม่"
      ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: `https://clubangler.com${productPath(p)}`,
      priceCurrency: "THB",
      price: Number(p.price || 0),
      availability: p.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      ...(seller?.name ? { seller: { "@type": seller.is_shop ? "Organization" : "Person", name: seller.name } } : {}),
    },
  };

  // AEO-6: เส้นทางหมวด — ผูกหน้าสินค้าเข้ากับหน้าหมวดถาวร (ให้บอทเข้าใจโครงเว็บ)
  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: "https://clubangler.com" },
      { "@type": "ListItem", position: 2, name: "ตลาดสินค้า", item: "https://clubangler.com/market" },
      ...(p.cat_main && !p.cat_main.includes("/")
        ? [{ "@type": "ListItem", position: 3, name: p.cat_main, item: `https://clubangler.com/market/${encodeURIComponent(p.cat_main)}` }]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <ProductClient p={p} seller={seller} views={views} canBuy={canBuy} isOwner={isOwner} similar={similar || []} loggedIn={!!user} />
    </>
  );
}

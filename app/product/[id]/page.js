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
  const { data: p } = await supabase.from("products").select("name, price, detail, images").eq("id", id).single();
  if (!p) return { title: "ไม่พบสินค้า — ClubAngler" };
  const title = `${p.name} · ฿${Number(p.price || 0).toLocaleString()} — ClubAngler`;
  const description = (p.detail || "ตลาดอุปกรณ์ตกปลามือสอง ซื้อขายปลอดภัยผ่านระบบเงินฝากคนกลาง").slice(0, 150);
  const images = p.images?.length ? [p.images[0]] : [];
  return {
    title,
    description,
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
  const canBuy = p.status === "active" && !isOwner;

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
    description: (p.detail || "").slice(0, 300),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    itemCondition: p.cond === "ของใหม่"
      ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url: `https://clubangler.com${productPath(p)}`,
      priceCurrency: "THB",
      price: Number(p.price || 0),
      availability: p.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductClient p={p} seller={seller} views={views} canBuy={canBuy} isOwner={isOwner} similar={similar || []} loggedIn={!!user} />
    </>
  );
}

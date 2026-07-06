// app/product/[id]/page.js — หน้าสินค้า (A3 ปุ่มตะกร้า + A4 ตัวนับวิว + W5.4 โฉมเว็บ 2 คอลัมน์)
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductClient from "./ProductClient";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }) {
  const { id } = await params;
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

  return <ProductClient p={p} seller={seller} views={views} canBuy={canBuy} isOwner={isOwner} similar={similar || []} />;
}

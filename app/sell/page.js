// app/sell/page.js — ลงขายสินค้า + โหมดแก้ไขประกาศ (W5.7a: /sell?edit={id})
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellClient from "./SellClient";

export const dynamic = "force-dynamic";

export default async function SellPage({ searchParams }) {
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");

  // โหมดแก้ไข: ดึงเฉพาะสินค้าของตัวเอง — ไม่ใช่ของเรา/ไม่มี = เด้งกลับ
  let editProduct = null;
  if (edit) {
    const { data: p } = await supabase.from("products").select("*").eq("id", edit).eq("seller_id", user.id).single();
    if (!p) redirect("/my-products");
    editProduct = p;
  }

  return <SellClient userId={user.id} tiers={tiers || []} editProduct={editProduct} />;
}

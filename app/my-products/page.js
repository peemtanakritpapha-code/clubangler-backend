// app/my-products/page.js — สินค้าที่ลงขาย (W5.3)
// derive จาก prototype WMyProducts (บรรทัด 7523–7560): 3 แท็บ กำลังขาย/รอตรวจ/ขายแล้ว + เมนู ⋯ ต่อการ์ด
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyProductsClient from "./MyProductsClient";

export const dynamic = "force-dynamic";

export default async function MyProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ดึงทุกสถานะของตัวเอง (active/sold/pending/review/suspended)
  const { data: products } = await supabase.from("products")
    .select("id, name, price, cond, cond_label, images, image_ratio, status, suspend_reason, created_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return <MyProductsClient products={products || []} userId={user.id} />;
}

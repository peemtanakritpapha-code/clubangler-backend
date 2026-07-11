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

  // POST3.3: คนโดนแบนลงขาย/แก้ประกาศไม่ได้
  const { data: banProf } = await supabase.from("profiles").select("banned_at").eq("id", user.id).single();
  if (banProf?.banned_at) {
    return (
      <div style={{ maxWidth: 480, margin: "70px auto", textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 42 }}>⛔</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10, color: "#17181A" }}>บัญชีของคุณถูกระงับการลงขายชั่วคราว</div>
        <div style={{ fontSize: 13, color: "#80868D", marginTop: 8, lineHeight: 1.8 }}>
          ออเดอร์เดิมยังเข้าดูและดำเนินการต่อได้ตามปกติ<br />หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อทีมงาน
        </div>
      </div>
    );
  }
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");

  // โหมดแก้ไข: ดึงเฉพาะสินค้าของตัวเอง — ไม่ใช่ของเรา/ไม่มี = เด้งกลับ
  let editProduct = null;
  if (edit) {
    const { data: p } = await supabase.from("products").select("*").eq("id", edit).eq("seller_id", user.id).single();
    if (!p) redirect("/my-products");
    editProduct = p;
  }

  return <SellClient userId={user.id} tiers={tiers || []} editProduct={editProduct} aiEnabled={!!process.env.ANTHROPIC_API_KEY} />;
}

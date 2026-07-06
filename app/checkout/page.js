// app/checkout/page.js — ยืนยันคำสั่งซื้อแบบตะกร้า (A3 ก้าว 3)
// รายการสินค้ามาจากตะกร้าฝั่ง client (localStorage) — server เตรียมแค่ user/สมุดที่อยู่/เรทค่าธรรมเนียม
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutCartClient from "./CheckoutCartClient";

export default async function CheckoutCartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: addresses } = await supabase.from("addresses").select("*")
    .eq("user_id", user.id).order("is_default", { ascending: false }).order("id");
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");

  return <CheckoutCartClient addresses={addresses || []} tiers={tiers || []} userId={user.id} />;
}

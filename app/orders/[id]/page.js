// app/orders/[id]/page.js — หน้ารายละเอียดออเดอร์ (spec §3–4)
// กันสิทธิ์: เปิดได้เฉพาะผู้ซื้อหรือผู้ขายของออเดอร์นั้นเท่านั้น — คนอื่นเด้งกลับ /orders
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrderDetailClient from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: o } = await supabase.from("orders")
    .select("*, products(id, name, images)")
    .eq("id", id).single();
  if (!o || (o.buyer_id !== user.id && o.seller_id !== user.id)) redirect("/orders");

  const role = o.seller_id === user.id ? "sell" : "buy";

  // ข้อมูลคู่ค้า (รองรับบัญชีที่ถูกลบ = null) + config ระบบ (อ่านกันพัง — ไม่มีก็ใช้ค่า null)
  const counterpartId = role === "sell" ? o.buyer_id : o.seller_id;
  const [{ data: counterpart }, { data: cfgRows }] = await Promise.all([
    counterpartId
      ? supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").eq("id", counterpartId).single()
      : Promise.resolve({ data: null }),
    supabase.from("platform_config").select("*").limit(1),
  ]);

  // ผู้ขายพิมพ์ใบปะหน้า: ใช้ที่อยู่ default ของตัวเองเป็นผู้ส่ง (ไม่มีก็พิมพ์ได้ ช่องผู้ส่งเว้น)
  let sender = null;
  if (role === "sell") {
    const [{ data: meProfile }, { data: addr }] = await Promise.all([
      supabase.from("profiles").select("name, phone").eq("id", user.id).single(),
      supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).limit(1),
    ]);
    const a = addr?.[0];
    sender = { name: meProfile?.name, phone: a?.phone || meProfile?.phone, address: a ? [a.addr, a.sub, a.district, a.province, a.zip].filter(Boolean).join(" ") : null };
  }

  return <OrderDetailClient order={o} role={role} counterpart={counterpart} sender={sender} config={cfgRows?.[0] || null} userId={user.id} />;
}

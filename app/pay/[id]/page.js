// app/pay/[id]/page.js — หน้าชำระเงิน
// A3 ก้าว 4: ออเดอร์ที่มี pay_group (ซื้อหลายชิ้นจ่ายครั้งเดียว) → ดึงทั้งกลุ่มมาโชว์ยอดรวม + สลิปเดียว
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PayClient from "./PayClient";

export default async function PayPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.buyer_id !== user.id) notFound();

  // สมาชิกร่วมกลุ่มชำระ (รวมตัวเอง) — เรียงตามเลขที่ให้ ORD หลักขึ้นก่อน
  let groupOrders = null;
  if (order.pay_group) {
    const { data: g } = await supabase.from("orders").select("*")
      .eq("pay_group", order.pay_group).eq("buyer_id", user.id).order("order_no");
    if (g?.length > 1) groupOrders = g;
  }

  const { data: config } = await supabase.from("platform_config").select("*").single();
  return <PayClient order={order} groupOrders={groupOrders} config={config} userId={user.id} />;
}

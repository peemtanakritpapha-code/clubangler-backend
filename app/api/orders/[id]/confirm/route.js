// app/api/orders/[id]/confirm/route.js — ผู้ซื้อยืนยันรับสินค้า → delivered
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, buyer_id, seller_id, status, order_no, item").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.status !== "shipped")
    return NextResponse.json({ error: "ออเดอร์ยังไม่อยู่ในขั้นจัดส่ง" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    delivered_at: new Date().toISOString(), status: "delivered",
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.seller_id, icon: "✅", title: "ผู้ซื้อยืนยันรับสินค้าแล้ว",
    body: `${o.item} — รอแอดมินโอนเงินให้คุณ`, ref: o.order_no,
  });
  await notifyAdmins(admin, { icon: "💸", title: "ผู้ซื้อยืนยันรับแล้ว — พร้อมโอนเงินผู้ขาย", body: o.item, ref: o.order_no, link: "/admin?tab=payout" });
  return NextResponse.json({ ok: true });
}

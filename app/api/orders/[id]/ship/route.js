// app/api/orders/[id]/ship/route.js — ผู้ขายกรอกขนส่ง+เลขพัสดุ → shipped
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { carrier, trackingNo } = await req.json();
  if (!carrier || !String(trackingNo || "").trim())
    return NextResponse.json({ error: "กรอกขนส่งและเลขพัสดุให้ครบ" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, seller_id, buyer_id, status, order_no, item").eq("id", id).single();
  if (!o || o.seller_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.status !== "payment_verified")
    return NextResponse.json({ error: "ออเดอร์ยังไม่พร้อมจัดส่ง (เงินต้องเข้า escrow ก่อน)" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    carrier, tracking_no: String(trackingNo).trim(), shipped_at: new Date().toISOString(), status: "shipped",
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.buyer_id, icon: "📦", title: "ผู้ขายจัดส่งสินค้าแล้ว",
    body: `${o.item} · ${carrier} ${trackingNo}`, ref: o.order_no,
  });
  return NextResponse.json({ ok: true });
}

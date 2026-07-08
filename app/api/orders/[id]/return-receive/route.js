// app/api/orders/[id]/return-receive/route.js — ผู้ขายยืนยันรับของคืน (รูปสภาพ ≥1 บังคับ)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { conditionPaths } = await req.json();
  if (!Array.isArray(conditionPaths) || conditionPaths.length < 1)
    return NextResponse.json({ error: "ถ่ายรูปสภาพของคืนอย่างน้อย 1 รูปก่อนยืนยัน" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).single();
  if (!o || o.seller_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.status !== "return_shipped")
    return NextResponse.json({ error: "ออเดอร์ยังไม่อยู่ในขั้นส่งคืน" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    status: "return_received", return_condition_paths: conditionPaths.slice(0, 5),
    return_received_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.buyer_id, icon: "📦", title: "ผู้ขายรับสินค้าคืนแล้ว",
    body: `${o.item} — รอแอดมินโอนเงินคืนให้คุณ`, ref: o.order_no,
  });
  await notifyAdmins(admin, { icon: "↩️", title: "เคสคืนเข้าคิวคืนเงิน", body: o.item, ref: o.order_no, link: "/admin?tab=payout" });
  return NextResponse.json({ ok: true });
}

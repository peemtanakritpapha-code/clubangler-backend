// app/api/orders/[id]/cancel/route.js — ผู้ซื้อยกเลิกคำสั่งซื้อเอง (เฉพาะก่อนชำระเงิน) → expired
// กติกา: ยกเลิกได้เฉพาะ pending_payment เท่านั้น — แนบสลิปแล้ว (pending_verification) ต้องรอแอดมินตัดสินก่อน
// expired ไม่แตะเส้นทางเงิน: ยังไม่มีเงินใน escrow + สต็อกยังไม่ถูกตัด (ตัดตอน approve) จึงไม่ต้องคืนอะไร
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, buyer_id, seller_id, status, order_no, item").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.status === "pending_verification")
    return NextResponse.json({ error: "แนบสลิปไปแล้ว — รอผลตรวจจากแอดมินก่อน จึงจะดำเนินการต่อได้" }, { status: 400 });
  if (o.status !== "pending_payment")
    return NextResponse.json({ error: "ออเดอร์นี้เลยขั้นตอนที่ยกเลิกเองได้แล้ว" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    status: "expired", cancelled_at: new Date().toISOString(), cancel_reason: "ผู้ซื้อยกเลิกเองก่อนชำระเงิน",
  }).eq("id", id).eq("status", "pending_payment"); // กันชน: สถานะต้องยังไม่ขยับตอนกด
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.seller_id, icon: "🚫", title: "ผู้ซื้อยกเลิกคำสั่งซื้อ",
    body: `${o.item} — ยกเลิกก่อนชำระเงิน สินค้ายังลงขายตามปกติ`, ref: o.order_no,
  });
  return NextResponse.json({ ok: true });
}

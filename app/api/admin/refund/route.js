// app/api/admin/refund/route.js — คืนเงินผู้ซื้อ (return_received | cancelled → refunded) · สลิปบังคับ
// รับ 2 เคส: คืนสินค้า (return_received) และยกเลิกไม่จัดส่ง (cancelled) — แจ้งเตือนแยกตามเคส
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });

  const { orderId, slipPath } = await req.json();
  if (!slipPath) return NextResponse.json({ error: "ต้องแนบสลิปคืนเงินทุกครั้ง" }, { status: 400 });

  const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!o || !["return_received", "cancelled"].includes(o.status))
    return NextResponse.json({ error: "เคสนี้ไม่อยู่ในคิวคืนเงิน" }, { status: 400 });

  const isCancelled = o.status === "cancelled";
  const refund = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
  const { error } = await admin.from("orders").update({
    status: "refunded", refund_slip_path: slipPath, refunded_at: new Date().toISOString(),
  }).eq("id", o.id).eq("status", o.status); // กันชน: สถานะต้องยังเป็นตัวเดิมตอนกดคืน
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert([
    { to_user: o.buyer_id, icon: "💸", title: "คืนเงินให้คุณแล้ว", body: `${o.item} — ยอด ฿${refund.toLocaleString()} · ดูสลิปได้ในรายละเอียดออเดอร์`, ref: o.order_no },
    isCancelled
      ? { to_user: o.seller_id, icon: "⛔", title: "ออเดอร์ที่ถูกยกเลิก — คืนเงินผู้ซื้อแล้ว", body: `${o.item} — เคสปิดเรียบร้อย`, ref: o.order_no }
      : { to_user: o.seller_id, icon: "↩️", title: "เคสคืนสินค้าปิดแล้ว", body: `${o.item} — คืนเงินผู้ซื้อเรียบร้อย`, ref: o.order_no },
  ]);
  return NextResponse.json({ ok: true });
}

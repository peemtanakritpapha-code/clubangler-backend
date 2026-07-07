// app/api/orders/[id]/slip/route.js — ผู้ซื้อแนบสลิป → รอแอดมินตรวจ
// A3 ก้าว 4: ถ้าออเดอร์อยู่ในกลุ่มชำระ (pay_group) สลิปใบเดียวติดทุกออเดอร์ในกลุ่ม
// (ตรรกะจาก prototype: สลิปเดียว transferAmount = ยอดรวมกลุ่ม บันทึกเหมือนกันทุกออเดอร์ — บรรทัด 4127–4134)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { slipPath, transferAmount, transferTime } = await req.json();
  if (!slipPath) return NextResponse.json({ error: "ยังไม่ได้แนบสลิป" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, buyer_id, status, pay_group, created_at, slip_reject_reason").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!["pending_payment", "pending_verification"].includes(o.status))
    return NextResponse.json({ error: "ออเดอร์นี้เลยขั้นตอนชำระเงินแล้ว" }, { status: 400 });

  // ST1: กันซอมบี้ฟื้น — หมดเวลาชำระแล้วห้ามแนบ (ยกเว้นสลิปถูกปฏิเสธ = เคยแนบทันเวลาแล้ว)
  if (o.status === "pending_payment" && !o.slip_reject_reason) {
    const { data: cfgRows } = await admin.from("platform_config").select("pay_within_minutes").limit(1);
    const PAY_MIN = Number(cfgRows?.[0]?.pay_within_minutes) || 60;
    if (new Date(o.created_at).getTime() < Date.now() - PAY_MIN * 60000)
      return NextResponse.json({ error: "หมดเวลาชำระแล้ว — คำสั่งซื้อนี้กำลังถูกปิด สั่งซื้อใหม่ได้เลย" }, { status: 400 });
  }

  const patch = {
    slip_path: slipPath,
    transfer_amount: Number(transferAmount) || null,
    transfer_time: transferTime || new Date().toISOString(),
    status: "pending_verification",
    slip_reject_reason: null,   // สลิปใหม่ล้างเหตุผลปฏิเสธเก่า
  };

  // อัปเดตทั้งกลุ่ม (เฉพาะออเดอร์ของผู้ซื้อคนนี้ที่ยังอยู่ขั้นชำระเงิน) หรือออเดอร์เดี่ยว
  let q = admin.from("orders").update(patch)
    .eq("buyer_id", user.id)
    .in("status", ["pending_payment", "pending_verification"]);
  q = o.pay_group ? q.eq("pay_group", o.pay_group) : q.eq("id", o.id);

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// app/api/orders/[id]/slip/route.js — ผู้ซื้อแนบสลิป → รอแอดมินตรวจ
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
  const { data: o } = await admin.from("orders").select("id, buyer_id, status").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!["pending_payment", "pending_verification"].includes(o.status))
    return NextResponse.json({ error: "ออเดอร์นี้เลยขั้นตอนชำระเงินแล้ว" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    slip_path: slipPath,
    transfer_amount: Number(transferAmount) || null,
    transfer_time: transferTime || new Date().toISOString(),
    status: "pending_verification",
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

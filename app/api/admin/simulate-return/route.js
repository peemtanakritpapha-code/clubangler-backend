// app/api/admin/simulate-return/route.js — ⏩ จำลองครบกำหนด: ระบบยืนยันรับของคืนแทนผู้ขาย
// (เดโม่แทน cron — ของจริงเฟส 5 ใช้ scheduled job เงื่อนไข return_deadline < now)
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

  const { orderId } = await req.json();
  const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.status !== "return_shipped")
    return NextResponse.json({ error: "เคสนี้ไม่อยู่ในขั้นรอผู้ขายรับของ" }, { status: 400 });

  const { error } = await admin.from("orders").update({
    status: "return_received", auto_confirmed: true, return_received_at: new Date().toISOString(),
  }).eq("id", o.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert([
    { to_user: o.seller_id, icon: "⏰", title: "ระบบยืนยันรับของคืนแทน (ครบกำหนด)", body: `${o.item} — เลยกำหนดยืนยัน ระบบดำเนินการแทนแล้ว`, ref: o.order_no },
    { to_user: o.buyer_id, icon: "📦", title: "ยืนยันรับของคืนแล้ว (อัตโนมัติ)", body: `${o.item} — รอแอดมินโอนเงินคืน`, ref: o.order_no },
  ]);
  return NextResponse.json({ ok: true });
}

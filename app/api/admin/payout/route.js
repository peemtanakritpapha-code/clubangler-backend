// app/api/admin/payout/route.js — โอนเงินให้ผู้ขาย (delivered → completed) · สลิปโอนออกบังคับ
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return p?.is_admin ? { user, admin } : null;
}

export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { admin } = ctx;

  const { orderId, slipPath, failNote } = await req.json();
  const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.status !== "delivered")
    return NextResponse.json({ error: "ออเดอร์ไม่อยู่ในคิวรอโอนเงิน" }, { status: 400 });

  // ปุ่ม "โอนไม่สำเร็จ": บังคับหมายเหตุ → แจ้งผู้รับให้ไปแก้บัญชี เคสค้างคิว
  if (failNote != null) {
    if (!String(failNote).trim()) return NextResponse.json({ error: "ต้องระบุหมายเหตุ" }, { status: 400 });
    await admin.from("orders").update({ payout_failed_note: failNote.trim() }).eq("id", o.id);
    await admin.from("profiles").update({ payout_failed_note: failNote.trim() }).eq("id", o.seller_id);
    await admin.from("notifications").insert({
      to_user: o.seller_id, icon: "🔁", title: "โอนเงินไม่สำเร็จ — กรุณาตรวจบัญชีรับเงิน",
      body: `${o.item} — ${failNote.trim()}`, ref: o.order_no, link: "/kyc", // ADMIN-UX2: กดกระดิ่งไปหน้าบัญชีรับเงินตรง
    });
    return NextResponse.json({ ok: true });
  }

  if (!slipPath) return NextResponse.json({ error: "ต้องแนบสลิปโอนเงินทุกครั้ง" }, { status: 400 });
  const net = Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0);

  const { data: upd, error } = await admin.from("orders").update({
    status: "completed", payout_slip_path: slipPath, payout_failed_note: null, completed_at: new Date().toISOString(),
  }).eq("id", o.id).eq("status", "delivered").select("id"); // กันชน: ผู้ซื้อเพิ่งเปิดพิพาท — ห้ามโอนทับ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd?.length) return NextResponse.json({ error: "สถานะออเดอร์เปลี่ยนไปแล้ว (อาจมีเคสพิพาทเข้ามา) — รีเฟรชคิวก่อนโอน" }, { status: 409 });
  await admin.from("profiles").update({ payout_failed_note: null }).eq("id", o.seller_id);
  await admin.from("notifications").insert([
    { to_user: o.seller_id, icon: "💸", title: "โอนเงินให้คุณแล้ว", body: `${o.item} — ยอดสุทธิ ฿${net.toLocaleString()}`, ref: o.order_no },
    { to_user: o.buyer_id, icon: "🎉", title: "ออเดอร์เสร็จสมบูรณ์", body: `${o.item} — ขอบคุณที่ใช้ ClubAngler`, ref: o.order_no },
  ]);
  return NextResponse.json({ ok: true });
}

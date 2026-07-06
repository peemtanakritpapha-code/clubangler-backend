// app/api/admin/return-decide/route.js — แอดมินพิจารณาเคสคืน/พิพาท (ปฏิเสธบังคับเหตุผล)
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

  const { orderId, approve, reason, decision } = await req.json();
  const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!o || !["return_requested", "disputed"].includes(o.status))
    return NextResponse.json({ error: "เคสนี้ไม่อยู่ในคิวพิจารณา" }, { status: 400 });

  // AD3: ตัดสิน 3 ทาง (spec แอดมิน §3) — decision: "refund_now" = คืนเงินผู้ซื้อโดยไม่ต้องส่งของคืน
  // เข้าคิวคืนเงินทันที (สถานะ return_received + require_return=false บอกว่าเป็นเคสไม่ต้องคืนของ)
  if (decision === "refund_now") {
    const { error } = await admin.from("orders").update({ status: "return_received", require_return: false, return_reject_reason: null }).eq("id", o.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "💸", title: "แอดมินอนุมัติคืนเงิน (ไม่ต้องส่งของคืน)", body: `${o.item} — ทีมงานจะโอนเงินคืนโดยเร็ว`, ref: o.order_no },
      { to_user: o.seller_id, icon: "⚖️", title: "แอดมินตัดสินคืนเงินผู้ซื้อ", body: `${o.item} — เคสนี้คืนเงินโดยไม่ต้องรอส่งของคืน`, ref: o.order_no },
    ]);
    return NextResponse.json({ ok: true });
  }

  if (approve) {
    const { error } = await admin.from("orders").update({ status: "return_approved", return_reject_reason: null }).eq("id", o.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "✅", title: "อนุมัติการคืนสินค้า", body: `${o.item} — กรุณาส่งสินค้าคืนและกรอกเลขพัสดุ`, ref: o.order_no },
      { to_user: o.seller_id, icon: "↩️", title: "แอดมินอนุมัติการคืนสินค้า", body: `${o.item} — รอผู้ซื้อส่งของคืน`, ref: o.order_no },
    ]);
  } else {
    if (!String(reason || "").trim())
      return NextResponse.json({ error: "ต้องระบุเหตุผลการปฏิเสธ" }, { status: 400 });
    const { error } = await admin.from("orders").update({ status: "delivered", return_reject_reason: reason.trim() }).eq("id", o.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "❌", title: "คำขอคืนสินค้าไม่ได้รับอนุมัติ", body: `${o.item} — เหตุผล: ${reason.trim()}`, ref: o.order_no },
      { to_user: o.seller_id, icon: "⚖️", title: "แอดมินยกคำขอคืนของผู้ซื้อ", body: `${o.item} — ออเดอร์เดินต่อตามปกติ (เหตุผล: ${reason.trim()})`, ref: o.order_no },
    ]);
  }
  return NextResponse.json({ ok: true });
}

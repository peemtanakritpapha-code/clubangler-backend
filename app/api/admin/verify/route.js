// app/api/admin/verify/route.js — แอดมินตรวจสลิป: อนุมัติ → เงินเข้า escrow / ปฏิเสธ → เหตุผลถึงผู้ซื้อ
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

  const { orderId, approve, reason } = await req.json();
  const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.status !== "pending_verification")
    return NextResponse.json({ error: "ออเดอร์ไม่อยู่ในคิวตรวจสลิป" }, { status: 400 });

  if (approve) {
    const { error } = await admin.from("orders").update({ status: "payment_verified", slip_reject_reason: null }).eq("id", o.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // ตัดสต็อก / ปิดเป็น sold เมื่อหมด
    if (o.product_id) {
      const { data: p } = await admin.from("products").select("stock").eq("id", o.product_id).single();
      if (p) {
        const left = Math.max(0, (p.stock || 1) - 1);
        await admin.from("products").update({ stock: left, ...(left === 0 ? { status: "sold" } : {}) }).eq("id", o.product_id);
      }
    }
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "🛡", title: "ยืนยันการชำระเงินแล้ว", body: `${o.item} — เงินเข้าระบบฝากปลอดภัย รอผู้ขายจัดส่ง`, ref: o.order_no },
      { to_user: o.seller_id, icon: "🛒", title: "มีออเดอร์ใหม่ · เงินเข้าระบบฝากแล้ว", body: `${o.item} — จัดส่งแล้วกรอกเลขพัสดุได้เลย`, ref: o.order_no },
    ]);
  } else {
    // กติกา: ปฏิเสธทุกชนิดบังคับเหตุผล + ผู้ใช้เห็นเสมอ
    if (!String(reason || "").trim())
      return NextResponse.json({ error: "ต้องระบุเหตุผลการปฏิเสธ" }, { status: 400 });
    const { error } = await admin.from("orders").update({ status: "pending_payment", slip_reject_reason: reason.trim() }).eq("id", o.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({
      to_user: o.buyer_id, icon: "⚠️", title: "สลิปไม่ผ่านการตรวจสอบ",
      body: `${o.item} — เหตุผล: ${reason.trim()} · กรุณาแนบสลิปใหม่`, ref: o.order_no,
    });
  }
  return NextResponse.json({ ok: true });
}

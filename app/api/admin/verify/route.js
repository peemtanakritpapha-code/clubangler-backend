// app/api/admin/verify/route.js — แอดมินตรวจสลิป: อนุมัติ → เงินเข้า escrow / ปฏิเสธ → เหตุผลถึงผู้ซื้อ
// A3 ก้าว 5: รองรับกลุ่มชำระ (pay_group) — ตัดสินครั้งเดียวมีผลทุกออเดอร์ในกลุ่ม
// (ตรรกะยกจาก prototype approveAll/rejectAll บรรทัด 4911–4912)
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

// ตัดสต็อก / ปิดเป็น sold เมื่อหมด (เหมือนเดิม แยกเป็นฟังก์ชันเพราะใช้หลายออเดอร์)
async function consumeStock(admin, productId) {
  if (!productId) return;
  const { data: p } = await admin.from("products").select("stock").eq("id", productId).single();
  if (!p) return;
  const left = Math.max(0, (p.stock || 1) - 1);
  await admin.from("products").update({ stock: left, ...(left === 0 ? { status: "sold" } : {}) }).eq("id", productId);
}

export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { admin } = ctx;

  const { orderId, payGroup, approve, reason } = await req.json();

  // เป้าหมาย: ทั้งกลุ่ม หรือออเดอร์เดี่ยว — เฉพาะที่ยังอยู่คิวตรวจสลิป
  let targets = [];
  if (payGroup) {
    const { data } = await admin.from("orders").select("*").eq("pay_group", payGroup).eq("status", "pending_verification");
    targets = data || [];
  } else if (orderId) {
    const { data: o } = await admin.from("orders").select("*").eq("id", orderId).single();
    if (o && o.status === "pending_verification") targets = [o];
  }
  if (!targets.length)
    return NextResponse.json({ error: "ไม่พบออเดอร์ในคิวตรวจสลิป" }, { status: 400 });

  const ids = targets.map(o => o.id);
  const isGroup = targets.length > 1;
  const buyerId = targets[0].buyer_id;
  const refNo = payGroup || targets[0].order_no;

  if (approve) {
    // ST1: backstop สุดท้าย — เช็คสต็อกจริง ณ วินาที approve (กันขายซ้ำจากเคสชนกันระดับ ms)
    const pids = [...new Set(targets.map(o => o.product_id).filter(Boolean))];
    const { data: prods } = pids.length
      ? await admin.from("products").select("id, stock").in("id", pids)
      : { data: [] };
    const stockLeft = Object.fromEntries((prods || []).map(p => [String(p.id), Number(p.stock) || 0]));
    const blocked = [];
    targets = targets.filter(o => {
      if (!o.product_id) return true;
      const k = String(o.product_id);
      if (stockLeft[k] > 0) { stockLeft[k] -= 1; return true; }
      blocked.push(o.order_no);
      return false;
    });
    if (blocked.length && !targets.length)
      return NextResponse.json({ error: `สินค้าถูกขายไปแล้ว (${blocked.join(", ")}) — ห้ามอนุมัติ ใช้ปุ่มปฏิเสธพร้อมเหตุผล แล้วนัดโอนเงินคืนผู้ซื้อ` }, { status: 409 });
    if (blocked.length)
      return NextResponse.json({ error: `บางชิ้นถูกขายไปแล้ว (${blocked.join(", ")}) — ต้องแยกจัดการทีละใบ: ปฏิเสธใบที่ของหมดก่อน แล้วค่อยอนุมัติใบที่เหลือ` }, { status: 409 });

    const { error } = await admin.from("orders")
      .update({ status: "payment_verified", slip_reject_reason: null }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const o of targets) await consumeStock(admin, o.product_id);

    // ผู้ซื้อ: แจ้งครั้งเดียวครอบทั้งกลุ่ม / ผู้ขาย: แจ้งรายออเดอร์ (คนละร้านกันได้)
    await admin.from("notifications").insert([
      {
        to_user: buyerId, icon: "🛡", title: "ยืนยันการชำระเงินแล้ว",
        body: isGroup
          ? `ชำระรวม ${targets.length} รายการผ่านการตรวจแล้ว — เงินเข้าระบบฝากปลอดภัย รอผู้ขายจัดส่ง`
          : `${targets[0].item} — เงินเข้าระบบฝากปลอดภัย รอผู้ขายจัดส่ง`,
        ref: refNo,
      },
      ...targets.map(o => ({
        to_user: o.seller_id, icon: "🛒", title: "มีออเดอร์ใหม่ · เงินเข้าระบบฝากแล้ว",
        body: `${o.item} — จัดส่งแล้วกรอกเลขพัสดุได้เลย`, ref: o.order_no,
      })),
    ]);
  } else {
    // กติกา: ปฏิเสธทุกชนิดบังคับเหตุผล + ผู้ใช้เห็นเสมอ
    if (!String(reason || "").trim())
      return NextResponse.json({ error: "ต้องระบุเหตุผลการปฏิเสธ" }, { status: 400 });
    const { error } = await admin.from("orders")
      .update({ status: "pending_payment", slip_reject_reason: reason.trim() }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("notifications").insert({
      to_user: buyerId, icon: "⚠️", title: "สลิปไม่ผ่านการตรวจสอบ",
      body: `${isGroup ? `กลุ่มชำระ ${targets.length} รายการ` : targets[0].item} — เหตุผล: ${reason.trim()} · กรุณาแนบสลิปใหม่`,
      ref: refNo,
    });
  }
  return NextResponse.json({ ok: true });
}

// app/api/orders/route.js — สร้างออเดอร์ (สถานะแรก: pending_payment)
// A3: รองรับซื้อหลายชิ้นจ่ายครั้งเดียว — แตกออเดอร์ "ต่อชิ้น" (escrow รายชิ้น)
// ตรรกะมัดกลุ่มยกจาก prototype createOrdersFromCheckout (บรรทัด 4121–4136):
//   >1 ชิ้น → ทุกออเดอร์ได้ pay_group เดียวกัน + group_total = ยอดรวมทั้งกลุ่ม (ให้แอดมินเทียบสลิปใบเดียว)
//   1 ชิ้น  → ไม่มี pay_group/group_total (เหมือนเดิมทุกประการ)
// ยังรับ body แบบเก่า { productId, shipTo } ได้ (ปุ่ม "ซื้อเลย")
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { feeFor } from "@/lib/fees";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const { shipTo } = body || {};
  // รับได้ทั้ง items: [id, ...] (ตะกร้า) และ productId เดี่ยว (ซื้อเลย)
  const ids = Array.isArray(body?.items) && body.items.length
    ? [...new Set(body.items.map(String))]
    : (body?.productId ? [String(body.productId)] : []);

  const REQ = ["name", "phone", "addr", "sub", "district", "province", "zip"];
  if (!ids.length || !shipTo || REQ.some(k => !String(shipTo[k] || "").trim()) || !/^[0-9]{5}$/.test(shipTo.zip))
    return NextResponse.json({ error: "ข้อมูลสินค้า/ที่อยู่ไม่ครบถ้วน" }, { status: 400 });
  if (ids.length > 20)
    return NextResponse.json({ error: "สั่งซื้อได้สูงสุด 20 ชิ้นต่อครั้ง" }, { status: 400 });

  const admin = createAdminClient();
  const { data: rows } = await admin.from("products").select("*").in("id", ids);
  const byId = Object.fromEntries((rows || []).map(r => [String(r.id), r]));

  // ตรวจทุกชิ้นก่อน — ชิ้นไหนไม่ผ่าน แจ้งชื่อชัดๆ แล้วไม่สร้างสักออเดอร์ (all-or-nothing)
  for (const id of ids) {
    const p = byId[id];
    if (!p || p.status !== "active" || p.stock < 1)
      return NextResponse.json({ error: `สินค้า "${p?.name || id}" ไม่พร้อมขายแล้ว — เอาออกจากตะกร้าแล้วลองใหม่` }, { status: 400 });
    if (p.seller_id === user.id)
      return NextResponse.json({ error: `ซื้อสินค้าของตัวเองไม่ได้ ("${p.name}")` }, { status: 400 });
  }

  const { data: tiers } = await admin.from("fee_tiers").select("*");

  // คำนวณต่อชิ้นผ่าน feeFor เท่านั้น (กติกาเหล็กข้อ 1) แล้วค่อยรวมเป็นยอดกลุ่ม
  const lines = ids.map(id => {
    const p = byId[id];
    const price = Number(p.price);
    const buyerFee = feeFor(price, tiers, "buyer");
    const sellerFee = feeFor(price, tiers, "seller");
    const shipFee = p.shipping?.mode === "paid" ? Number(p.shipping.fee) || 0 : 0;
    return { p, price, buyerFee, sellerFee, shipFee, payable: price + buyerFee + shipFee };
  });
  const groupTotal = lines.reduce((s, l) => s + l.payable, 0);
  const multi = lines.length > 1;

  const base = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const payGroup = multi ? "PAY-" + base : null;

  const inserts = lines.map((l, i) => ({
    order_no: "ORD-" + base + (i ? "-" + (i + 1) : ""),
    buyer_id: user.id,
    seller_id: l.p.seller_id,
    product_id: l.p.id,
    item: l.p.name,
    price: l.price,
    buyer_fee: l.buyerFee,
    seller_fee: l.sellerFee,
    ship_fee: l.shipFee,
    ship_to: shipTo,
    status: "pending_payment",
    pay_group: payGroup,
    group_total: multi ? groupTotal : null,
  }));

  const { data: orders, error } = await admin.from("orders").insert(inserts).select("id, order_no");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    orderId: orders[0].id,            // ใช้พาไปหน้าจ่าย (back-compat กับโค้ดเดิม)
    orderNo: orders[0].order_no,
    orderIds: orders.map(o => o.id),
    payGroup,
    groupTotal,
  });
}

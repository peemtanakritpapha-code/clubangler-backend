// app/api/orders/route.js — สร้างออเดอร์ (สถานะแรก: pending_payment)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { feeFor } from "@/lib/fees";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const { productId, shipTo } = body || {};
  const REQ = ["name", "phone", "addr", "sub", "district", "province", "zip"];
  if (!productId || !shipTo || REQ.some(k => !String(shipTo[k] || "").trim()) || !/^[0-9]{5}$/.test(shipTo.zip))
    return NextResponse.json({ error: "ข้อมูลที่อยู่ไม่ครบถ้วน" }, { status: 400 });

  const admin = createAdminClient();
  const { data: p } = await admin.from("products").select("*").eq("id", productId).single();
  if (!p || p.status !== "active" || p.stock < 1)
    return NextResponse.json({ error: "สินค้านี้ไม่พร้อมขายแล้ว" }, { status: 400 });
  if (p.seller_id === user.id)
    return NextResponse.json({ error: "ซื้อสินค้าของตัวเองไม่ได้" }, { status: 400 });

  const { data: tiers } = await admin.from("fee_tiers").select("*");
  const price = Number(p.price);
  const buyerFee = feeFor(price, tiers, "buyer");
  const sellerFee = feeFor(price, tiers, "seller");
  const shipFee = p.shipping?.mode === "paid" ? Number(p.shipping.fee) || 0 : 0;
  const orderNo = "ORD-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

  const { data: order, error } = await admin.from("orders").insert({
    order_no: orderNo,
    buyer_id: user.id,
    seller_id: p.seller_id,
    product_id: p.id,
    item: p.name,
    price,
    buyer_fee: buyerFee,
    seller_fee: sellerFee,
    ship_fee: shipFee,
    ship_to: shipTo,
    status: "pending_payment",
  }).select("id, order_no").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, orderId: order.id, orderNo: order.order_no });
}

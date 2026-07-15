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

  // POST3.3: คนโดนแบนสั่งซื้อไม่ได้ (ออเดอร์เดิมยังดู/ดำเนินต่อได้ตามสเปคแบน)
  const banAdmin = createAdminClient();
  const { data: banChk } = await banAdmin.from("profiles").select("banned_at").eq("id", user.id).single();
  if (banChk?.banned_at)
    return NextResponse.json({ error: "บัญชีของคุณถูกระงับ ไม่สามารถสั่งซื้อได้ชั่วคราว" }, { status: 403 });

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

  // ── ST1: ด่านนับสิทธิ์มีชีวิต — กันซื้อทับซ้อน ──
  // สิทธิ์มีชีวิต = pending_verification ทุกใบ + pending_payment ที่ยังไม่หมดเวลา (นับสด ไม่รอ cron)
  const { data: cfgRows } = await admin.from("platform_config").select("pay_within_minutes, ship_within_days").limit(1);
  const PAY_MIN = Number(cfgRows?.[0]?.pay_within_minutes) || 60;
  const SHIP_X = Number(cfgRows?.[0]?.ship_within_days) || 3; // PRE-1: ฐานวันส่ง ณ ตอนสร้างออเดอร์ (ตรง fallback ใน cron)
  const freshCut = new Date(Date.now() - PAY_MIN * 60000).toISOString();
  const { data: liveRows } = await admin.from("orders")
    .select("product_id, buyer_id, status, created_at")
    .in("product_id", ids).in("status", ["pending_payment", "pending_verification"]);
  const live = (liveRows || []).filter(r => r.status === "pending_verification" || r.created_at >= freshCut);
  for (const id of ids) {
    const p = byId[id];
    const claims = live.filter(r => String(r.product_id) === String(id));
    const mine = claims.find(r => r.buyer_id === user.id);
    if (mine)
      return NextResponse.json({ error: `คุณมีคำสั่งซื้อ "${p.name}" รอชำระอยู่แล้ว — ไปที่ "การซื้อของฉัน" เพื่อชำระเงินใบเดิม` }, { status: 400 });
    if (claims.length >= (Number.isFinite(Number(p.stock)) ? Number(p.stock) : 1)) // สต๊อค 0 นับเป็น 0 จริง
      return NextResponse.json({ error: `มีผู้อื่นกำลังทำรายการ "${p.name}" อยู่ — หากไม่ชำระภายใน ${PAY_MIN} นาที สินค้าจะว่างอีกครั้ง` }, { status: 409 });
  }

  const { data: tiers } = await admin.from("fee_tiers").select("*");

  // คำนวณต่อชิ้นผ่าน feeFor เท่านั้น (กติกาเหล็กข้อ 1) แล้วค่อยรวมเป็นยอดกลุ่ม
  const lines = ids.map(id => {
    const p = byId[id];
    const price = Number(p.price);
    const shipFee = p.shipping?.mode === "paid" ? Number(p.shipping.fee) || 0 : 0;
    const buyerFee = feeFor(price, tiers, "buyer");
    // S4 (แบบ B): ค่าธรรมเนียมผู้ขายคิดจากฐาน ราคา + ค่าส่งที่ผู้ซื้อจ่าย — ให้ตรงกับกล่องหน้าลงขาย
    // (ผู้ขายได้รับ = price + shipFee − sellerFee ซึ่งคิวโอนเงินแอดมินใช้สูตรนี้อยู่แล้ว)
    const sellerFee = feeFor(price + shipFee, tiers, "seller");
    // PRE-1: snapshot วันส่งรายใบ = ฐาน config ณ ตอนนี้ + วันพรีของสินค้า (ห้าม || — 0/null = ไม่ใช่พรี)
    const preDays = Number.isFinite(Number(p.preorder_days)) && Number(p.preorder_days) > 0 ? Math.round(Number(p.preorder_days)) : 0;
    return { p, price, buyerFee, sellerFee, shipFee, payable: price + buyerFee + shipFee, shipDays: preDays > 0 ? preDays : SHIP_X }; // PRE-1fix: เลขที่ผู้ขายเลือก = เดดไลน์ทั้งก้อน (ป้ายผู้ซื้อ 7 วัน = บังคับ 7 วันจริง)
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
    ship_days: l.shipDays, // PRE-1: เดดไลน์ส่งของใบนี้ตรึงตายตัว — ผู้ขายแก้สินค้าทีหลังไม่มีผลย้อนหลัง
    product_snapshot: { // DISPUTE-2a: สำเนาประกาศขาย ณ วินาทีสั่งซื้อ — ผู้ขายแก้ไขทีหลังไม่มีผลย้อนหลัง (ไม่ต้องก็อปไฟล์รูป เพราะ path อัปโหลดไม่ซ้ำกันตลอดไป)
      name: l.p.name, description: l.p.description, price: l.p.price,
      brand: l.p.brand, cond: l.p.cond, cond_label: l.p.cond_label, cond_note: l.p.cond_note,
      issues: l.p.issues, cat_main: l.p.cat_main, cat_sub: l.p.cat_sub, images: l.p.images,
    },
  }));

  const { data: orders, error } = await admin.from("orders").insert(inserts).select("id, order_no");
  if (error) {
    if (String(error.code) === "23505")
      return NextResponse.json({ error: "คำสั่งซื้อนี้ถูกสร้างไปแล้ว — เช็คที่ \"การซื้อของฉัน\"" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("consent_logs").insert({ user_id: user.id, point: "order_terms", order_id: String(orders[0].id) }); // CONSENT-1: จุดที่ 2 — UI บังคับผ่าน popup ยอมรับก่อนถึงจุดนี้เสมอ

  return NextResponse.json({
    ok: true,
    orderId: orders[0].id,            // ใช้พาไปหน้าจ่าย (back-compat กับโค้ดเดิม)
    orderNo: orders[0].order_no,
    orderIds: orders.map(o => o.id),
    payGroup,
    groupTotal,
  });
}

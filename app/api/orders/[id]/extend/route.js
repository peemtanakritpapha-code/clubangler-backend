// app/api/orders/[id]/extend/route.js — ขยายเวลารับของ (ผู้ซื้อขอ 1 ครั้ง · ผู้ขายต้องยืนยัน)
// action: "request" (ผู้ซื้อ, สถานะ shipped, ยังไม่เคยขอ) / "approve" | "reject" (ผู้ขาย, คำขอค้างอยู่)
// จำนวนวันแช่แข็งจากตั้งค่าระบบ ณ ตอนขอ — ระหว่างคำขอค้าง cron จะพักการยืนยันแทนไว้
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { action, kind = "receive", reason } = await req.json(); // kind: "receive" (ผู้ซื้อขอขยายรับของ) | "ship" (ผู้ขายขอขยายจัดส่ง) — reason: EXTEND-REASON
  const admin = createAdminClient();
  const { data: o } = await admin.from("orders")
    .select("id, order_no, item, status, buyer_id, seller_id, extend_status, extend_days, ship_extend_status, ship_extend_days")
    .eq("id", id).single();
  if (!o) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  /* ── ขยายเวลาจัดส่ง: ผู้ขายขอ (payment_verified) → ผู้ซื้อยืนยัน ── */
  if (kind === "ship") {
    if (action === "request") {
      if (user.id !== o.seller_id) return NextResponse.json({ error: "เฉพาะผู้ขายของออเดอร์นี้" }, { status: 403 });
      if (o.status !== "payment_verified") return NextResponse.json({ error: "ขอขยายได้เฉพาะช่วงรอจัดส่ง" }, { status: 400 });
      if (o.ship_extend_status) return NextResponse.json({ error: "ออเดอร์นี้ขอขยายเวลาจัดส่งไปแล้ว (ขอได้ 1 ครั้ง)" }, { status: 400 });
      const { data: cfgRows } = await admin.from("platform_config").select("*").limit(1);
      const days = Number(cfgRows?.[0]?.ship_extend_days) || 2;
      const { error } = await admin.from("orders").update({ ship_extend_status: "pending", ship_extend_days: days })
        .eq("id", o.id).eq("status", "payment_verified").is("ship_extend_status", null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from("notifications").insert({
        to_user: o.buyer_id, icon: "⏳", title: "ผู้ขายขอขยายเวลาจัดส่ง",
        body: `${o.item} — ขอเพิ่ม ${days} วัน กดยืนยัน/ปฏิเสธในหน้าออเดอร์`, ref: o.order_no,
      });
      return NextResponse.json({ ok: true, days });
    }
    if (action === "approve" || action === "reject") {
      if (user.id !== o.buyer_id) return NextResponse.json({ error: "เฉพาะผู้ซื้อของออเดอร์นี้" }, { status: 403 });
      if (o.ship_extend_status !== "pending") return NextResponse.json({ error: "ไม่มีคำขอค้างอยู่" }, { status: 400 });
      const ok = action === "approve";
      const { error } = await admin.from("orders").update({ ship_extend_status: ok ? "approved" : "rejected" })
        .eq("id", o.id).eq("ship_extend_status", "pending");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await admin.from("notifications").insert({
        to_user: o.seller_id, icon: ok ? "✅" : "❌",
        title: ok ? `ผู้ซื้ออนุมัติขยายเวลาจัดส่ง +${o.ship_extend_days} วัน` : "ผู้ซื้อไม่อนุมัติการขยายเวลาจัดส่ง",
        body: `${o.item} — ${ok ? "กำหนดจัดส่งถูกเลื่อนออกไปแล้ว" : "กำหนดเดิมยังมีผล กรุณาจัดส่งตามกำหนดเพื่อไม่ให้ออเดอร์ถูกยกเลิก"}`, ref: o.order_no,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  }

  if (action === "request") {
    if (user.id !== o.buyer_id) return NextResponse.json({ error: "เฉพาะผู้ซื้อของออเดอร์นี้" }, { status: 403 });
    if (o.status !== "shipped") return NextResponse.json({ error: "ขอขยายได้เฉพาะช่วงรอยืนยันรับของ" }, { status: 400 });
    if (o.extend_status) return NextResponse.json({ error: "ออเดอร์นี้ขอขยายเวลาไปแล้ว (ขอได้ 1 ครั้ง)" }, { status: 400 });
    const { data: cfgRows } = await admin.from("platform_config").select("*").limit(1);
    const days = Number(cfgRows?.[0]?.extend_receive_days) || 3;
    const cleanReason = String(reason || "").trim().slice(0, 100) || null; // EXTEND-REASON
    const { error } = await admin.from("orders").update({ extend_status: "pending", extend_days: days, extend_reason: cleanReason })
      .eq("id", o.id).eq("status", "shipped").is("extend_status", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({
      to_user: o.seller_id, icon: "⏳", title: "ผู้ซื้อขอขยายเวลารับของ",
      body: `${o.item} — ขอเพิ่ม ${days} วัน${cleanReason ? ` (${cleanReason})` : ""} กดยืนยัน/ปฏิเสธในหน้าออเดอร์ (ระหว่างรอ เงินจะยังไม่ถูกปล่อยอัตโนมัติ)`, ref: o.order_no, // EXTEND-REASON
    });
    return NextResponse.json({ ok: true, days });
  }

  if (action === "approve" || action === "reject") {
    if (user.id !== o.seller_id) return NextResponse.json({ error: "เฉพาะผู้ขายของออเดอร์นี้" }, { status: 403 });
    if (o.extend_status !== "pending") return NextResponse.json({ error: "ไม่มีคำขอค้างอยู่" }, { status: 400 });
    const approve = action === "approve";
    const { error } = await admin.from("orders").update({ extend_status: approve ? "approved" : "rejected" })
      .eq("id", o.id).eq("extend_status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({
      to_user: o.buyer_id, icon: approve ? "✅" : "❌",
      title: approve ? `ผู้ขายอนุมัติขยายเวลา +${o.extend_days} วัน` : "ผู้ขายไม่อนุมัติการขยายเวลา",
      body: `${o.item} — ${approve ? "กำหนดยืนยันรับของถูกเลื่อนออกไปแล้ว" : "กำหนดเดิมยังมีผล กรุณายืนยันรับของตามกำหนด"}`, ref: o.order_no,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

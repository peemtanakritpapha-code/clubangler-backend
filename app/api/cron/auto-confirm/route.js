// app/api/cron/auto-confirm/route.js — งานอัตโนมัติของระบบ escrow (เรียกโดย crontab ทุก 30 นาที)
// กติกา (วันทั้งหมดตั้งได้ในแอดมิน → ตั้งค่าระบบ):
//  A. ผู้ซื้อไม่กดยืนยันรับสินค้า ครบ N วันหลังจัดส่ง (+วันขยายที่ผู้ขายอนุมัติ) → ระบบยืนยันแทน (→ delivered)
//     - มีคำขอขยายเวลาค้างรอผู้ขายตอบ → พักการยืนยันแทนไว้ก่อน (ผู้ขายยิ่งช้าเงินยิ่งออกช้า — แรงจูงใจให้รีบตอบ)
//  B. ผู้ขายไม่ยืนยันรับของคืน ครบ M วันหลังผู้ซื้อส่งคืน → ระบบยืนยันแทน (→ return_received เข้าคิวคืนเงิน)
//  C. ผู้ซื้อไม่ส่งของคืน ครบ Y วันหลังอนุมัติการคืน → ปิดเคสคืนอัตโนมัติ (→ delivered พร้อมเหตุผล)
//  D. ผู้ขายไม่จัดส่ง ครบ X วัน (+ขยายที่ผู้ซื้ออนุมัติ) → ยกเลิก + คืนสต็อก + เข้าคิวคืนเงิน
//  + ประทับเวลา self-healing: ออเดอร์ที่ไม่มี timestamp จะถูกประทับรอบแรกที่ cron เห็น แล้วเริ่มนับจากนั้น
// ความปลอดภัย: ต้องแนบ x-cron-key (หรือ ?key=) ตรงกับ CRON_SECRET เท่านั้น
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

export const dynamic = "force-dynamic";

const daysMs = n => n * 24 * 60 * 60 * 1000;

// คืนสต็อกเมื่อออเดอร์ถูกยกเลิก — ฝั่งตรงข้ามของ consumeStock ใน verify/route.js
// เปิดสินค้ากลับเป็น active เฉพาะตัวที่เป็น "sold" เท่านั้น (ไม่ปลดสินค้าที่ถูกแอดมินระงับ)
async function restoreStock(admin, productId) {
  if (!productId) return;
  const { data: p } = await admin.from("products").select("stock, status").eq("id", productId).single();
  if (!p) return;
  const next = (Number(p.stock) || 0) + 1;
  await admin.from("products").update({ stock: next, ...(p.status === "sold" ? { status: "active" } : {}) }).eq("id", productId);
}

async function run(req) {
  const key = req.headers.get("x-cron-key") || new URL(req.url).searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: cfgRows } = await admin.from("platform_config").select("*").limit(1);
  const cfg = cfgRows?.[0] || {};
  const N = Number(cfg.auto_confirm_days) || 3;          // ยืนยันรับของแทนผู้ซื้อ
  const M = Number(cfg.return_auto_confirm_days) || 10;  // ยืนยันรับของคืนแทนผู้ขาย
  const Y = Number(cfg.return_ship_within_days) || 5;    // ผู้ซื้อต้องส่งคืนภายใน
  const X = Number(cfg.ship_within_days) || 3;           // ผู้ขายต้องจัดส่งภายใน (เกิน = ยกเลิก+คืนเงิน)
  const Z = Number(cfg.pay_within_minutes) || 60;        // ผู้ซื้อต้องชำระภายใน (นาที)
  const zText = Z % 60 === 0 ? `${Z / 60} ชม.` : `${Z} นาที`;          // ผู้ซื้อต้องชำระภายใน (ชม.) — เกิน = expired

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const result = { stamped: 0, buyer_confirmed: [], seller_received: [], return_expired: [], cancelled: [], expired: [] };

  /* ── 0) ประทับเวลา self-healing ── */
  for (const [status, col] of [["shipped", "shipped_at"], ["return_shipped", "return_shipped_at"],
    ["payment_verified", "payment_verified_at"], ["return_approved", "return_approved_at"]]) {
    const { data: rows } = await admin.from("orders").select("id").eq("status", status).is(col, null).limit(500);
    if (rows?.length) {
      await admin.from("orders").update({ [col]: nowIso }).in("id", rows.map(x => x.id));
      result.stamped += rows.length;
    }
  }

  /* ── A) ครบกำหนด → ยืนยันรับแทนผู้ซื้อ (เคารพการขยายเวลา) ── */
  const { data: candA } = await admin.from("orders")
    .select("id, order_no, item, buyer_id, seller_id, shipped_at, extend_status, extend_days")
    .eq("status", "shipped").not("shipped_at", "is", null)
    .lt("shipped_at", new Date(now - daysMs(N)).toISOString()).limit(200);
  for (const o of candA || []) {
    if (o.extend_status === "pending") continue; // รอผู้ขายตอบคำขอขยาย — พักไว้
    const extra = o.extend_status === "approved" ? (Number(o.extend_days) || 0) : 0;
    if (new Date(o.shipped_at).getTime() > now - daysMs(N + extra)) continue; // ยังอยู่ในช่วงขยาย
    const { error } = await admin.from("orders")
      .update({ status: "delivered", delivered_at: nowIso, auto_delivered: true })
      .eq("id", o.id).eq("status", "shipped"); // กันชนกับผู้ซื้อที่เพิ่งกดเอง
    if (error) continue;
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "⏰", title: "ระบบยืนยันรับสินค้าแทนคุณ", body: `${o.item} — ครบ ${N + extra} วันหลังจัดส่งโดยไม่มีการแจ้งปัญหา เงินจะถูกโอนให้ผู้ขาย`, ref: o.order_no },
      { to_user: o.seller_id, icon: "✅", title: "ออเดอร์ถูกยืนยันอัตโนมัติ", body: `${o.item} — ครบกำหนด ระบบยืนยันรับแทนผู้ซื้อ เงินเข้าคิวโอนให้คุณแล้ว`, ref: o.order_no },
    ]);
    result.buyer_confirmed.push(o.order_no);
  }

  /* ── B) ครบ M วันหลังส่งคืน → ยืนยันรับของคืนแทนผู้ขาย ── */
  const { data: candB } = await admin.from("orders")
    .select("id, order_no, item, buyer_id, seller_id")
    .eq("status", "return_shipped").not("return_shipped_at", "is", null)
    .lt("return_shipped_at", new Date(now - daysMs(M)).toISOString()).limit(200);
  for (const o of candB || []) {
    const { error } = await admin.from("orders")
      .update({ status: "return_received", auto_confirmed: true })
      .eq("id", o.id).eq("status", "return_shipped");
    if (error) continue;
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "⏰", title: "ระบบยืนยันรับของคืนแทนผู้ขาย", body: `${o.item} — ครบ ${M} วัน เคสเข้าคิวคืนเงินแล้ว`, ref: o.order_no },
      { to_user: o.seller_id, icon: "📥", title: "ระบบยืนยันรับของคืนแทนคุณ", body: `${o.item} — ครบกำหนด ${M} วันหลังผู้ซื้อส่งคืน ระบบดำเนินการต่ออัตโนมัติ`, ref: o.order_no },
    ]);
    result.seller_received.push(o.order_no);
  }

  /* ── C) อนุมัติคืนแล้วแต่ผู้ซื้อไม่ส่งของ ครบ Y วัน → ปิดเคสคืน ออเดอร์เดินต่อ ── */
  const { data: candC } = await admin.from("orders")
    .select("id, order_no, item, buyer_id, seller_id")
    .eq("status", "return_approved").not("return_approved_at", "is", null)
    .lt("return_approved_at", new Date(now - daysMs(Y)).toISOString()).limit(200);
  for (const o of candC || []) {
    const { error } = await admin.from("orders")
      .update({ status: "delivered", return_reject_reason: `ไม่ได้ส่งของคืนภายใน ${Y} วันหลังอนุมัติ — ระบบปิดเคสคืนอัตโนมัติ` })
      .eq("id", o.id).eq("status", "return_approved");
    if (error) continue;
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "⌛", title: "เคสคืนสินค้าถูกปิด (เลยกำหนดส่งคืน)", body: `${o.item} — ไม่มีการส่งคืนภายใน ${Y} วัน ออเดอร์เดินต่อตามปกติ`, ref: o.order_no },
      { to_user: o.seller_id, icon: "ℹ️", title: "เคสคืนถูกปิดอัตโนมัติ", body: `${o.item} — ผู้ซื้อไม่ส่งของคืนภายใน ${Y} วัน ออเดอร์กลับมาเดินต่อ`, ref: o.order_no },
    ]);
    result.return_expired.push(o.order_no);
  }

  /* ── D) ผู้ขายไม่จัดส่ง ครบ X วัน (+ขยายที่ผู้ซื้ออนุมัติ) → ยกเลิก + คืนสต็อก + เข้าคิวคืนเงิน ── */
  const { data: candD } = await admin.from("orders")
    .select("id, order_no, item, buyer_id, seller_id, product_id, payment_verified_at, ship_extend_status, ship_extend_days")
    .eq("status", "payment_verified").not("payment_verified_at", "is", null)
    .lt("payment_verified_at", new Date(now - daysMs(X)).toISOString()).limit(200);
  for (const o of candD || []) {
    if (o.ship_extend_status === "pending") continue; // รอผู้ซื้อตอบคำขอขยายจัดส่ง — พักไว้
    const extra = o.ship_extend_status === "approved" ? (Number(o.ship_extend_days) || 0) : 0;
    if (new Date(o.payment_verified_at).getTime() > now - daysMs(X + extra)) continue; // ยังอยู่ในช่วงขยาย
    const { error } = await admin.from("orders")
      .update({ status: "cancelled", cancelled_at: nowIso, cancel_reason: `ผู้ขายไม่จัดส่งภายใน ${X + extra} วัน — ระบบยกเลิกอัตโนมัติ` })
      .eq("id", o.id).eq("status", "payment_verified"); // กันชนกับผู้ขายที่เพิ่งกดแจ้งส่ง
    if (error) continue;
    await restoreStock(admin, o.product_id); // คืนสต็อก — สินค้ากลับมาขายได้ (ตรงข้าม consumeStock ตอน approve)
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "⛔", title: "ออเดอร์ถูกยกเลิก — ผู้ขายไม่จัดส่ง", body: `${o.item} — เกินกำหนด ${X + extra} วัน ทีมงานจะโอนเงินคืนเต็มจำนวนโดยเร็ว`, ref: o.order_no },
      { to_user: o.seller_id, icon: "⛔", title: "ออเดอร์ถูกยกเลิกอัตโนมัติ", body: `${o.item} — ไม่มีการแจ้งจัดส่งภายใน ${X + extra} วัน เงินจะถูกคืนให้ผู้ซื้อ`, ref: o.order_no },
    ]);
    result.cancelled.push(o.order_no);
  }

  /* ── E) ไม่ชำระเงิน ครบ Z ชม. → หมดอายุอัตโนมัติ (expired — ไม่แตะเส้นทางเงิน/สต็อก) ── */
  const { data: candE } = await admin.from("orders")
    .select("id, order_no, item, buyer_id, seller_id")
    .eq("status", "pending_payment").not("created_at", "is", null)
    .lt("created_at", new Date(now - Z * 60000).toISOString()).limit(200);
  for (const o of candE || []) {
    const { error } = await admin.from("orders")
      .update({ status: "expired", cancelled_at: nowIso, cancel_reason: `หมดเวลาชำระภายใน ${zText}` })
      .eq("id", o.id).eq("status", "pending_payment"); // กันชนกับผู้ซื้อที่เพิ่งแนบสลิป
    if (error) continue;
    await admin.from("notifications").insert([
      { to_user: o.buyer_id, icon: "⏳", title: "คำสั่งซื้อหมดอายุ", body: `${o.item} — ไม่มีการชำระภายใน ${zText} สั่งซื้อใหม่ได้ตลอดถ้าสินค้ายังอยู่`, ref: o.order_no },
      { to_user: o.seller_id, icon: "⏳", title: "ออเดอร์หมดอายุ — ผู้ซื้อไม่ชำระ", body: `${o.item} — สินค้ายังลงขายตามปกติ`, ref: o.order_no },
    ]);
    result.expired.push(o.order_no);
  }

  // AD5: สรุปแจ้งแอดมิน — เฉพาะรอบที่มีงานเกิด
  if (result.buyer_confirmed.length)
    await notifyAdmins(admin, { icon: "💸", title: `คิวโอนเงินเพิ่ม ${result.buyer_confirmed.length} ใบ (ระบบยืนยันแทน)`, body: result.buyer_confirmed.join(", "), link: "/admin?tab=payout" });
  if (result.seller_received.length)
    await notifyAdmins(admin, { icon: "↩️", title: `คิวคืนเงินเพิ่ม ${result.seller_received.length} เคส (ยืนยันรับคืนแทน)`, body: result.seller_received.join(", "), link: "/admin?tab=payout" });
  if (result.cancelled.length)
    await notifyAdmins(admin, { icon: "⛔", title: `ยกเลิกไม่จัดส่ง ${result.cancelled.length} ใบ — เข้าคิวคืนเงิน`, body: result.cancelled.join(", "), link: "/admin?tab=payout" });

  return NextResponse.json({ ok: true, N, M, Y, X, Z, ...result });
}

export async function POST(req) { return run(req); }
export async function GET(req) { return run(req); }

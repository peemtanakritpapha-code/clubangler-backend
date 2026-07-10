// app/api/products/holds/route.js — ST1 ชิ้น 6a: ถามว่าสินค้าชิ้นไหน "มีคนกำลังซื้อ" อยู่
// สูตรสิทธิ์มีชีวิตชุดเดียวกับด่านสร้างออเดอร์ (api/orders): pending_verification ทุกใบ
//   + pending_payment ที่ยังไม่เกินเวลาชำระ — ป้ายเป็นแค่กระจกของด่าน ไม่มีตรรกะของตัวเอง
// เปิด public ได้: ตอบแค่ ถูกจองไหม + สิทธิ์หมดกี่โมง ไม่มีข้อมูลส่วนบุคคล
// GET /api/products/holds?ids=1,2,3  →  { holds: { "1": { until: ISO|null } } }
//   until = เวลาที่สิทธิ์เก่าสุดจะหมด (null = ถูกถือด้วยสลิปรอตรวจ — ไม่มีกำหนดชัด ให้ซ่อนบรรทัดเวลา)
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const raw = new URL(req.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))].slice(0, 60);
  if (!ids.length) return NextResponse.json({ holds: {} });

  const admin = createAdminClient();
  const [{ data: cfgRows }, { data: prods }, { data: liveRows }] = await Promise.all([
    admin.from("platform_config").select("pay_within_minutes").limit(1),
    admin.from("products").select("id, stock").in("id", ids),
    admin.from("orders").select("product_id, status, created_at")
      .in("product_id", ids).in("status", ["pending_payment", "pending_verification"]),
  ]);

  const PAY_MIN = Number(cfgRows?.[0]?.pay_within_minutes) || 60;
  const cutoff = Date.now() - PAY_MIN * 60000;
  const stockOf = Object.fromEntries((prods || []).map(p => [String(p.id), Number.isFinite(Number(p.stock)) ? Number(p.stock) : 1])); // สต๊อค 0 ต้องนับเป็น 0 (|| จะเหมาเป็น 1)

  const holds = {};
  for (const id of ids) {
    const claims = (liveRows || []).filter(r =>
      String(r.product_id) === String(id) &&
      (r.status === "pending_verification" || new Date(r.created_at).getTime() >= cutoff)
    );
    if (claims.length < (stockOf[id] ?? 1)) continue; // ยังมีของว่าง — ไม่ติดป้าย

    // เวลาที่ป้ายจะปลด = สิทธิ์แบบจับเวลา (pending_payment) ตัวเก่าสุดหมดอายุ
    const timed = claims.filter(r => r.status === "pending_payment")
      .map(r => new Date(r.created_at).getTime() + PAY_MIN * 60000).sort((a, b) => a - b);
    holds[id] = { until: timed.length ? new Date(timed[0]).toISOString() : null };
  }
  return NextResponse.json({ holds });
}

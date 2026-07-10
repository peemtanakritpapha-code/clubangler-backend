// app/api/products/set-status/route.js — SELL-API: สลับสถานะ ขายแล้ว ↔ กำลังขาย (จากหน้าสินค้าที่ลงขาย)
// เดิม MyProductsClient update ตรงจาก client — ย้ายมานี่เพื่อ:
//   1) กันคนโดนแบน  2) จำกัดการสลับให้เหลือแค่ active ↔ sold (ยิงเปลี่ยนเป็นสถานะอื่นไม่ได้)
//   3) สินค้าที่แอดมินระงับ (suspended) หรือรอตรวจ ห้ามผู้ขายสลับเอง
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("กรุณาเข้าสู่ระบบ", 401);

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles")
    .select("banned_at").eq("id", user.id).single();
  if (prof?.banned_at) return bad("บัญชีของคุณถูกระงับการใช้งาน", 403);

  const body = await req.json();
  const id = Number(body?.id);
  const status = body?.status;
  if (!id || !["active", "sold"].includes(status)) return bad("คำขอไม่ถูกต้อง");

  const { data: prod } = await admin.from("products")
    .select("id, seller_id, status, stock").eq("id", id).single();
  if (!prod || prod.seller_id !== user.id) return bad("ไม่พบสินค้า หรือไม่ใช่สินค้าของคุณ", 403);

  // สลับได้เฉพาะระหว่าง active ↔ sold — สถานะอื่น (suspended/review/pending) แตะไม่ได้
  if (!["active", "sold"].includes(prod.status))
    return bad("สินค้าสถานะนี้เปลี่ยนเองไม่ได้");

  // ST3: สต๊อค 0 ห้ามสลับกลับมาขาย — กันสินค้าโชว์ในตลาดทั้งที่ซื้อไม่ได้จริง
  //   (อยากขายต่อ = ตั้งใจเติมสต๊อคผ่านหน้าแก้ไขประกาศ ซึ่งสถานะจะถูกคิดใหม่ที่นั่น)
  if (status === "active" && (Number(prod.stock) || 0) < 1)
    return bad("สินค้าหมดสต๊อค — แก้ไขประกาศเพื่อเติมสต๊อคก่อน แล้วสินค้าจะกลับมาขายได้");

  const { error } = await admin.from("products")
    .update({ status }).eq("id", id).eq("seller_id", user.id);
  if (error) {
    console.error("products/set-status:", error);
    return bad("อัปเดตไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  return NextResponse.json({ ok: true, status });
}

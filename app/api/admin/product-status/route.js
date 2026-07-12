// app/api/admin/product-status/route.js — ระงับ/คืนสถานะสินค้า (ระงับบังคับเหตุผล ผู้ขายเห็น)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_BRANDS } from "@/lib/catalog"; // BRAND-ADM

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });

  const { productId, action, reason } = await req.json();   // action: suspend | restore
  const { data: p } = await admin.from("products").select("id, name, seller_id, status, stock, brand").eq("id", productId).single();
  if (!p) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });

  if (action === "suspend") {
    if (!String(reason || "").trim()) return NextResponse.json({ error: "ต้องระบุเหตุผลการระงับ" }, { status: 400 });
    await admin.from("products").update({ status: "suspended", suspend_reason: reason.trim() }).eq("id", p.id);
    await admin.from("notifications").insert({ to_user: p.seller_id, icon: "⛔", title: "สินค้าถูกระงับการขาย", body: `${p.name} — เหตุผล: ${reason.trim()}` });
  } else if (action === "restore") {
    // สต๊อค 0 = อนุมัติ/ปลดระงับได้ แต่ขึ้นเป็น "ขายแล้ว" ไม่ใช่ "ขายอยู่" (ของหมดห้ามกลับเข้าตลาด — เติมสต๊อคผ่านหน้าแก้ไขก่อน)
    const nextStatus = (Number(p.stock) || 0) > 0 ? "active" : "sold";
    await admin.from("products").update({ status: nextStatus, suspend_reason: null }).eq("id", p.id);
    // BRAND-ADM: แอดมินอนุมัติสินค้า = จดแบรนด์นอกลิสต์เข้า catalog_extras อัตโนมัติ — โพสต์ถัดไปไม่ติด review
    const bn = String(p.brand || "").trim();
    if (bn && !ALL_BRANDS.some(b => b.toLowerCase() === bn.toLowerCase())) {
      const { data: ex } = await admin.from("catalog_extras").select("id").eq("kind", "brand").ilike("name", bn).limit(1);
      if (!ex?.length) await admin.from("catalog_extras").insert({ kind: "brand", name: bn });
    }
    await admin.from("notifications").insert({
      to_user: p.seller_id, icon: "✅",
      title: nextStatus === "active" ? "สินค้ากลับมาขายได้แล้ว" : "สินค้าผ่านการตรวจ — แต่สต๊อคหมด",
      body: nextStatus === "active" ? p.name : `${p.name} — ขึ้นสถานะขายแล้ว เติมสต๊อคผ่านหน้าแก้ไขเพื่อกลับมาขาย`,
    });
  } else return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });

  return NextResponse.json({ ok: true });
}

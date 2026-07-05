// app/api/admin/product-status/route.js — ระงับ/คืนสถานะสินค้า (ระงับบังคับเหตุผล ผู้ขายเห็น)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });

  const { productId, action, reason } = await req.json();   // action: suspend | restore
  const { data: p } = await admin.from("products").select("id, name, seller_id, status").eq("id", productId).single();
  if (!p) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });

  if (action === "suspend") {
    if (!String(reason || "").trim()) return NextResponse.json({ error: "ต้องระบุเหตุผลการระงับ" }, { status: 400 });
    await admin.from("products").update({ status: "suspended", suspend_reason: reason.trim() }).eq("id", p.id);
    await admin.from("notifications").insert({ to_user: p.seller_id, icon: "⛔", title: "สินค้าถูกระงับการขาย", body: `${p.name} — เหตุผล: ${reason.trim()}` });
  } else if (action === "restore") {
    await admin.from("products").update({ status: "active", suspend_reason: null }).eq("id", p.id);
    await admin.from("notifications").insert({ to_user: p.seller_id, icon: "✅", title: "สินค้ากลับมาขายได้แล้ว", body: p.name });
  } else return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });

  return NextResponse.json({ ok: true });
}

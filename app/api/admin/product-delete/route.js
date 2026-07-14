// app/api/admin/product-delete/route.js — PRODDEL-1: ลบสินค้าถาวร (แอดมินเท่านั้น)
// กติกาความปลอดภัย (ลบแล้วกู้ไม่ได้ · Free plan ไม่มี backup):
//   1) ลบได้เฉพาะสินค้าที่ status = "suspended" — บังคับสองจังหวะ: ระงับก่อน แล้วค่อยลบ (กันมือลั่น)
//   2) มีออเดอร์ผูกอยู่ = ห้ามลบ (ประวัติการเงินต้องคงอยู่) — ให้เก็บเป็นระงับแทน
//   3) ลบรูปจริงออกจาก storage bucket "products" ด้วย
//   4) ต้องระบุเหตุผล — แจ้งเตือนผู้ขายพร้อมเหตุผล
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

  const { productId, reason } = await req.json();
  const why = String(reason || "").trim();
  if (!why) return NextResponse.json({ error: "ต้องระบุเหตุผลการลบถาวร" }, { status: 400 });

  const { data: p } = await admin.from("products").select("id, name, seller_id, status, images").eq("id", productId).single();
  if (!p) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
  if (p.status !== "suspended") {
    return NextResponse.json({ error: 'ลบถาวรได้เฉพาะสินค้าที่ "ระงับ" แล้วเท่านั้น — กดระงับก่อน' }, { status: 400 });
  }

  // มีออเดอร์ผูก (สถานะใดก็ตาม) = ห้ามลบ เก็บประวัติไว้
  const { data: ords } = await admin.from("orders").select("id").eq("product_id", p.id).limit(1);
  if (ords?.length) {
    return NextResponse.json({ error: "สินค้านี้มีประวัติออเดอร์ผูกอยู่ — ลบถาวรไม่ได้ ให้คงสถานะระงับไว้แทน" }, { status: 400 });
  }

  // ลบรูปจาก storage: แปลง public URL → path หลัง /object/public/products/
  const MARKER = "/object/public/products/";
  const paths = (Array.isArray(p.images) ? p.images : [])
    .map(u => { const i = String(u).indexOf(MARKER); return i >= 0 ? decodeURIComponent(String(u).slice(i + MARKER.length)) : null; })
    .filter(Boolean);
  if (paths.length) {
    const { error: se } = await admin.storage.from("products").remove(paths);
    if (se) console.error("product-delete storage:", se.message); // รูปลบไม่หมดไม่ถือว่า fail — เดินหน้าลบแถวต่อ
  }

  const { error: de } = await admin.from("products").delete().eq("id", p.id);
  if (de) return NextResponse.json({ error: "ลบไม่สำเร็จ: " + de.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: p.seller_id, icon: "🗑️",
    title: "สินค้าถูกลบถาวรโดยผู้ดูแลระบบ",
    body: `${p.name} — เหตุผล: ${why}`,
  });

  console.log(`[product-delete] admin=${user.id} product=${p.id} "${p.name}" imgs=${paths.length} reason="${why}"`);
  return NextResponse.json({ ok: true, deletedImages: paths.length });
}

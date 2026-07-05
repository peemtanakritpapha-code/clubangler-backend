// app/api/orders/[id]/return-ship/route.js — ผู้ซื้อส่งของคืน + เลขพัสดุ (บังคับ)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { carrier, trackingNo, proofPaths } = await req.json();
  if (!carrier || !String(trackingNo || "").trim())
    return NextResponse.json({ error: "กรอกขนส่งและเลขพัสดุคืนให้ครบ" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.status !== "return_approved")
    return NextResponse.json({ error: "ออเดอร์ยังไม่ได้รับอนุมัติให้คืน" }, { status: 400 });

  const { data: cfg } = await admin.from("platform_config").select("return_auto_confirm_days").single();
  const days = cfg?.return_auto_confirm_days ?? 10;
  const deadline = new Date(Date.now() + days * 86400000).toISOString();

  const { error } = await admin.from("orders").update({
    status: "return_shipped", return_carrier: carrier, return_tracking_no: String(trackingNo).trim(),
    return_proof_paths: Array.isArray(proofPaths) ? proofPaths.slice(0, 5) : [],
    return_shipped_at: new Date().toISOString(), return_deadline: deadline,
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.seller_id, icon: "↩️", title: "ผู้ซื้อส่งสินค้าคืนแล้ว",
    body: `${o.item} — ${carrier} ${trackingNo} · ยืนยันรับของภายใน ${days} วัน ไม่งั้นระบบยืนยันแทน`, ref: o.order_no,
  });
  return NextResponse.json({ ok: true });
}

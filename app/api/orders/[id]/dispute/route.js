// app/api/orders/[id]/dispute/route.js — ผู้ซื้อเปิดเคส: คืนของรับเงิน / พิพาทให้ไกล่เกลี่ย
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { reason, detail, requireReturn, evidencePaths } = await req.json();
  if (!reason) return NextResponse.json({ error: "เลือกเหตุผล" }, { status: 400 });
  if (!String(detail || "").trim()) return NextResponse.json({ error: "กรอกคำอธิบายปัญหา (บังคับ)" }, { status: 400 });
  if (!Array.isArray(evidencePaths) || evidencePaths.length < 1)
    return NextResponse.json({ error: "แนบรูปหลักฐานอย่างน้อย 1 รูป" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!["shipped", "delivered"].includes(o.status))
    return NextResponse.json({ error: "เปิดเคสได้เฉพาะออเดอร์ที่จัดส่งแล้ว" }, { status: 400 });

  const status = requireReturn ? "return_requested" : "disputed";
  const { error } = await admin.from("orders").update({
    status, dispute_reason: reason, dispute_detail: detail.trim(),
    require_return: !!requireReturn, evidence_paths: evidencePaths.slice(0, 5),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: o.seller_id, icon: "⚠️", title: requireReturn ? "ผู้ซื้อขอคืนสินค้า" : "ผู้ซื้อเปิดข้อพิพาท",
    body: `${o.item} — ${reason} · รอแอดมินพิจารณา`, ref: o.order_no,
  });
  return NextResponse.json({ ok: true });
}

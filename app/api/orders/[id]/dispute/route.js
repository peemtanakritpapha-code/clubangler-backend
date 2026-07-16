// app/api/orders/[id]/dispute/route.js — ผู้ซื้อเปิดเคส: คืนของรับเงิน / พิพาทให้ไกล่เกลี่ย
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

export async function POST(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { reason, detail, requireReturn, evidencePaths, evidenceVideoPath } = await req.json();
  if (!reason) return NextResponse.json({ error: "เลือกเหตุผล" }, { status: 400 });
  if (!String(detail || "").trim()) return NextResponse.json({ error: "กรอกคำอธิบายปัญหา (บังคับ)" }, { status: 400 });
  if (!Array.isArray(evidencePaths) || evidencePaths.length < 1)
    return NextResponse.json({ error: "แนบรูปหลักฐานอย่างน้อย 1 รูป" }, { status: 400 });
  if (!String(evidenceVideoPath || "").trim()) // DISPUTE-2b-CLIP
    return NextResponse.json({ error: "แนบคลิปเปิดกล่องอย่างน้อย 1 คลิป" }, { status: 400 });

  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).single();
  if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (o.dispute_closed_at) return NextResponse.json({ error: "เคสของออเดอร์นี้ถูกแอดมินพิจารณาแล้ว ไม่สามารถเปิดเคสซ้ำได้" }, { status: 400 }); // DISPUTE-2a
  if (!["shipped", "delivered"].includes(o.status))
    return NextResponse.json({ error: "เปิดเคสได้เฉพาะออเดอร์ที่จัดส่งแล้ว" }, { status: 400 });

  const status = requireReturn ? "return_requested" : "disputed";
  const { data: upd, error } = await admin.from("orders").update({
    status, dispute_reason: reason, dispute_detail: detail.trim(),
    require_return: !!requireReturn, evidence_paths: evidencePaths.slice(0, 5),
    evidence_video_path: evidenceVideoPath.trim(), // DISPUTE-2b-CLIP
  }).eq("id", id).in("status", ["shipped", "delivered"]).select("id"); // กันชน: ชนกับการโอนเงิน/ปิดออเดอร์
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd?.length) return NextResponse.json({ error: "สถานะออเดอร์เปลี่ยนไปแล้ว — รีเฟรชหน้าแล้วดูสถานะล่าสุด" }, { status: 409 });

  await admin.from("notifications").insert({
    to_user: o.seller_id, icon: "⚠️", title: requireReturn ? "ผู้ซื้อขอคืนสินค้า" : "ผู้ซื้อเปิดข้อพิพาท",
    body: `${o.item} — ${reason} · รอแอดมินพิจารณา`, ref: o.order_no,
  });
  await notifyAdmins(admin, { icon: "⚠️", title: "เคสพิพาท/ขอคืนใหม่", body: o.item, ref: o.order_no, link: "/admin?tab=returns" });
  return NextResponse.json({ ok: true });
}

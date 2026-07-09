// app/api/admin/user-ban/route.js — POST3.3: แบน/ปลดแบนผู้ใช้จากหน้าจัดการผู้ใช้
// (การแบนจากคิวรายงานใช้ /api/admin/reports — route นี้สำหรับจัดการตรงที่ตัวผู้ใช้)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return p?.is_admin ? { user, admin } : null;
}

export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { admin } = ctx;

  const body = await req.json();
  const action = String(body?.action || "");
  const userId = String(body?.userId || "");
  const reason = String(body?.reason || "").trim();

  if (!["ban", "unban"].includes(action) || !userId)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const { data: target } = await admin.from("profiles").select("id, is_admin, banned_at").eq("id", userId).single();
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  if (action === "ban") {
    if (target.is_admin) return NextResponse.json({ error: "แบนบัญชีแอดมินไม่ได้" }, { status: 400 });
    if (target.banned_at) return NextResponse.json({ error: "ผู้ใช้นี้ถูกแบนอยู่แล้ว" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผลการแบน" }, { status: 400 });
    await admin.from("profiles").update({ banned_at: new Date().toISOString(), banned_reason: reason }).eq("id", userId);
    await admin.from("notifications").insert({
      to_user: userId, icon: "⛔", title: "บัญชีของคุณถูกระงับการใช้งานชุมชน",
      body: `เหตุผล: ${reason} · โพสต์/ขาย/ซื้อไม่ได้ชั่วคราว แต่ยังเข้าดูออเดอร์เดิมได้`,
    });
    return NextResponse.json({ ok: true });
  }

  // unban
  if (!target.banned_at) return NextResponse.json({ error: "ผู้ใช้นี้ไม่ได้ถูกแบน" }, { status: 400 });
  await admin.from("profiles").update({ banned_at: null, banned_reason: null }).eq("id", userId);
  await admin.from("notifications").insert({
    to_user: userId, icon: "✅", title: "บัญชีของคุณกลับมาใช้งานได้ปกติ",
    body: "การระงับถูกยกเลิกแล้ว — โพสต์ ขาย และซื้อได้ตามเดิม",
  });
  return NextResponse.json({ ok: true });
}

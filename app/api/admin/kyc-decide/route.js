// app/api/admin/kyc-decide/route.js — แอดมินตรวจ KYC (ปฏิเสธบังคับเหตุผล ผู้ใช้เห็น+ยื่นใหม่ได้)
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

  const { userId, approve, reason } = await req.json();
  const { data: p } = await admin.from("profiles").select("kyc_status").eq("id", userId).single();
  if (!p || p.kyc_status !== "pending")
    return NextResponse.json({ error: "รายการนี้ไม่อยู่ในคิว KYC" }, { status: 400 });

  if (approve) {
    const { error } = await admin.from("profiles").update({ kyc_status: "verified", is_shop: true, kyc_reject_reason: null }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({ to_user: userId, icon: "✅", title: "ยืนยันตัวตนสำเร็จ", body: "บัญชีของคุณผ่าน KYC แล้ว — รับเงินจากการขายได้เต็มรูปแบบ" });
  } else {
    if (!String(reason || "").trim()) return NextResponse.json({ error: "ต้องระบุเหตุผลการปฏิเสธ" }, { status: 400 });
    const { error } = await admin.from("profiles").update({ kyc_status: "rejected", kyc_reject_reason: reason.trim() }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({ to_user: userId, icon: "❌", title: "เอกสาร KYC ไม่ผ่าน", body: `เหตุผล: ${reason.trim()} · แก้ไขแล้วยื่นใหม่ได้` });
  }
  return NextResponse.json({ ok: true });
}

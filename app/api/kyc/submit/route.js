// app/api/kyc/submit/route.js — ผู้ใช้ยื่น KYC (บัตร ปชช. + สมุดบัญชี บังคับทั้งคู่) → pending
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { idCardPath, bankBookPath } = await req.json();
  if (!idCardPath || !bankBookPath)
    return NextResponse.json({ error: "แนบเอกสารให้ครบทั้ง 2 รายการ" }, { status: 400 });

  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("kyc_status, promptpay, bank").eq("id", user.id).single();
  if (p?.kyc_status === "pending") return NextResponse.json({ error: "เอกสารอยู่ระหว่างตรวจสอบ" }, { status: 400 });
  if (p?.kyc_status === "verified") return NextResponse.json({ error: "บัญชีนี้ยืนยันตัวตนแล้ว" }, { status: 400 });
  if (!p?.promptpay && !p?.bank?.no)
    return NextResponse.json({ error: "กรอกบัญชีรับเงิน (พร้อมเพย์หรือบัญชีธนาคาร) ก่อนยื่น KYC" }, { status: 400 });

  const { error } = await admin.from("profiles").update({
    kyc_status: "pending", kyc_reject_reason: null,
    kyc_submitted_at: new Date().toISOString(),
    id_card_path: idCardPath, bank_book_path: bankBookPath,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("notifications").insert({
    to_user: user.id, icon: "🪪", title: "ส่งเอกสารยืนยันตัวตนแล้ว", body: "ทีมงานจะตรวจสอบภายใน 24 ชั่วโมง",
  });
  return NextResponse.json({ ok: true });
}

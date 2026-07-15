// app/api/kyc/payee/route.js — ADMIN-UX2: บันทึกบัญชีรับเงินผ่าน API (เดิม client เขียน profiles ตรง)
// ปิดวงจร "โอนไม่สำเร็จ": ผู้ขายที่มีธงค้างอยู่ พออัปเดตบัญชี → แจ้งเตือนแอดมินกลับเข้าคิวโอนอัตโนมัติ
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { promptpay = "", bank = null } = await req.json().catch(() => ({}));
  const pp = String(promptpay || "").trim() || null;
  const bk = bank && String(bank.no || "").trim()
    ? { bank: String(bank.bank || "").trim(), no: String(bank.no).trim(), name: String(bank.name || "").trim() }
    : null;
  if (!pp && !bk) return NextResponse.json({ error: "กรอกพร้อมเพย์หรือบัญชีธนาคารอย่างน้อย 1 อย่าง" }, { status: 400 });

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("name, payout_failed_note").eq("id", user.id).single();
  const { error } = await admin.from("profiles").update({ promptpay: pp, bank: bk }).eq("id", user.id);
  if (error) { console.error("kyc/payee:", error); return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 }); }

  // มีธงโอนไม่สำเร็จค้าง → เคลียร์ธงที่โปรไฟล์ (ประวัติรายออเดอร์ยังอยู่) + แจ้งแอดมินกลับเข้าคิวโอน
  if (prof?.payout_failed_note) {
    await admin.from("profiles").update({ payout_failed_note: null }).eq("id", user.id);
    notifyAdmins(admin, { icon: "💸", title: "ผู้ขายอัปเดตบัญชีรับเงินแล้ว — โอนซ้ำได้", body: prof?.name || "", link: "/admin?tab=payout" }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

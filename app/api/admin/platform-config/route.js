// app/api/admin/platform-config/route.js — แอดมินบันทึกตั้งค่าระบบ (A5)
// ใช้ร่วมทุกหน้าตั้งค่า: การรับชำระเงิน (ก้าว 2) / แบนเนอร์+วันครบกำหนด (ก้าว 3)
// รับเฉพาะฟิลด์ใน whitelist — กันเขียนคอลัมน์อื่นโดยไม่ตั้งใจ
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = [
  "promptpay_enabled", "promptpay_id", "promptpay_name",
  "bank_enabled", "banks",
  "banner_enabled", "banner_text",
  "auto_confirm_days", "return_auto_confirm_days",
];

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
  const patch = {};
  for (const k of ALLOWED) if (k in body) patch[k] = body[k];
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "ไม่มีข้อมูลให้บันทึก" }, { status: 400 });

  // วันครบกำหนดต้องอยู่ระหว่าง 1–30 (prototype บรรทัด 5570)
  for (const k of ["auto_confirm_days", "return_auto_confirm_days"])
    if (k in patch) patch[k] = Math.min(30, Math.max(1, Number(patch[k]) || 0));

  // ตรวจ banks ให้เป็นรายการที่ครบถ้วน
  if ("banks" in patch) {
    if (!Array.isArray(patch.banks)) return NextResponse.json({ error: "รูปแบบบัญชีไม่ถูกต้อง" }, { status: 400 });
    patch.banks = patch.banks.map(b => ({
      id: b.id || Date.now() + Math.floor(Math.random() * 1000),
      bank: String(b.bank || "").trim(),
      accountNo: String(b.accountNo || "").trim(),
      accountName: String(b.accountName || "").trim(),
      primary: !!b.primary,
    })).filter(b => b.bank && b.accountNo && b.accountName);
  }

  // ต้องเหลืออย่างน้อย 1 ช่องทางรับเงินที่ใช้งานได้ (กติกาจาก prototype บรรทัด 5343)
  const { data: cur } = await admin.from("platform_config").select("*").single();
  if (!cur) return NextResponse.json({ error: "ไม่พบ platform_config" }, { status: 500 });
  const next = { ...cur, ...patch };
  const bankOk = next.bank_enabled && Array.isArray(next.banks) && next.banks.length > 0;
  const ppOk = next.promptpay_enabled && String(next.promptpay_id || "").trim();
  if (("bank_enabled" in patch || "banks" in patch || "promptpay_enabled" in patch || "promptpay_id" in patch) && !bankOk && !ppOk)
    return NextResponse.json({ error: "ต้องมีช่องทางรับเงินที่ใช้งานได้อย่างน้อย 1 ช่องทาง (ธนาคารพร้อมบัญชี หรือพร้อมเพย์พร้อมหมายเลข)" }, { status: 400 });

  const { error } = await admin.from("platform_config").update(patch).eq("id", cur.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

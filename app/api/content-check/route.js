// app/api/content-check/route.js — AUTO1: จุดตรวจเนื้อหาสำหรับฝั่ง client (เช่น ฟอร์มลงขาย)
// เหตุผลที่มี route นี้: client อ่านตาราง banned_words ตรงไม่ได้ (จงใจ — กันสแกนลิสต์)
// จึงส่งข้อความมาตรวจที่ server แทน · ต้องล็อกอินก่อน (กันคนนอกยิงหาขอบเขตตัวกรอง)
// SELL-API: ฟอร์มลงขายย้ายไป /api/products/save แล้ว (บังคับตัวกรองที่นั่น) —
//    route นี้เหลือไว้เป็นจุดตรวจล่วงหน้า/ใช้ซ้ำในอนาคต ไม่ใช่ด่านบังคับ
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContent, filterMessage } from "@/lib/contentFilter";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const text = String(body?.text || "").slice(0, 10000);

  const admin = createAdminClient();
  const { data: bw } = await admin.from("banned_words").select("word");
  const chk = checkContent(text, (bw || []).map(x => x.word));

  return NextResponse.json({ ok: chk.ok, message: chk.ok ? null : filterMessage(chk.hits) });
}

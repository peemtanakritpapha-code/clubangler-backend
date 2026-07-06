// app/api/admin/fee-tiers/route.js — แอดมินแก้เรทค่าธรรมเนียม (A5 ก้าว 4)
// รับเฉพาะ "แถวที่ถูกแก้" [{id, ...ฟิลด์}] — upsert เป็นชุด (รองรับกดปรับทั้งตาราง 505 แถว)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FIELDS = ["min", "buyer", "seller", "buyer_base", "seller_base", "buyer_excess_pct", "seller_excess_pct", "buyer_pct", "seller_pct"];

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

  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length)
    return NextResponse.json({ error: "ไม่มีแถวให้บันทึก" }, { status: 400 });

  const clean = rows.map(r => {
    const o = { id: r.id };
    for (const k of FIELDS) if (k in r) o[k] = r[k] === null ? null : Math.max(0, Number(r[k]) || 0);
    return o;
  }).filter(r => r.id != null);
  if (!clean.length) return NextResponse.json({ error: "ข้อมูลแถวไม่ถูกต้อง" }, { status: 400 });

  // ตรวจภาพรวมหลังแก้: min ห้ามซ้ำ + ช่วงแรกต้องเริ่มที่ 0 (prototype บรรทัด 5478–5480)
  const { data: all } = await admin.from("fee_tiers").select("id, min");
  const byId = Object.fromEntries((all || []).map(t => [String(t.id), Number(t.min)]));
  for (const r of clean) if ("min" in r) byId[String(r.id)] = Number(r.min);
  const mins = Object.values(byId);
  if (new Set(mins).size !== mins.length)
    return NextResponse.json({ error: "ช่วงราคาเริ่มต้นซ้ำกัน — กรุณาแก้ก่อนบันทึก" }, { status: 400 });
  if (Math.min(...mins) !== 0)
    return NextResponse.json({ error: "ช่วงแรกต้องเริ่มที่ 0 เพื่อครอบคลุมทุกราคา" }, { status: 400 });

  // อัปเดตรายแถว (id เป็น GENERATED ALWAYS — ใช้ upsert/insert พร้อม id ไม่ได้)
  // ยิงขนานทีละ 25 แถว รองรับกรณีปรับทั้งตาราง 500+ แถว
  for (let i = 0; i < clean.length; i += 25) {
    const chunk = clean.slice(i, i + 25);
    const results = await Promise.all(chunk.map(({ id, ...fields }) =>
      admin.from("fee_tiers").update(fields).eq("id", id)
    ));
    const bad = results.find(r => r.error);
    if (bad) return NextResponse.json({ error: bad.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: clean.length });
}

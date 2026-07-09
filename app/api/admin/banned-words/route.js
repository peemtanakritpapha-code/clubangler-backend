// app/api/admin/banned-words/route.js — AUTO1: แอดมินจัดการคลังคำต้องห้าม
// action: add (word, note) · update (id, word, note) · remove (id)
// กติกา: คำยาว 2-50 ตัวอักษร (สั้นกว่า 2 เสี่ยง false positive สูงจากการ normalize บีบอักขระ)
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
  const { user, admin } = ctx;

  const body = await req.json();
  const action = String(body?.action || "");
  const word = String(body?.word || "").trim();
  const note = String(body?.note || "").trim().slice(0, 200) || null;
  const id = Number(body?.id);

  if (action === "add" || action === "update") {
    if (word.length < 2) return NextResponse.json({ error: "คำต้องยาวอย่างน้อย 2 ตัวอักษร (สั้นกว่านี้เสี่ยงบล็อกคำปกติ)" }, { status: 400 });
    if (word.length > 50) return NextResponse.json({ error: "คำยาวเกิน 50 ตัวอักษร" }, { status: 400 });
  }

  if (action === "add") {
    const { error } = await admin.from("banned_words").insert({ word, note, created_by: user.id });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `คำว่า "${word}" มีอยู่ในคลังแล้ว` }, { status: 400 });
      console.error("banned_words add:", error);
      return NextResponse.json({ error: "เพิ่มคำไม่สำเร็จ" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const { error } = await admin.from("banned_words").update({ word, note }).eq("id", id);
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `คำว่า "${word}" มีอยู่ในคลังแล้ว` }, { status: 400 });
      return NextResponse.json({ error: "แก้ไขไม่สำเร็จ" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await admin.from("banned_words").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

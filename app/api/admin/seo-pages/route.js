// app/api/admin/seo-pages/route.js — SEO-3: แอดมินอ่าน/แก้ title, description, intro ของหน้าสำคัญ
// โครงเดียวกับ platform-config: requireAdmin + whitelist ฟิลด์ + เพดานความยาว (กัน Google ตัด)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED = ["title", "description", "intro_html"];
const MAX = { title: 70, description: 170, intro_html: 2000 };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return p?.is_admin ? { user, admin } : null;
}

// GET: รายการ SEO ทุกหน้า (ให้แท็บแอดมินโหลด)
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { data } = await ctx.admin.from("seo_pages").select("*").order("page_key");
  return NextResponse.json({ pages: data || [] });
}

// POST: บันทึก { page_key, title, description, intro_html }
export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });

  let body = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const page_key = String(body?.page_key || "").trim();
  if (!page_key || page_key.length > 100) return NextResponse.json({ error: "ไม่ระบุหน้า" }, { status: 400 });

  const patch = { page_key, updated_at: new Date().toISOString() };
  for (const k of ALLOWED) if (k in body) {
    let v = String(body[k] ?? "").trim();
    if (MAX[k] && v.length > MAX[k]) v = v.slice(0, MAX[k]);
    patch[k] = v || null;
  }

  const { error } = await ctx.admin.from("seo_pages").upsert(patch);
  if (error) {
    console.error("admin/seo-pages:", error);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

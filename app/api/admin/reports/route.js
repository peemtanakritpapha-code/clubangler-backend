// app/api/admin/reports/route.js — POST3.2: แอดมินจัดการเคสรายงาน
// action: dismiss (ปิดเคส) · remove (ลบ/ระงับเนื้อหา + แจ้งเจ้าของ + ปิดเคสอัตโนมัติ) · ban (แบนเจ้าของเนื้อหา — ไม่ปิดเคส)
// กติกา: โพสต์ = soft delete (status removed เก็บหลักฐาน) · คอมเมนต์ = ลบจริงแต่ snapshot ข้อความไว้ในเคส ·
//        สินค้า = ต่อท่อระบบระงับเดิม (status suspended) เพราะอาจผูกออเดอร์อยู่ ห้ามลบจริง
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

const notify = (admin, toUser, icon, title, body) =>
  admin.from("notifications").insert({ to_user: toUser, icon, title, body });

export async function POST(req) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "เฉพาะแอดมินเท่านั้น" }, { status: 403 });
  const { user, admin } = ctx;

  const body = await req.json();
  const action = String(body?.action || "");
  const reportId = Number(body?.reportId);
  const reason = String(body?.reason || "").trim();

  if (!["dismiss", "remove", "ban"].includes(action) || !Number.isFinite(reportId))
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const { data: rep } = await admin.from("reports").select("*").eq("id", reportId).single();
  if (!rep) return NextResponse.json({ error: "ไม่พบเคสรายงาน" }, { status: 404 });

  const closeCase = (status, note) =>
    admin.from("reports").update({ status, resolved_by: user.id, resolved_at: new Date().toISOString(), resolution_note: note || null })
      .eq("id", reportId);

  // ── ปิดเคส (ไม่ผิดกติกา) ──
  if (action === "dismiss") {
    await closeCase("dismissed", reason || null);
    return NextResponse.json({ ok: true });
  }

  // ── ลบ/ระงับเนื้อหา ──
  if (action === "remove") {
    if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผล" }, { status: 400 });

    if (rep.target_type === "post") {
      const { data: post } = await admin.from("posts").select("id, author_id, status").eq("id", rep.target_id).single();
      if (!post) return NextResponse.json({ error: "ไม่พบโพสต์ (อาจถูกลบไปแล้ว)" }, { status: 404 });
      await admin.from("posts").update({
        status: "removed", removed_reason: reason, removed_by: user.id, removed_at: new Date().toISOString(),
      }).eq("id", post.id);
      await notify(admin, post.author_id, "🚫", "โพสต์ของคุณถูกลบโดยทีมงาน", `เหตุผล: ${reason}`);
      await closeCase("resolved", `ลบโพสต์ — ${reason}`);
      return NextResponse.json({ ok: true });
    }

    if (rep.target_type === "comment") {
      const { data: cm } = await admin.from("post_comments").select("id, user_id, text").eq("id", rep.target_id).single();
      if (!cm) return NextResponse.json({ error: "ไม่พบคอมเมนต์ (อาจถูกลบไปแล้ว)" }, { status: 404 });
      // snapshot ข้อความเก็บเป็นหลักฐานในเคสก่อนลบจริง (post_comments ไม่มีคอลัมน์ soft delete)
      await closeCase("resolved", `ลบคอมเมนต์ — ${reason} · หลักฐานข้อความ: "${(cm.text || "").slice(0, 400)}"`);
      await admin.from("post_comments").delete().eq("id", cm.id);
      await notify(admin, cm.user_id, "🚫", "คอมเมนต์ของคุณถูกลบโดยทีมงาน", `เหตุผล: ${reason}`);
      return NextResponse.json({ ok: true });
    }

    if (rep.target_type === "product") {
      const { data: prod } = await admin.from("products").select("id, seller_id, name").eq("id", rep.target_id).single();
      if (!prod) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
      await admin.from("products").update({ status: "suspended", suspend_reason: reason }).eq("id", prod.id);
      await notify(admin, prod.seller_id, "⛔", `สินค้า "${prod.name}" ถูกระงับ`, `เหตุผล: ${reason} · แก้ไขแล้วติดต่อทีมงานเพื่อปลดระงับ`);
      await closeCase("resolved", `ระงับสินค้า — ${reason}`);
      return NextResponse.json({ ok: true });
    }
  }

  // ── แบนเจ้าของเนื้อหา (เคสยังเปิด — แอดมินตัดสินตัวเนื้อหาแยกอีกที) ──
  if (action === "ban") {
    if (!reason) return NextResponse.json({ error: "กรุณาระบุเหตุผลการแบน" }, { status: 400 });
    const ownerId = String(body?.ownerId || "");
    if (!ownerId) return NextResponse.json({ error: "ไม่พบเจ้าของเนื้อหา" }, { status: 400 });
    const { data: owner } = await admin.from("profiles").select("id, is_admin, banned_at").eq("id", ownerId).single();
    if (!owner) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    if (owner.is_admin) return NextResponse.json({ error: "แบนบัญชีแอดมินไม่ได้" }, { status: 400 });
    if (owner.banned_at) return NextResponse.json({ error: "ผู้ใช้นี้ถูกแบนอยู่แล้ว" }, { status: 400 });
    await admin.from("profiles").update({ banned_at: new Date().toISOString(), banned_reason: reason }).eq("id", ownerId);
    await notify(admin, ownerId, "⛔", "บัญชีของคุณถูกระงับการใช้งานชุมชน",
      `เหตุผล: ${reason} · โพสต์/ขาย/ซื้อไม่ได้ชั่วคราว แต่ยังเข้าดูออเดอร์เดิมได้ · สอบถามทีมงานได้ทางอีเมล`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

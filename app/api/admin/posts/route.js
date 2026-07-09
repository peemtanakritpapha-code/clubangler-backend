// app/api/admin/posts/route.js — POST3.3: แอดมินจัดการโพสต์
// approve (pending→visible) · reject (pending→removed, เหตุผลบังคับ) · remove (visible→removed, เหตุผลบังคับ) · restore (removed→visible)
// ทุกทางแจ้งเตือนเจ้าของ — ลบ = soft delete เก็บหลักฐาน (Iron Rule 25) กู้คืนได้
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
  const postId = Number(body?.postId);
  const reason = String(body?.reason || "").trim();

  if (!["approve", "reject", "remove", "restore"].includes(action) || !Number.isFinite(postId))
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if ((action === "reject" || action === "remove") && !reason)
    return NextResponse.json({ error: "กรุณาระบุเหตุผล" }, { status: 400 });

  const { data: post } = await admin.from("posts").select("id, author_id, status").eq("id", postId).single();
  if (!post) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

  const notify = (icon, title, bodyText) =>
    admin.from("notifications").insert({ to_user: post.author_id, icon, title, body: bodyText });

  if (action === "approve") {
    if (post.status !== "pending") return NextResponse.json({ error: "โพสต์นี้ไม่ได้อยู่ในคิวรออนุมัติ" }, { status: 400 });
    await admin.from("posts").update({ status: "visible" }).eq("id", postId);
    await notify("🎉", "โพสต์ของคุณได้รับการอนุมัติแล้ว", "โพสต์แสดงในฟีดเรียบร้อย");
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (post.status !== "pending") return NextResponse.json({ error: "โพสต์นี้ไม่ได้อยู่ในคิวรออนุมัติ" }, { status: 400 });
    await admin.from("posts").update({
      status: "removed", removed_reason: reason, removed_by: user.id, removed_at: new Date().toISOString(),
    }).eq("id", postId);
    await notify("❌", "โพสต์ของคุณไม่ได้รับการอนุมัติ", `เหตุผล: ${reason}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    if (post.status === "removed") return NextResponse.json({ error: "โพสต์นี้ถูกลบอยู่แล้ว" }, { status: 400 });
    await admin.from("posts").update({
      status: "removed", removed_reason: reason, removed_by: user.id, removed_at: new Date().toISOString(),
    }).eq("id", postId);
    await notify("🚫", "โพสต์ของคุณถูกลบโดยทีมงาน", `เหตุผล: ${reason}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    if (post.status !== "removed") return NextResponse.json({ error: "โพสต์นี้ไม่ได้ถูกลบ" }, { status: 400 });
    await admin.from("posts").update({
      status: "visible", removed_reason: null, removed_by: null, removed_at: null,
    }).eq("id", postId);
    await notify("↩️", "โพสต์ของคุณถูกกู้คืนแล้ว", "โพสต์กลับมาแสดงในฟีดตามปกติ");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

// app/api/posts/comment/route.js — CM2+CM3: ส่งคอมเมนต์/ตอบกลับ + แจ้งเตือน
// เหตุที่ต้องเป็น API (ไม่ insert ตรงจาก client): การสร้างแจ้งเตือนถึง "คนอื่น" ต้องทำด้วย service key
// ไม่งั้นต้องเปิด RLS ให้ใครก็ insert notifications ถึงใครก็ได้ = ช่องปลอมแจ้งเตือน
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContent, filterMessage } from "@/lib/contentFilter"; // AUTO1

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const text = String(body?.text || "").trim();
  const postId = body?.postId;
  const parentId = body?.parentId || null;
  if (!postId || !text) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "ความคิดเห็นยาวเกินไป (สูงสุด 1,000 ตัวอักษร)" }, { status: 400 });

  const admin = createAdminClient();
  // POST3.1: กันคนโดนแบนใช้งานชุมชน
  const { data: banChk } = await admin.from("profiles").select("banned_at").eq("id", user.id).single();
  if (banChk?.banned_at)
    return NextResponse.json({ error: "บัญชีของคุณถูกระงับการใช้งานชุมชน" }, { status: 403 });
  // AUTO1: ตัวกรองเนื้อหา — เบอร์โทร/ไลน์ + คลังคำต้องห้าม
  const { data: bw } = await admin.from("banned_words").select("word");
  const chk = checkContent(text, (bw || []).map(x => x.word));
  if (!chk.ok) return NextResponse.json({ error: filterMessage(chk.hits) }, { status: 400 });

  const { data: post } = await admin.from("posts").select("id, author_id").eq("id", postId).single();
  if (!post) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

  // ตอบกลับ: parent ต้องมีจริงและอยู่โพสต์เดียวกัน · เธรดชั้นเดียว — ตอบกลับ reply ให้เกาะ parent ตัวบนสุดแทน
  let parent = null;
  let insertParentId = null;
  if (parentId) {
    const { data: pr } = await admin.from("post_comments").select("id, user_id, post_id, parent_id").eq("id", parentId).single();
    if (!pr || String(pr.post_id) !== String(postId))
      return NextResponse.json({ error: "ไม่พบความคิดเห็นที่ตอบกลับ" }, { status: 400 });
    parent = pr;
    insertParentId = pr.parent_id || pr.id;
  }

  const { data: cm, error } = await admin.from("post_comments")
    .insert({ post_id: postId, user_id: user.id, text, parent_id: insertParentId })
    .select("*, profiles(name, is_shop, avatar_path)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // แจ้งเตือน: เจ้าของโพสต์ + เจ้าของคอมเมนต์ที่ถูกตอบ (ไม่แจ้งตัวเอง ไม่แจ้งคนเดิมซ้ำ) — ลบคอมเมนต์ไม่แจ้ง (ตามธรรมเนียม FB)
  try {
    const { data: me } = await admin.from("profiles").select("name").eq("id", user.id).single();
    const who = me?.name || "ผู้ใช้";
    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
    const notis = [];
    if (post.author_id && post.author_id !== user.id)
      notis.push({ to_user: post.author_id, icon: "💬", title: `${who} แสดงความคิดเห็นในโพสต์ของคุณ`, body: preview, link: "/" });
    if (parent && parent.user_id !== user.id && parent.user_id !== post.author_id)
      notis.push({ to_user: parent.user_id, icon: "↩️", title: `${who} ตอบกลับความคิดเห็นของคุณ`, body: preview, link: "/" });
    if (notis.length) await admin.from("notifications").insert(notis);
  } catch {} // แจ้งเตือนพลาดไม่ควรทำให้คอมเมนต์ล้ม

  return NextResponse.json({ comment: cm });
}

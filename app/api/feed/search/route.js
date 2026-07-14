// app/api/feed/search/route.js — FEEDSEARCH-1: ค้นหาในฟีด (ผู้คน / ร้านค้า / โพสต์)
// GET /api/feed/search?q=คำค้น
//   → { people: [{ id, name, is_shop, avatar_path, followers }], posts: [{ id, text, created_at, author_id, profiles }] }
//   - ilike ตรงไปตรงมา (ข้อมูลช่วงนี้ยังไม่มาก — ช้าเมื่อไหร่ค่อยอัปเป็น pg_trgm แบบตลาด)
//   - โพสต์เอาเฉพาะ status = "visible" (pending/removed ไม่โผล่ให้คนอื่นค้นเจอ)
//   - จำกัด: ผู้คน 12 / โพสต์ 20 · คำค้น 2–80 ตัวอักษร
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const cleanQ = (raw) => String(raw || "").trim().slice(0, 80);
// กันอักขระ pattern ของ ilike (% _ \) — ผู้ใช้ค้นข้อความล้วน ไม่ใช่ pattern
const esc = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);

export async function GET(req) {
  const q = cleanQ(new URL(req.url).searchParams.get("q"));
  if (q.length < 2) return NextResponse.json({ people: [], posts: [] });

  const admin = createAdminClient();
  const pat = `%${esc(q)}%`;

  const [peopleQ, postsQ] = await Promise.all([
    admin.from("profiles")
      .select("id, name, is_shop, avatar_path")
      .ilike("name", pat)
      .limit(12),
    admin.from("posts")
      .select("id, text, created_at, author_id, profiles!posts_author_id_fkey(name, is_shop, avatar_path)")
      .ilike("text", pat)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (peopleQ.error) console.error("feed/search people:", peopleQ.error.message);
  if (postsQ.error) console.error("feed/search posts:", postsQ.error.message);

  // นับผู้ติดตามของคนที่เจอ — ยิงครั้งเดียว ไม่วนถามทีละคน
  const ids = (peopleQ.data || []).map((p) => p.id);
  const cnt = {};
  if (ids.length) {
    const { data: fl } = await admin.from("follows").select("followee_id").in("followee_id", ids);
    for (const f of fl || []) cnt[f.followee_id] = (cnt[f.followee_id] || 0) + 1;
  }

  return NextResponse.json({
    people: (peopleQ.data || []).map((p) => ({ ...p, followers: cnt[p.id] || 0 })),
    posts: postsQ.data || [],
  });
}

// app/page.js — ฟีดชุมชน (แท็บ "ฟีด" ตาม prototype: แอปมือถือ + เว็บมีแถบข้างสินค้ามาใหม่)
// W1: ผู้ที่ยังไม่ล็อกอิน → หน้า Landing (ตาม prototype โหมดเว็บไซต์) / ล็อกอินแล้ว → ฟีดเหมือนเดิม
import { createClient } from "@/lib/supabase/server";
import FeedClient from "./FeedClient";
import LandingClient from "./LandingClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Guest → Landing (W1) ──
  if (!user) {
    const { data: products } = await supabase.from("products")
      .select("id, name, price, images, shipping, status, seller_id, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(12);
    const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
    const { data: sellers } = sellerIds.length
      ? await supabase.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
      : { data: [] };
    const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));
    const rows = (products || []).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));
    return <LandingClient products={rows} />;
  }

  // ── ล็อกอินแล้ว → ฟีดชุมชน (เดิม) ──
  // profiles!posts_author_id_fkey = ระบุเส้นทาง join ชัดๆ (posts→profiles มี 2 ทาง: author_id ตรง / อ้อมผ่าน post_likes → ไม่ระบุ = PGRST201)
  const { data: posts, error: postsErr } = await supabase.from("posts")
    .select("*, profiles!posts_author_id_fkey(name, is_shop, avatar_path), products(id, name, price, images), post_likes(count), post_comments(count)")
    .neq("status", "removed") // POST3.1: soft delete ไม่โผล่ฟีด (ของคนอื่น RLS กันอีกชั้น)
    .order("created_at", { ascending: false }).limit(40);
  if (postsErr) console.error("FEED QUERY ERROR:", postsErr.code, "|", postsErr.message);

  let myLikes = [], myFollows = [], myProducts = [], myBlocks = [], me = null;
  {
    const ids = (posts || []).map(p => p.id);
    const [{ data: likes }, { data: follows }, { data: prods }, { data: prof }, { data: blocks }] = await Promise.all([
      ids.length ? supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", ids) : { data: [] },
      supabase.from("follows").select("followee_id").eq("follower_id", user.id),
      supabase.from("products").select("id, name, price").eq("seller_id", user.id).eq("status", "active").limit(20),
      supabase.from("profiles").select("name, is_shop, is_admin, avatar_path").eq("id", user.id).single(),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id), // POST2
    ]);
    myLikes = (likes || []).map(x => x.post_id);
    myFollows = (follows || []).map(x => x.followee_id);
    myProducts = prods || [];
    me = prof;
    myBlocks = (blocks || []).map(x => x.blocked_id);
  }

  const { data: latest } = await supabase.from("products")
    .select("id, name, price, images").eq("status", "active")
    .order("created_at", { ascending: false }).limit(6);

  return <FeedClient
    posts={posts || []} latest={latest || []}
    user={{ id: user.id, name: me?.name, isShop: !!me?.is_shop, isAdmin: !!me?.is_admin, avatar: me?.avatar_path || null }}
    myLikes={myLikes} myFollows={myFollows} myProducts={myProducts} myBlocks={myBlocks}
  />;
}

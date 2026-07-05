// app/page.js — ฟีดชุมชน (แท็บ "ฟีด" ตาม prototype: แอปมือถือ + เว็บมีแถบข้างสินค้ามาใหม่)
import { createClient } from "@/lib/supabase/server";
import FeedClient from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: posts } = await supabase.from("posts")
    .select("*, profiles(name, is_shop), products(id, name, price, images), post_likes(count), post_comments(count)")
    .order("created_at", { ascending: false }).limit(40);

  let myLikes = [], myFollows = [], myProducts = [], me = null;
  if (user) {
    const ids = (posts || []).map(p => p.id);
    const [{ data: likes }, { data: follows }, { data: prods }, { data: prof }] = await Promise.all([
      ids.length ? supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", ids) : { data: [] },
      supabase.from("follows").select("followee_id").eq("follower_id", user.id),
      supabase.from("products").select("id, name, price").eq("seller_id", user.id).eq("status", "active").limit(20),
      supabase.from("profiles").select("name, is_shop, is_admin").eq("id", user.id).single(),
    ]);
    myLikes = (likes || []).map(x => x.post_id);
    myFollows = (follows || []).map(x => x.followee_id);
    myProducts = prods || [];
    me = prof;
  }

  const { data: latest } = await supabase.from("products")
    .select("id, name, price, images").eq("status", "active")
    .order("created_at", { ascending: false }).limit(6);

  return <FeedClient
    posts={posts || []} latest={latest || []}
    user={user ? { id: user.id, name: me?.name, isShop: !!me?.is_shop, isAdmin: !!me?.is_admin } : null}
    myLikes={myLikes} myFollows={myFollows} myProducts={myProducts}
  />;
}

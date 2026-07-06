// app/seller/[id]/page.js — หน้าร้านค้า/โปรไฟล์ผู้ขาย (A4 ก้าว 1)
// derive จาก prototype WSellerProfile (บรรทัด 5975–6072)
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellerClient from "./SellerClient";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!seller) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: products }, { count: followers }, { count: sales }, { data: posts }, follow] = await Promise.all([
    supabase.from("products")
      .select("id, name, price, cond, location, images, status, created_at")
      .eq("seller_id", id).in("status", ["active", "sold"])
      .order("created_at", { ascending: false }),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", id),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", id).eq("status", "completed"),
    supabase.from("posts")
      .select("*, products(id, name, price, images), post_likes(count), post_comments(count)")
      .eq("author_id", id).order("created_at", { ascending: false }).limit(20),
    user
      ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <SellerClient
      seller={seller}
      products={products || []}
      posts={posts || []}
      followers={followers || 0}
      sales={sales || 0}
      me={user ? { id: user.id } : null}
      initiallyFollowing={!!follow?.data}
    />
  );
}

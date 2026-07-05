import { createClient } from "@/lib/supabase/server";
import MarketClient from "./MarketClient";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, status, cat_main, created_at, seller_id")
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .limit(60);
  return <MarketClient products={products || []} loggedIn={!!user} />;
}

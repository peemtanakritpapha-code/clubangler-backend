import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "./CheckoutClient";

export default async function CheckoutPage({ params }) {
  const { productId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product || product.status !== "active") notFound();

  const { data: addresses } = await supabase.from("addresses").select("*")
    .eq("user_id", user.id).order("is_default", { ascending: false }).order("id");
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");

  return <CheckoutClient product={product} addresses={addresses || []} tiers={tiers || []} userId={user.id} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellClient from "./SellClient";

export default async function SellPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");
  return <SellClient userId={user.id} tiers={tiers || []} />;
}

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PayClient from "./PayClient";

export default async function PayPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.buyer_id !== user.id) notFound();

  const { data: config } = await supabase.from("platform_config").select("*").single();
  return <PayClient order={order} config={config} userId={user.id} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  const { data: addresses } = await supabase
    .from("addresses").select("*").eq("user_id", user.id)
    .order("is_default", { ascending: false }).order("id");

  return <ProfileClient initialProfile={profile} initialAddresses={addresses || []} userId={user.id} email={user.email} />;
}

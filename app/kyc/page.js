// app/kyc/page.js — บัญชีรับเงิน & ยืนยันตัวตน (แยกจาก /profile)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KycClient from "./KycClient";

export default async function KycPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return <KycClient initialProfile={profile} userId={user.id} />;
}

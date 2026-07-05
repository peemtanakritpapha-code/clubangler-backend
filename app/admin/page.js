import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) redirect("/");

  const { data: orders } = await supabase.from("orders")
    .select("*, products(images)")
    .in("status", ["pending_verification", "delivered", "return_requested", "disputed", "return_shipped", "return_received"])
    .order("created_at");

  // ข้อมูลบัญชีผู้รับเงิน (PayeeInfo)
  const sellerIds = [...new Set((orders || []).map(o => o.seller_id))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, name, promptpay, bank, kyc_status, phone").in("id", sellerIds)
    : { data: [] };
  const { data: buyers } = (orders || []).length
    ? await supabase.from("profiles").select("id, name, phone").in("id", [...new Set(orders.map(o => o.buyer_id))])
    : { data: [] };

  const { data: kycQueue } = await supabase.from("profiles")
    .select("id, name, email, phone, promptpay, bank, kyc_status, kyc_submitted_at, id_card_path, bank_book_path")
    .eq("kyc_status", "pending").order("kyc_submitted_at");
  const { data: products } = await supabase.from("products")
    .select("id, name, price, brand, status, suspend_reason, images, seller_id")
    .order("created_at", { ascending: false }).limit(100);

  return <AdminClient orders={orders || []} sellers={sellers || []} buyers={buyers || []} userId={user.id}
    kycQueue={kycQueue || []} products={products || []} />;
}

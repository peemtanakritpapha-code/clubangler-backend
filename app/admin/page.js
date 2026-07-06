// app/admin/page.js — หลังบ้านแอดมิน (A5 ก้าว 1: เพิ่มข้อมูลหน้าภาพรวม + platform_config)
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

  // A5: ภาพรวมระบบ (prototype AdminOverview บรรทัด 4415–4428) + platform_config สำหรับหน้าตั้งค่า
  const [{ count: ordersTotal }, { data: escrowRows }, { count: activeCount }, { count: soldCount }, { data: config }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("price").in("status", ["payment_verified", "shipped", "delivered"]),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "sold"),
    supabase.from("platform_config").select("*").single(),
  ]);
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");
  const stats = {
    ordersTotal: ordersTotal || 0,
    escrowSum: (escrowRows || []).reduce((s, o) => s + Number(o.price || 0), 0),
    activeProducts: activeCount || 0,
    soldProducts: soldCount || 0,
  };

  return <AdminClient orders={orders || []} sellers={sellers || []} buyers={buyers || []} userId={user.id}
    kycQueue={kycQueue || []} products={products || []} stats={stats} config={config || null} tiers={tiers || []} />;
}

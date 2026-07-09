// app/admin/page.js — หลังบ้านแอดมิน (A5 ก้าว 1: เพิ่มข้อมูลหน้าภาพรวม + platform_config)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin"; // POST3.2: ตาราง reports ไม่มี policy ฝั่ง client
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

  // AD1: รายชื่อผู้ใช้ทั้งหมด (จัดการผู้ใช้ — spec แอดมิน §4)
  const { data: users } = await supabase.from("profiles")
    .select("id, name, email, phone, promptpay, bank, kyc_status, kyc_submitted_at, kyc_reject_reason, id_card_path, bank_book_path, is_admin, is_shop, avatar_path, created_at, banned_at, banned_reason")
    .order("created_at", { ascending: false }).limit(300);

  const { data: kycQueue } = await supabase.from("profiles")
    .select("id, name, email, phone, promptpay, bank, kyc_status, kyc_submitted_at, id_card_path, bank_book_path")
    .eq("kyc_status", "pending").order("kyc_submitted_at");
  const { data: products } = await supabase.from("products")
    .select("id, name, price, brand, status, suspend_reason, images, seller_id, cat_main, cat_sub, created_at")
    .order("created_at", { ascending: false }).limit(200);

  // A5: ภาพรวมระบบ (prototype AdminOverview บรรทัด 4415–4428) + platform_config สำหรับหน้าตั้งค่า
  const [{ count: ordersTotal }, { data: escrowRows }, { count: activeCount }, { count: soldCount }, { data: config }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("price").in("status", ["payment_verified", "shipped", "delivered", "cancelled"]), // cancelled = เงินยังพักรอคืน
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "sold"),
    supabase.from("platform_config").select("*").single(),
  ]);
  const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");

  // POST3.2: คิวรายงาน — อ่านด้วย service key + ประกอบเนื้อหาที่ถูกรายงาน (โพสต์/คอมเมนต์/สินค้า) + ชื่อคน
  const adminDb = createAdminClient();
  const { data: reportRows } = await adminDb.from("reports").select("*")
    .order("created_at", { ascending: false }).limit(100);
  const rp = reportRows || [];
  const rpIds = t => [...new Set(rp.filter(r => r.target_type === t).map(r => r.target_id))];
  const [pids, cids, prids] = [rpIds("post"), rpIds("comment"), rpIds("product")];
  const [{ data: rPosts }, { data: rComments }, { data: rProds }] = await Promise.all([
    pids.length ? adminDb.from("posts").select("id, text, images, author_id, status").in("id", pids) : { data: [] },
    cids.length ? adminDb.from("post_comments").select("id, text, user_id").in("id", cids) : { data: [] },
    prids.length ? adminDb.from("products").select("id, name, price, images, status, seller_id").in("id", prids) : { data: [] },
  ]);
  const pplIds = [...new Set([
    ...rp.map(r => r.reporter_id),
    ...(rPosts || []).map(x => x.author_id),
    ...(rComments || []).map(x => x.user_id),
    ...(rProds || []).map(x => x.seller_id),
  ])].filter(Boolean);
  const { data: ppl } = pplIds.length
    ? await adminDb.from("profiles").select("id, name, banned_at").in("id", pplIds) : { data: [] };

  // POST3.3: โพสต์ทั้งระบบสำหรับหน้าจัดการโพสต์ (pending/removed ของคนอื่นมองผ่าน RLS ไม่เห็น — ต้อง service key)
  const { data: modPostRows } = await adminDb.from("posts")
    .select("id, text, images, product_id, is_announcement, status, created_at, author_id, removed_reason, removed_by, removed_at")
    .order("created_at", { ascending: false }).limit(200);
  const mp = modPostRows || [];
  const mpPplIds = [...new Set(mp.flatMap(p => [p.author_id, p.removed_by]))].filter(Boolean);
  const mpProdIds = [...new Set(mp.map(p => p.product_id))].filter(Boolean);
  const [{ data: mpPpl }, { data: mpProds }] = await Promise.all([
    mpPplIds.length ? adminDb.from("profiles").select("id, name").in("id", mpPplIds) : { data: [] },
    mpProdIds.length ? adminDb.from("products").select("id, name").in("id", mpProdIds) : { data: [] },
  ]);
  const mpMap = Object.fromEntries((mpPpl || []).map(x => [x.id, x.name]));
  const mpProdMap = Object.fromEntries((mpProds || []).map(x => [x.id, x.name]));
  const modPosts = mp.map(p => ({
    ...p,
    authorName: mpMap[p.author_id] || "ผู้ใช้",
    removerName: p.removed_by ? (mpMap[p.removed_by] || "แอดมิน") : null,
    productName: p.product_id ? (mpProdMap[p.product_id] || null) : null,
  }));

  // AUTO1: คลังคำต้องห้าม (client policy ไม่มี — อ่านด้วย service key)
  const { data: bannedWords } = await adminDb.from("banned_words").select("*").order("created_at", { ascending: false });
  const pplMap = Object.fromEntries((ppl || []).map(x => [x.id, x]));
  const reports = rp.map(r => {
    const t = r.target_type === "post" ? (rPosts || []).find(x => x.id === r.target_id)
      : r.target_type === "comment" ? (rComments || []).find(x => x.id === r.target_id)
      : (rProds || []).find(x => x.id === r.target_id);
    const ownerId = t ? (r.target_type === "product" ? t.seller_id : (t.author_id || t.user_id)) : null;
    return {
      ...r,
      reporter: pplMap[r.reporter_id]?.name || "ผู้ใช้",
      target: t || null,
      owner: ownerId ? { id: ownerId, name: pplMap[ownerId]?.name || "ผู้ใช้", banned: !!pplMap[ownerId]?.banned_at } : null,
    };
  });
  const stats = {
    ordersTotal: ordersTotal || 0,
    escrowSum: (escrowRows || []).reduce((s, o) => s + Number(o.price || 0), 0),
    activeProducts: activeCount || 0,
    soldProducts: soldCount || 0,
  };

  return <AdminClient orders={orders || []} sellers={sellers || []} buyers={buyers || []} userId={user.id}
    kycQueue={kycQueue || []} users={users || []} products={products || []} stats={stats} config={config || null} tiers={tiers || []} reports={reports} modPosts={modPosts} bannedWords={bannedWords || []} />;
}

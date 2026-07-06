// app/api/account/delete/route.js — ลบบัญชีถาวร (P1.2 — กติกา Apple 5.1.1)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DONE = ["completed", "refunded"]; // สถานะออเดอร์ที่ถือว่าจบแล้ว

// ลบไฟล์ทั้งหมดใต้โฟลเดอร์ {userId}/ ใน bucket (วนเป็นรอบ กันเกิน 100 ไฟล์)
async function clearFolder(admin, bucket, userId) {
  for (let round = 0; round < 20; round++) {
    const { data: files, error } = await admin.storage.from(bucket).list(userId, { limit: 100 });
    if (error || !files?.length) return;
    const paths = files.filter(f => f.id).map(f => `${userId}/${f.name}`);
    if (!paths.length) return;
    await admin.storage.from(bucket).remove(paths);
    if (files.length < 100) return;
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const admin = createAdminClient();

  // กันลบบัญชีแอดมินโดยพลาด — ต้องปลดสิทธิ์แอดมินก่อนถึงจะลบได้
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (me?.is_admin)
    return NextResponse.json({ error: "บัญชีแอดมินลบผ่านหน้านี้ไม่ได้" }, { status: 400 });

  // นโยบาย v1: มีออเดอร์ที่ยังไม่จบ (ฝั่งซื้อหรือขาย) = ลบไม่ได้
  const { count, error: cntErr } = await admin.from("orders")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .not("status", "in", `(${DONE.join(",")})`);
  if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
  if ((count || 0) > 0)
    return NextResponse.json({ error: `ยังมีออเดอร์ที่ไม่จบ ${count} รายการ — ต้องปิดธุรกรรมให้เรียบร้อยก่อนลบบัญชี` }, { status: 400 });

  // PDPA: ล้างที่อยู่จัดส่งออกจากประวัติออเดอร์ของผู้ใช้ (ประวัติยอดเงินยังอยู่)
  await admin.from("orders").update({ ship_to: null }).eq("buyer_id", user.id);

  // ล้างไฟล์ส่วนตัวใน storage ทั้ง 3 buckets (บัตร/สมุดบัญชี, สลิป, รูปสินค้า+โพสต์)
  for (const bucket of ["kyc", "slips", "products"]) {
    await clearFolder(admin, bucket, user.id);
  }

  // ลบ auth user → cascade ลบ profiles → cascade ลบ addresses/products/posts/likes/comments/follows/notifications
  // ส่วน orders/order_events อยู่ต่อแบบนิรนาม (FK on delete set null จาก migration ก้าวที่ 2)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

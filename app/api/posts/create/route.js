// app/api/posts/create/route.js — POST3.1: สร้างโพสต์ผ่าน API (แทน insert ตรงจาก client)
// เหตุผลที่ย้ายมา API:
//   1) สถานะโพสต์ (pending/visible ตามสวิตช์อนุมัติ) ต้องแปะฝั่ง server — client bypass ไม่ได้
//   2) จุดกันคนโดนแบน (banned_at)
//   3) จุดเสียบตัวกรองเนื้อหา AUTO1 (เบอร์โทร/ไลน์/คำหยาบ) ในซีรีส์ถัดไป
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContent, filterMessage } from "@/lib/contentFilter"; // AUTO1

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles")
    .select("is_admin, is_shop, banned_at").eq("id", user.id).single();
  if (prof?.banned_at)
    return NextResponse.json({ error: "บัญชีของคุณถูกระงับการใช้งานชุมชน" }, { status: 403 });

  const body = await req.json();
  const text = String(body?.text || "").trim();
  const images = Array.isArray(body?.images) ? body.images.filter(u => typeof u === "string").slice(0, 4) : [];
  const productId = body?.productId ? Number(body.productId) : null;
  const announce = !!body?.announce;

  if (!text && !images.length)
    return NextResponse.json({ error: "พิมพ์ข้อความหรือแนบรูปอย่างน้อย 1 อย่าง" }, { status: 400 });
  if (text.length > 5000)
    return NextResponse.json({ error: "ข้อความยาวเกินไป (สูงสุด 5,000 ตัวอักษร)" }, { status: 400 });

  // AUTO1: ตัวกรองเนื้อหา — เบอร์โทร/ไลน์ (regex ในโค้ด) + คลังคำต้องห้าม (DB แอดมินจัดการเอง)
  const { data: bw } = await admin.from("banned_words").select("word");
  const chk = checkContent(text, (bw || []).map(x => x.word));
  if (!chk.ok) return NextResponse.json({ error: filterMessage(chk.hits) }, { status: 400 });

  // แนบสินค้า: ต้องเป็นสินค้าของตัวเองจริง (กันยิง id สินค้าคนอื่น)
  if (productId) {
    const { data: prod } = await admin.from("products").select("id, seller_id").eq("id", productId).single();
    if (!prod || prod.seller_id !== user.id)
      return NextResponse.json({ error: "แนบได้เฉพาะสินค้าของคุณเอง" }, { status: 400 });
  }

  // ประกาศ: เฉพาะแอดมิน/ร้านค้า (ตรรกะเดียวกับ canAnnounce ฝั่ง client — แต่บังคับจริงที่นี่)
  const canAnnounce = !!prof?.is_admin || !!prof?.is_shop;

  // สวิตช์อนุมัติโพสต์: เปิด = โพสต์ใหม่ pending (ยกเว้นแอดมิน) / ปิด = visible ทันที
  const { data: cfg } = await admin.from("platform_config").select("post_approval").single();
  const status = cfg?.post_approval && !prof?.is_admin ? "pending" : "visible";

  const { error } = await admin.from("posts").insert({
    author_id: user.id,
    text,
    image_url: images[0] || null, // คอลัมน์เก่า — โพสต์รูปเดียวยุคแรกยังอ่านช่องนี้
    images,
    product_id: productId,
    is_announcement: canAnnounce && announce,
    status,
  });
  if (error) {
    console.error("posts/create:", error);
    return NextResponse.json({ error: "โพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}

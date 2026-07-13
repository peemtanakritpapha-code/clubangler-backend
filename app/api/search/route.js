// app/api/search/route.js — SEARCH-1 ชิ้น 2: ค้นหาสินค้าทั้งระบบ + จดคำค้น
// GET  /api/search?q=คำค้น → { items: [สินค้า+ผู้ขาย+คะแนน เรียงคะแนนมาก→น้อย], count }
//   - เรียก SQL function search_products (คะแนน 50/30/20/15 · เฉพาะ active · จำกัด 60)
//   - ด่าน: คำค้น 2–80 ตัวอักษร
// POST /api/search  body { q, results } → จดลง search_logs (เก็บแม้ 0 ผล — ไว้ดูว่าคนหาอะไรแล้วไม่เจอ)
//   - client ยิงเฉพาะเมื่อผู้ใช้หยุดพิมพ์ ~3 วิ = ได้คำค้นจริง ไม่ติดคำครึ่งๆ กลางๆ
//   - เป็นข้อมูลสถิติเท่านั้น ไม่มีผลต่อเงิน/ออเดอร์
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const cleanQ = (raw) => String(raw || "").trim().slice(0, 80);

export async function GET(req) {
  const q = cleanQ(new URL(req.url).searchParams.get("q"));
  const cat = cleanQ(new URL(req.url).searchParams.get("cat")); // SEO-5c: ค้นเฉพาะหมวด
  if (q.length < 2) return NextResponse.json({ items: [], count: 0 });

  const admin = createAdminClient();

  // 1) ทอดแห: ได้ id + คะแนน (เรียงมาแล้วจากฟังก์ชัน)
  const { data: hits, error } = await admin.rpc("search_products", { q });
  if (error) {
    console.error("api/search rpc:", error);
    return NextResponse.json({ error: "ค้นหาไม่สำเร็จ" }, { status: 500 });
  }
  if (!hits?.length) return NextResponse.json({ items: [], count: 0 });

  // 2) ดึงข้อมูลสินค้าเต็ม (ฟิลด์ชุดเดียวกับหน้าตลาด)
  const ids = hits.map(h => h.id);
  const { data: products } = await admin
    .from("products")
    .select("id, name, price, cond, cond_label, brand, location, images, image_ratio, status, cat_main, cat_sub, shipping, views, created_at, seller_id, preorder_days")
    .in("id", ids)
    .match(cat ? { cat_main: cat } : {});

  // 3) ข้อมูลผู้ขายสำหรับแถวล่างการ์ด
  const sellerIds = [...new Set((products || []).map(p => p.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await admin.from("profiles").select("id, name, is_shop, kyc_status, avatar_path").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers || []).map(s => [s.id, s]));

  // 4) ประกอบร่าง + เรียงตามคะแนนของแห (in() ไม่การันตีลำดับ)
  const scoreMap = Object.fromEntries(hits.map(h => [h.id, Number(h.score)]));
  const items = (products || [])
    .map(p => ({ ...p, seller: sellerMap[p.seller_id] || null, _score: scoreMap[p.id] ?? 0 }))
    .sort((a, b) => b._score - a._score);

  return NextResponse.json({ items, count: items.length });
}

export async function POST(req) {
  let body = null;
  try { body = await req.json(); } catch { /* body เพี้ยน = ไม่จด */ }
  const q = cleanQ(body?.q);
  if (q.length < 2) return NextResponse.json({ ok: false });

  const results = Number(body?.results);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); // ไม่ล็อกอิน = null ได้

  const admin = createAdminClient();
  const { error } = await admin.from("search_logs").insert({
    q,
    results: Number.isFinite(results) ? Math.max(0, Math.min(999, Math.trunc(results))) : 0,
    user_id: user?.id ?? null,
  });
  if (error) console.error("api/search log:", error); // จดไม่ได้ = ไม่ต้องรบกวนผู้ใช้
  return NextResponse.json({ ok: !error });
}

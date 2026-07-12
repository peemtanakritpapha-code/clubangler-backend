// app/api/products/save/route.js — SELL-API: ลงขาย/แก้ไขสินค้าผ่าน API (แทน insert/update ตรงจาก client)
// เหตุผลที่ย้ายมา API (แพทเทิร์น POST3.1):
//   1) status ต้องกำหนดฝั่ง server — client ยิง status:"active" ข้ามด่าน review ไม่ได้อีก
//   2) จุดกันคนโดนแบน (banned_at)
//   3) ตัวกรองเนื้อหา AUTO1 บังคับจริงที่นี่ (เดิม /api/content-check เป็นแค่ "ที่ปรึกษา" — ข้ามได้)
//   4) validate ฟิลด์ + เช็คเจ้าของจริงจาก DB
// คู่กันกับ SQL ถอน RLS INSERT/UPDATE ของ products ฝั่ง client (เหลือ SELECT)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkContent, filterMessage } from "@/lib/contentFilter";
import { catPathValid, COND_GRADES, ALL_BRANDS } from "@/lib/catalog";
import { PREORDER_MAX_DAYS } from "@/lib/preorder"; // PRE-1
import { getMergedBrands, findBrand } from "@/lib/brands"; // BRAND-ADM

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("กรุณาเข้าสู่ระบบ", 401);

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles")
    .select("banned_at").eq("id", user.id).single();
  if (prof?.banned_at)
    return bad("บัญชีของคุณถูกระงับการใช้งาน", 403);

  const body = await req.json();

  // ── แปลง + ตัดความยาวทุกช่องข้อความ (กันยัดข้อมูลยาวผิดปกติ) ──
  const name = String(body?.name || "").trim().slice(0, 200);
  const description = String(body?.description || "").trim().slice(0, 10000);
  const price = Math.round(Number(body?.price));
  const catPath = Array.isArray(body?.catPath)
    ? body.catPath.map(s => String(s).trim().slice(0, 100)).filter(Boolean).slice(0, 6) : [];
  let brand = String(body?.brand || "").trim().slice(0, 100);
  const isNew = !!body?.isNew;
  const grade = String(body?.grade || "").trim();
  const condNote = String(body?.condNote || "").trim().slice(0, 1000);
  const issues = (Array.isArray(body?.issues) ? body.issues : [])
    .map(s => String(s).trim().slice(0, 100)).filter(Boolean).slice(0, 10);
  const location = String(body?.location || "").trim().slice(0, 200);
  const editId = body?.editId ? Number(body.editId) : null; // ประกาศก่อนใช้ (บล็อกสต๊อคด้านล่างต้องรู้ว่าเป็นการแก้ไขไหม)
  // สต๊อค: ลงใหม่ขั้นต่ำ 1 · แก้ไขยอมให้ 0 ได้ (ของหมดคือหมด — ห้ามใช้ || เพราะจะเหมา 0 เป็น "ไม่มีค่า" แล้วเด้งเป็น 1)
  // สต๊อคผู้ขายกรอกเอง = อย่างน้อย 1 เสมอ ทุกโหมด — เลข 0 เป็นของระบบเท่านั้น (ตัดตอนขายจริงผ่าน escrow)
  // ต้องการปิดการขาย → ปุ่ม "ทำเครื่องหมายขายแล้ว" (ประตูเดียวต่อหนึ่งงาน)
  const stock = Math.round(Number(body?.stock));
  if (!Number.isFinite(stock) || stock < 1 || stock > 999)
    return bad('จำนวนสต็อกต้องเป็น 1–999 — ต้องการปิดการขาย ใช้ปุ่ม "ทำเครื่องหมายขายแล้ว"');
  const shipMode = body?.shipMode === "free" ? "free" : "paid";
  const shipFee = Math.min(Math.max(Math.round(Number(body?.shipFee)) || 0, 0), 100000);
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter(u => typeof u === "string").slice(0, 10);
  const ratio = ["1/1", "3/4", "4/3"].includes(body?.ratio) ? body.ratio : "1/1";

  // ── validate ชุดเดียวกับฟอร์ม แต่บังคับจริงฝั่ง server ──
  if (!name) return bad("กรอกชื่อสินค้า");
  if (!Number.isFinite(price) || price <= 0 || price > 10000000) return bad("กรอกราคาให้ถูกต้อง");
  if (!catPath.length) return bad("เลือกหมวดหมู่สินค้า");
  if (!isNew && !COND_GRADES.some(g => g.key === grade)) return bad("สินค้ามือสองต้องเลือกเกรดสภาพ");
  if (!images.length) return bad("ใส่รูปสินค้าอย่างน้อย 1 รูป");

  // ── แก้ไข: ต้องเป็นสินค้าของตัวเองจริง (เช็คจาก DB ไม่เชื่อ client) ──
  let current = null;
  if (editId) {
    const { data } = await admin.from("products")
      .select("id, seller_id, status, images").eq("id", editId).single();
    if (!data || data.seller_id !== user.id) return bad("ไม่พบสินค้า หรือไม่ใช่สินค้าของคุณ", 403);
    current = data;
  }

  // ── รูปทุกใบต้องมาจากโฟลเดอร์ของตัวเองใน bucket products ──
  //    (ยกเว้นตอนแก้ไข: รูปเดิมที่อยู่ในประกาศอยู่แล้วผ่านได้เสมอ)
  const ownPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${user.id}/`;
  const oldSet = new Set(current?.images || []);
  for (const u of images) {
    if (!u.startsWith(ownPrefix) && !oldSet.has(u))
      return bad("พบรูปภาพที่ไม่ได้อัปโหลดจากบัญชีของคุณ");
  }

  // ── AUTO1: ตัวกรองเนื้อหา — ตรวจทุกช่องข้อความที่ผู้ใช้พิมพ์เองได้ ──
  const { data: bw } = await admin.from("banned_words").select("word");
  const chk = checkContent(
    [name, description, condNote, location, brand, ...issues].join("\n"),
    (bw || []).map(x => x.word)
  );
  if (!chk.ok) return bad(filterMessage(chk.hits));

  // ── PRE-1: server ด่านสุดท้าย — ไม่ใช่พรี = null เด็ดขาด (ห้าม 0) · พรี = จำนวนเต็ม 1–เพดาน ──
  let preorderDays = null;
  if (body?.preorderDays !== null && body?.preorderDays !== undefined && body?.preorderDays !== "") {
    const n = Math.round(Number(body.preorderDays));
    if (!Number.isFinite(n) || n < 1 || n > PREORDER_MAX_DAYS)
      return bad(`กำหนดวันพรีออเดอร์ต้องเป็น 1–${PREORDER_MAX_DAYS} วัน`);
    preorderDays = n;
  }

  // ── server คำนวณเองว่าต้องเข้าคิวตรวจไหม (client สั่ง status ตรงไม่ได้แล้ว) ──
  // BRAND-ADM: เช็คกับลิสต์รวม (ระบบ + แบรนด์ที่แอดมินเคยอนุมัติ) — เจอแล้วสะกดตามระบบ
  const brandHit = findBrand(await getMergedBrands(admin), brand);
  if (brandHit) brand = brandHit;
  const isNewBrand = !!brand && !brandHit;
  const isNewCat = !catPathValid(catPath); // CAT-VAL: catNodeAt แยกหมวดปลายทางจริงกับหมวดมั่วไม่ออก
  const needsReview = isNewBrand || isNewCat;
  // ลงใหม่: active (หรือ review ถ้าแบรนด์/หมวดใหม่) · แก้ไข: คงสถานะเดิม (ตรรกะเดิมของฟอร์ม)
  const status = needsReview ? "review" : (current ? current.status : "active");

  const row = {
    name, description, price,
    cat_main: catPath[0],
    cat_sub: catPath.slice(1).join(" › ") || null,
    brand: brand || null,
    cond: isNew ? "ของใหม่" : `มือสอง · ${grade}`,
    cond_label: isNew ? null : grade,
    cond_note: condNote || null,
    issues: isNew ? [] : issues,
    location: location || null,
    stock,
    preorder_days: preorderDays, // PRE-1: null = พร้อมส่ง
    shipping: shipMode === "free"
      ? { mode: "free", label: "ส่งฟรี" }
      : { mode: "paid", fee: shipFee, label: `ค่าส่ง ฿${shipFee.toLocaleString()}` },
    images,
    image_ratio: ratio,
    ...(body?.aiAssisted === true ? { ai_assisted: true } : {}), // AI-DISC: ธงหลักฐานใช้ AI กรอก — ติดแล้วไม่ถอด
    status,
  };

  const { error } = current
    ? await admin.from("products").update(row).eq("id", current.id).eq("seller_id", user.id)
    : await admin.from("products").insert({ seller_id: user.id, ...row });
  if (error) {
    console.error("products/save:", error);
    return bad("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  return NextResponse.json({ ok: true, status, needsReview });
}

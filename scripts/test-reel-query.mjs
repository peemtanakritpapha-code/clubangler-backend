// scripts/test-reel-query.mjs — REEL-1: เทส .or() ของหน้า sub กับ PostgREST จริงก่อนเชื่อ
// รัน: node scripts/test-reel-query.mjs
// *** อ่านอย่างเดียวทั้งสคริปต์ — ไม่มีคำสั่งลบ/แก้ใดๆ ***
//
// เหตุที่ต้องเทส: ค่า cat_sub มี " / " และ " › " — ต้องพิสูจน์ว่า .or() ของ supabase-js
// ส่งไป PostgREST แล้วไม่พังและกรองถูกจริง วิธีพิสูจน์: เทียบกับ "ความจริงอ้างอิง" คือ
// ดึงสินค้าทั้งหมวดรอกตกปลามากรองด้วย JS (ตรรกะเดียวกับ MarketClient เป๊ะ) — เลขต้องตรงกันทุก sub
//
// หมายเหตุ: ค่าข้างล่างก็อปจาก lib/reelSubs.js (import ตรงๆ ไม่ได้ — โปรเจกต์ไม่ใช่ type:module)
// มีด่านกันเพี้ยนด้านล่าง: อ่านไฟล์ lib/reelSubs.js จริงมาตรวจว่าค่ายังตรงกันก่อนเริ่มเทส
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const REEL_CAT = "รอกตกปลา";
const REEL_SUBS = [
  { slug: "สปินนิ่ง", sub: "รอกสปินนิ่ง" },
  { slug: "เบทหยดน้ำ", sub: "รอกหยดน้ำ / เบทโปรไฟล์ต่ำ" },
  { slug: "เบทกลม-ทะเล", sub: "รอกเบทกลม / รอกทะเล" },
];

// ── ด่านกันเพี้ยน: ค่าทุกตัวต้องปรากฏใน lib/reelSubs.js จริง ──
const src = fs.readFileSync("lib/reelSubs.js", "utf8");
for (const r of REEL_SUBS) {
  if (!src.includes(`"${r.slug}"`) || !src.includes(`"${r.sub}"`)) {
    console.error(`❌ ค่า "${r.slug}" / "${r.sub}" ไม่ตรงกับ lib/reelSubs.js — ไฟล์ถูกแก้? อัปเดตสคริปต์นี้ให้ตรงก่อน`);
    process.exit(1);
  }
}

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

// ── 1) ความจริงอ้างอิง: ดึงทั้งหมวดแล้วกรองด้วย JS ──
const { data: all, error: allErr } = await db
  .from("products")
  .select("id, cat_sub, status")
  .eq("cat_main", REEL_CAT)
  .in("status", ["active", "sold"])
  .limit(2000);
if (allErr) { console.error("❌ ดึงทั้งหมวดพัง:", allErr.message); process.exit(1); }
console.log(`หมวด "${REEL_CAT}" มีสินค้า active+sold ทั้งหมด ${all.length} ชิ้น\n`);

let fail = 0;
for (const r of REEL_SUBS) {
  // ตรรกะเดียวกับ MarketClient: ตรงตัว หรือขึ้นต้นด้วย "sub › "
  const expect = all.filter(p => (p.cat_sub || "") === r.sub || (p.cat_sub || "").startsWith(r.sub + " › "));

  // ── 2) query แบบเดียวกับหน้าเพจจริง ──
  const { data: got, error } = await db
    .from("products")
    .select("id, cat_sub, status")
    .eq("cat_main", REEL_CAT)
    .or(`cat_sub.eq.${r.sub},cat_sub.like.${r.sub} › %`)
    .in("status", ["active", "sold"])
    .limit(2000);

  if (error) {
    console.log(`❌ /${r.slug} — .or() พัง: ${error.message}`);
    fail++;
    continue;
  }
  const ok = got.length === expect.length &&
    got.every(g => expect.some(e => e.id === g.id));
  console.log(`${ok ? "✅" : "❌"} /${r.slug} (${r.sub}) — .or() ได้ ${got.length} ชิ้น · กรองด้วย JS ได้ ${expect.length} ชิ้น ${ok ? "ตรงกัน" : "ไม่ตรงกัน!"}`);
  if (got[0]) console.log(`   ตัวอย่าง cat_sub: "${got[0].cat_sub}"`);
  if (!ok) fail++;
}

console.log(fail === 0
  ? "\n🎉 ผ่านทุกประเภท — เชื่อ .or() ในหน้าเพจได้เลย"
  : `\n⚠️ ไม่ผ่าน ${fail} ประเภท — ห้าม deploy หน้า sub จนกว่าจะแก้ (ส่งผลนี้ให้ AI ดู)`);
process.exit(fail === 0 ? 0 : 1);

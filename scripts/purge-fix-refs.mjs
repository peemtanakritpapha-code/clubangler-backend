// scripts/purge-fix-refs.mjs — เก็บกวาดหลังเหตุ sweep เกินขอบเขต (13 ก.ค.):
//   ไฟล์รูปโพสต์/โปรไฟล์/หน้าปกถูกลบจาก storage ไปแล้ว (กู้ไม่ได้)
//   สคริปต์นี้ล้าง "path ที่ชี้ไฟล์ตาย" ใน DB ให้ว่าง เพื่อให้ fallback ตัวอักษรทำงานแทนรูปแตก
//   แตะแค่: posts.images / posts.image_url / profiles.avatar_path / profiles.cover_path
// รันดูก่อน:  node scripts/purge-fix-refs.mjs
// ล้างจริง:   node scripts/purge-fix-refs.mjs --confirm FIX-REFS
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const CONFIRM = process.argv.includes("--confirm") && process.argv[process.argv.indexOf("--confirm") + 1] === "FIX-REFS";

const { data: posts, error: e1 } = await db.from("posts").select("id, image_url, images");
if (e1) { console.log("[FAIL] posts:", e1.message); process.exit(1); }
const dirtyPosts = posts.filter(p => (Array.isArray(p.images) && p.images.length) || p.image_url);

const { data: profs, error: e2 } = await db.from("profiles").select("id, name, avatar_path, cover_path");
if (e2) { console.log("[FAIL] profiles:", e2.message); process.exit(1); }
const dirtyProfs = profs.filter(p => p.avatar_path || p.cover_path);

console.log("========== PURGE-FIX-REFS ==========");
console.log(`โพสต์ที่มี path รูปตายค้าง: ${dirtyPosts.length} จาก ${posts.length}`);
console.log(`โปรไฟล์ที่มี avatar/cover ตายค้าง: ${dirtyProfs.length} จาก ${profs.length}`);
for (const p of dirtyProfs) console.log(`  - ${p.name || p.id}: ${p.avatar_path ? "avatar" : ""} ${p.cover_path ? "cover" : ""}`);

if (!CONFIRM) {
  console.log("\n>>> โหมดดูอย่างเดียว — ล้างจริง: node scripts/purge-fix-refs.mjs --confirm FIX-REFS");
  process.exit(0);
}

if (dirtyPosts.length) {
  const { error } = await db.from("posts").update({ images: [], image_url: null })
    .in("id", dirtyPosts.map(p => p.id));
  if (error) { console.log("[FAIL] ล้าง posts:", error.message); process.exit(1); }
  console.log(`[OK] ล้าง path รูปใน posts ${dirtyPosts.length} โพสต์ (ข้อความ/ไลก์/คอมเมนต์อยู่ครบ)`);
}
if (dirtyProfs.length) {
  const { error } = await db.from("profiles").update({ avatar_path: null, cover_path: null })
    .in("id", dirtyProfs.map(p => p.id));
  if (error) { console.log("[FAIL] ล้าง profiles:", error.message); process.exit(1); }
  console.log(`[OK] ล้าง avatar/cover ${dirtyProfs.length} โปรไฟล์ (ชื่อ/ข้อมูลอยู่ครบ — อัพรูปใหม่ได้เลย)`);
}
console.log("\n========== เสร็จ — รีเฟรชหน้าฟีด รูปแตกต้องกลายเป็นวงกลมตัวอักษร ==========");

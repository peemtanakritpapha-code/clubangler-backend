// scripts/purge-verify.mjs — ตรวจหลัง PURGE: นับของที่เหลือจริง (อ่านอย่างเดียว)
// รัน: node scripts/purge-verify.mjs
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const count = async (table, mod) => {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (mod) q = mod(q);
  const { count: c, error } = await q;
  return error ? `ERR: ${error.message}` : c;
};

console.log("========== PURGE-VERIFY ==========");
console.log("products ทั้งหมด:", await count("products"));
console.log("orders ทั้งหมด:", await count("orders"));
console.log("posts ที่แนบสินค้า:", await count("posts", q => q.not("product_id", "is", null)));
console.log("posts ทั้งหมด (คอมมูนิตี้ล้วน — ควรเหลือได้):", await count("posts"));

for (const bucket of ["products", "slips"]) {
  const { data, error } = await db.storage.from(bucket).list("", { limit: 100 });
  console.log(`storage/${bucket} (ชั้นบนสุด):`, error ? `ERR: ${error.message}` : `${data.length} รายการ`,
    data?.length ? "→ " + data.slice(0, 5).map(f => f.name).join(", ") : "");
}
console.log("\nเป้า: products 0 · orders 0 · posts แนบสินค้า 0");

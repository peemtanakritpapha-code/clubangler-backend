// lib/reelSubs.js — REEL-1: ตารางแม่บทหมวดย่อยรอก 3 ประเภท (แหล่งความจริงแหล่งเดียว)
// ทุกไฟล์ที่เกี่ยวกับหน้า /market/รอกตกปลา/<slug> ต้องอ่านจากไฟล์นี้เท่านั้น:
//   หน้าเพจ app/market/[cat]/[sub] · CatSlider v7 · SeoPanel · sitemap · llms.txt
// เหตุที่ต้องมี slug: ชื่อ sub จริง 2 ใน 3 มี " / " — ใส่ใน URL ตรงๆ กลายเป็น %2F พังกับ nginx
//   (บทเรียนเดียวกับหมวด "อื่นๆ / ไม่เข้าหมวด" ที่ถูกตัดจาก sitemap/llms.txt)
// ⚠️ ห้ามแก้ค่า sub — ต้องสะกดตรงกับ CATEGORY_TREE["รอกตกปลา"] ใน lib/catalog.js เป๊ะทุกตัวอักษร

export const REEL_CAT = "รอกตกปลา";

export const REEL_SUBS = [
  {
    slug: "สปินนิ่ง",              // ส่วนท้าย URL: /market/รอกตกปลา/สปินนิ่ง
    sub: "รอกสปินนิ่ง",            // ค่าจริงใน products.cat_sub (sub นี้ไม่มีลูก = ค่าตรงตัว)
    label: "รอกสปินนิ่ง",          // ข้อความบนการ์ด/h1
    img: "/cats/cat-reel-spin.png",
  },
  {
    slug: "เบทหยดน้ำ",
    sub: "รอกหยดน้ำ / เบทโปรไฟล์ต่ำ", // มีลูก 3 — cat_sub อาจเป็นค่านี้ตรงๆ หรือ "ค่านี้ › ลูก"
    label: "รอกเบทหยดน้ำ",
    img: "/cats/cat-reel-baitlow.png",
  },
  {
    slug: "เบทกลม-ทะเล",
    sub: "รอกเบทกลม / รอกทะเล",     // มีลูก 2: แดรกดาว, แดรกก้านโยก
    label: "รอกเบทกลม·ทะเล",
    img: "/cats/cat-reel-round.png",
  },
];

// หา entry จาก slug (decode แล้ว) — ไม่เจอ = null ให้หน้าเพจสั่ง notFound()
export const reelBySlug = (slug) => REEL_SUBS.find((r) => r.slug === slug) || null;

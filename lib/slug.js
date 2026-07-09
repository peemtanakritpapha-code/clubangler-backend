// lib/slug.js — SEO2: URL หน้าสินค้าแบบมีชื่อ (id นำหน้า: /product/14-ชื่อสินค้า)
// กติกา (Iron Rule 22): ลิงก์ไปหน้าสินค้าทุกจุดต้องสร้างผ่าน productPath() ที่นี่ที่เดียว
// — id อยู่หน้าเสมอ ระบบดึงสินค้าจากเลขหน้าสุด ชื่อโดนตัด/สะกดผิดลิงก์ก็ยังเปิดได้
// — ลิงก์เก่าแบบ /product/14 (ไม่มีชื่อ) ใช้ได้ตลอด ห้ามทำให้ 404

// แปลงชื่อสินค้าเป็น slug: เก็บ ไทย/อังกฤษ/ตัวเลข · ช่องว่าง→ขีด · ตัดอักขระพิเศษ · ยาวสุด 80
export function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z\u0E01-\u0E59\s-]/g, "") // ไทย U+0E01–U+0E59 ครอบพยัญชนะ/สระ/วรรณยุกต์/เลขไทย
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// path หน้าสินค้า — ใช้กับ <Link href>, router.push, sitemap
export function productPath(p) {
  if (!p?.id) return "#";
  const s = slugify(p.name);
  return s ? `/product/${p.id}-${s}` : `/product/${p.id}`;
}

// แกะ id จาก param ของหน้า /product/[id] — รับได้ทั้ง "14" และ "14-ชื่อสินค้า"
export function productIdFromParam(param) {
  return String(param || "").split("-")[0];
}

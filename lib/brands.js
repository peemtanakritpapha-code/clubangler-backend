// lib/brands.js — BRAND-ADM: ลิสต์แบรนด์รวม = ระบบ (catalog.js) + ที่แอดมินอนุมัติแล้ว (catalog_extras)
// ใช้ฝั่ง server เท่านั้น — client รับลิสต์ผ่าน props จาก page ของตัวเอง
import { ALL_BRANDS } from "@/lib/catalog";

export async function getExtraBrands(db) {
  try {
    const { data } = await db.from("catalog_extras").select("name").eq("kind", "brand");
    return (data || []).map(r => String(r.name || "").trim()).filter(Boolean);
  } catch { return []; } // ตารางยังไม่มี/อ่านพลาด = ระบบเดินต่อด้วยลิสต์ในโค้ด
}

export async function getMergedBrands(db) {
  const extra = await getExtraBrands(db);
  return Array.from(new Set([...ALL_BRANDS, ...extra])).sort((a, b) => a.localeCompare(b));
}

// หาแบรนด์ในลิสต์แบบไม่สนตัวพิมพ์ — เจอ = คืนตัวสะกดตามระบบ
export function findBrand(list, brand) {
  const q = String(brand || "").trim().toLowerCase();
  return q ? (list.find(b => b.toLowerCase() === q) || null) : null;
}

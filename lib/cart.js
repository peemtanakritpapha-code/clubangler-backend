// lib/cart.js — ตะกร้าฝั่ง client (localStorage) — A3
// ตรรกะยกจาก prototype (addToCart/removeFromCart/clearCart บรรทัด 4147–4152):
// - ใส่ซ้ำชิ้นเดิมไม่ได้ (สินค้ามือสอง สต็อกชิ้นเดียว)
// - เก็บ snapshot ขั้นต่ำไว้โชว์ทันที — หน้า /cart จะดึงข้อมูลสดจาก DB มาตรวจอีกชั้นเสมอ
"use client";

const KEY = "ca_cart_v1";
const EVT = "ca-cart-change";

const read = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const write = (items) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  // แจ้งทุกคอมโพเนนต์ในแท็บนี้ (badge ฯลฯ) — ข้ามแท็บใช้ storage event ของเบราว์เซอร์เอง
  window.dispatchEvent(new Event(EVT));
};

export const getCart = () => read();
export const cartCount = () => read().length;
export const inCart = (id) => read().some(x => String(x.id) === String(id));

// เพิ่มลงตะกร้า — คืน { ok, reason } · reason: "dup" = มีอยู่แล้ว (prototype: toast error)
export function addToCart(p) {
  const items = read();
  if (items.some(x => String(x.id) === String(p.id))) return { ok: false, reason: "dup" };
  items.push({
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
    img: p.img || null,
    addedAt: Date.now(),
  });
  write(items);
  return { ok: true };
}

export function removeFromCart(id) {
  write(read().filter(x => String(x.id) !== String(id)));
}

export function clearCart() {
  write([]);
}

// ติดตามจำนวนในตะกร้า (ใช้กับ badge) — คืนฟังก์ชันถอนการติดตาม
export function subscribeCart(cb) {
  const fire = () => cb(cartCount());
  window.addEventListener(EVT, fire);
  window.addEventListener("storage", fire); // เผื่อเปิดหลายแท็บ
  fire();
  return () => {
    window.removeEventListener(EVT, fire);
    window.removeEventListener("storage", fire);
  };
}

// app/cart/page.js — ตะกร้า (ชั่วคราว: ระบบตะกร้าเต็มรูปมาใน A3)
import Link from "next/link";

const C = { brand: "#0E7E8C", ink: "#17181A", muted: "#80868D", line: "#E4E2DC" };

export default function CartPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 44 }}>🧺</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: "10px 0 6px" }}>ตะกร้าสินค้า</h1>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
        ระบบตะกร้า (ซื้อหลายชิ้น จ่ายครั้งเดียว) กำลังมาเร็วๆ นี้<br />
        ตอนนี้กด <b>"ซื้อเลย"</b> จากหน้าสินค้าได้ทันที — ปลอดภัยด้วย escrow เหมือนกัน
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
        <Link href="/market" style={{ background: C.brand, color: "#fff", padding: "11px 22px", borderRadius: 10, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>🛒 ไปตลาดสินค้า</Link>
        <Link href="/orders" style={{ border: `1.5px solid ${C.brand}`, color: C.brand, padding: "11px 22px", borderRadius: 10, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>📦 ออเดอร์ของฉัน</Link>
      </div>
    </div>
  );
}

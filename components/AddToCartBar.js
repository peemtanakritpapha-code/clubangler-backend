"use client";
// components/AddToCartBar.js — ปุ่มคู่ท้ายหน้าสินค้า (A3)
// ยกจาก prototype ProductScreen บรรทัด 1225–1231:
//   [🛒 ใส่ตะกร้า] (ปุ่มขอบ) → เพิ่มลงตะกร้า + ไปหน้า /cart
//   [ซื้อเลย]      (ปุ่มทึบ) → เพิ่มลงตะกร้า + ไป checkout   ← ช่วงเปลี่ยนผ่าน: ยังใช้ /checkout/[id] เดี่ยวจนกว่าก้าว 3 เสร็จ
// toast ตาม prototype: ใส่ซ้ำ = "สินค้านี้อยู่ในตะกร้าแล้ว" (error) / สำเร็จ = "เพิ่มลงตะกร้าแล้ว"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { addToCart } from "@/lib/cart";

const C = { brand: "#0E7E8C", ink: "#101314", line: "#E5E9EA", danger: "#C0392B" };

export default function AddToCartBar({ product }) {
  const router = useRouter();
  const [toast, setToast] = useState(null); // { text, kind: "success"|"error" }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const add = () => {
    const r = addToCart(product);
    if (!r.ok && r.reason === "dup") { setToast({ text: "สินค้านี้อยู่ในตะกร้าแล้ว", kind: "error" }); return false; }
    setToast({ text: "เพิ่มลงตะกร้าแล้ว", kind: "success" });
    return true;
  };

  return (
    <div style={{ display: "flex", gap: 8, flex: "none" }}>
      {toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: 90, transform: "translateX(-50%)", zIndex: 90,
          background: toast.kind === "error" ? C.danger : "#1D7A46", color: "#fff",
          fontSize: 12.5, fontWeight: 700, padding: "10px 18px", borderRadius: 999,
          boxShadow: "0 6px 18px rgba(0,0,0,.22)", whiteSpace: "nowrap",
        }}>{toast.text}</div>
      )}
      <button onClick={() => { add(); router.push("/cart"); }}
        style={{ height: 44, padding: "0 16px", borderRadius: 10, border: `1.5px solid ${C.brand}`, background: "#fff", color: C.brand, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <ShoppingCart size={16} /> ใส่ตะกร้า
      </button>
      <button onClick={() => router.push(`/checkout/${product.id}`)}
        style={{ height: 44, padding: "0 26px", borderRadius: 10, border: "none", background: C.brand, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        ซื้อเลย
      </button>
    </div>
  );
}

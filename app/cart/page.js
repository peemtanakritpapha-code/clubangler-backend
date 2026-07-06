"use client";
// app/cart/page.js — ตะกร้าจริง (A3 ก้าว 2)
// UI ยกจาก prototype: CartScreen (มือถือ บรรทัด 1955–1991) + สรุปยอดแบบ WCart (บรรทัด 6076–6124)
// เสริมจาก prototype: ดึงข้อมูลสดจาก DB ตรวจว่าสินค้ายังพร้อมขาย (active + stock ≥ 1)
// — ของที่ขายไปแล้วระหว่างค้างตะกร้าจะติดธงแดง ต้องลบออกก่อนถึงจะไปชำระเงินได้
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, X, Fish } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCart, removeFromCart, subscribeCart } from "@/lib/cart";
import { feeFor } from "@/lib/fees";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function CartPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(null);   // null = กำลังโหลด
  const [tiers, setTiers] = useState([]);

  // โหลดตะกร้า + ข้อมูลสดจาก DB ทุกครั้งที่ตะกร้าเปลี่ยน
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const local = getCart();
      if (!local.length) { if (alive) setItems([]); return; }
      const ids = local.map(x => x.id);
      const { data: rows } = await supabase.from("products")
        .select("id, name, price, images, status, stock, shipping").in("id", ids);
      if (!alive) return;
      const byId = Object.fromEntries((rows || []).map(r => [String(r.id), r]));
      setItems(local.map(l => {
        const fresh = byId[String(l.id)];
        const ok = !!fresh && fresh.status === "active" && (fresh.stock ?? 1) >= 1;
        return {
          id: l.id,
          name: fresh?.name ?? l.name,
          price: Number(fresh?.price ?? l.price) || 0,
          img: fresh?.images?.[0] ?? l.img ?? null,
          shipFee: fresh?.shipping?.mode === "paid" ? Number(fresh.shipping.fee) || 0 : 0,
          shipLabel: fresh?.shipping?.label || "ส่งฟรี",
          ok,
        };
      }));
    };
    load();
    const un = subscribeCart(load);
    return () => { alive = false; un(); };
  }, []);  // eslint-disable-line

  // เรทค่าธรรมเนียม — อ่านไม่ได้ (เช่นยังไม่ล็อกอิน) ก็แค่ไม่โชว์แถวค่าธรรมเนียม
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fee_tiers").select("*").order("min");
      if (data?.length) setTiers(data);
    })();
  }, []);  // eslint-disable-line

  const good = useMemo(() => (items || []).filter(x => x.ok), [items]);
  const bad = useMemo(() => (items || []).filter(x => !x.ok), [items]);
  const subtotal = good.reduce((s, x) => s + x.price, 0);
  const shipping = good.reduce((s, x) => s + x.shipFee, 0);
  // กติกาเหล็ก: ค่าธรรมเนียมคิด "ต่อชิ้น" ผ่าน feeFor แล้วบวกกัน (prototype บรรทัด 1996) — ห้าม feeFor ของยอดรวม
  const buyerFee = tiers.length ? good.reduce((s, x) => s + feeFor(x.price, tiers, "buyer"), 0) : 0;
  const total = subtotal + shipping + buyerFee;
  const canPay = good.length > 0 && bad.length === 0;

  const card = { background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px 140px" }}>
      {/* W5.7b: จอกว้าง = 2 คอลัมน์ (รายการ | การ์ดสรุป sticky) ตาม prototype WCart · จอแคบยุบคอลัมน์เดียว */}
      <style>{`.cart-grid { display: grid; gap: 12px; } .cart-side { position: static; }
@media (min-width: 900px) { .cart-grid { grid-template-columns: minmax(0,1fr) 340px; align-items: start; } .cart-side { position: sticky; top: 84px; } }`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link href="/market" aria-label="กลับตลาด" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 18 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>ตะกร้าสินค้า</div>
        </div>

        {items === null ? (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "60px 0" }}>กำลังโหลดตะกร้า...</div>
        ) : items.length === 0 ? (
          /* ตะกร้าว่าง — ยกจาก prototype WCart */
          <div style={{ ...card, textAlign: "center", padding: "48px 16px" }}>
            <ShoppingCart size={44} color={C.line} style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>ตะกร้ายังว่างอยู่</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>เลือกสินค้าจากตลาด แล้วกด "ใส่ตะกร้า" ได้เลย</div>
            <Link href="/market" style={{ display: "inline-block", background: C.brand, color: "#fff", padding: "11px 22px", borderRadius: 10, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>🛒 ไปตลาดสินค้า</Link>
          </div>
        ) : (
          <div className="cart-grid">
            <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            {items.map(p => (
              <div key={p.id} style={{ ...card, display: "flex", gap: 10, alignItems: "center", opacity: p.ok ? 1 : .75, border: p.ok ? "none" : `1.5px solid ${C.danger}` }}>
                <Link href={`/product/${p.id}`} style={{ width: 52, height: 52, borderRadius: 10, background: C.brandTint, display: "flex", alignItems: "center", justifyContent: "center", color: C.brand, overflow: "hidden", flex: "none" }}>
                  {p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Fish size={22} />}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/product/${p.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Link>
                  {p.ok ? (
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.brand, marginTop: 3 }}>
                      {baht(p.price)} <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted }}>· {p.shipFee ? `ค่าส่ง ${baht(p.shipFee)}` : p.shipLabel}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: C.danger, marginTop: 3 }}>⚠ สินค้านี้ไม่พร้อมขายแล้ว — ลบออกจากตะกร้าเพื่อไปต่อ</div>
                  )}
                </div>
                <button aria-label="ลบออกจากตะกร้า" onClick={() => removeFromCart(p.id)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                  <X size={15} />
                </button>
              </div>
            ))}
            </div>

            {/* สรุปยอด — การ์ดขวา sticky (prototype WCart): ราคาสินค้า / ค่าส่ง / ค่าธรรมเนียม / ยอดรวม */}
            <div className="cart-side" style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 8 }}>สรุปคำสั่งซื้อ</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.muted }}>
                <span>ราคาสินค้า ({good.length})</span><b style={{ color: C.ink }}>{baht(subtotal)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.muted }}>
                <span>ค่าจัดส่ง</span><b style={{ color: C.ink }}>{shipping ? baht(shipping) : "ฟรี"}</b>
              </div>
              {buyerFee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.muted }}>
                  <span>ค่าธรรมเนียมผู้ซื้อ</span><b style={{ color: C.ink }}>{baht(buyerFee)}</b>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 800, color: C.ink, paddingTop: 10, marginTop: 6, borderTop: `1px solid ${C.line}` }}>
                <span>ยอดรวม (จ่ายครั้งเดียว)</span><span style={{ color: C.brand, fontSize: 18 }}>{baht(total)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                🛡 ทุกชิ้นคุ้มครองด้วย escrow แยกรายออเดอร์ — โอนก้อนเดียว สลิปเดียว ทีมงานตรวจครั้งเดียว
              </div>
              {bad.length > 0 && (
                <div style={{ fontSize: 12, color: C.danger, fontWeight: 700, marginTop: 10 }}>⚠ มีสินค้าที่ไม่พร้อมขาย {bad.length} ชิ้น — ลบออกก่อนจึงจะชำระเงินได้</div>
              )}
              <button onClick={() => canPay && router.push("/checkout")} disabled={!canPay}
                style={{ marginTop: 12, width: "100%", height: 48, borderRadius: 12, border: "none", background: C.brand, color: "#fff", fontWeight: 700, fontSize: 14, cursor: canPay ? "pointer" : "not-allowed", opacity: canPay ? 1 : .5 }}>
                ไปชำระเงิน{good.length ? ` · ${baht(total)}` : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

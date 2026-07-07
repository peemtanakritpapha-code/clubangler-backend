"use client";
// app/checkout/CheckoutCartClient.js — ยืนยันคำสั่งซื้อหลายชิ้นจ่ายครั้งเดียว (A3 ก้าว 3)
// derive จาก 2 แหล่ง:
//   - โครงที่อยู่/สมุดที่อยู่/validate 7 ช่อง: CheckoutClient.js เดิม (ซื้อเดี่ยว) — พฤติกรรมเหมือนเดิมทุกอย่าง
//   - รายการสินค้าหลายชิ้นในการ์ดเดียว + สรุปยอดรวมกลุ่ม: prototype CheckoutScreen (บรรทัด 2092–2146)
// กติกาเหล็ก: ค่าธรรมเนียมคิดต่อชิ้นผ่าน feeFor แล้วบวกกัน (prototype บรรทัด 1996)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { feeFor } from "@/lib/fees";
import { getCart, clearCart } from "@/lib/cart";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const EMPTY = { name: "", phone: "", addr: "", sub: "", district: "", province: "", zip: "" };
const REQ = ["name", "phone", "addr", "sub", "district", "province", "zip"];
const fmtAddr = a => [a.addr, a.sub && `ต.${a.sub}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`, a.zip].filter(Boolean).join(" ");

export default function CheckoutCartClient({ addresses, tiers, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(null);   // null = กำลังโหลด
  const [mode, setMode] = useState(addresses.length ? "book" : "new");
  const [selId, setSelId] = useState(addresses.find(a => a.is_default)?.id || addresses[0]?.id || null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saveToBook, setSaveToBook] = useState(true);
  const [showErr, setShowErr] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // โหลดตะกร้า + ข้อมูลสดจาก DB (ราคา/สถานะจริง ณ วินาทีจ่าย)
  useEffect(() => {
    (async () => {
      const local = getCart();
      if (!local.length) { setItems([]); return; }
      const { data: rows } = await supabase.from("products")
        .select("id, name, price, images, status, stock, shipping, cond").in("id", local.map(x => x.id));
      const byId = Object.fromEntries((rows || []).map(r => [String(r.id), r]));
      setItems(local.map(l => {
        const f = byId[String(l.id)];
        return {
          id: l.id,
          name: f?.name ?? l.name,
          price: Number(f?.price ?? l.price) || 0,
          img: f?.images?.[0] ?? l.img ?? null,
          cond: f?.cond || "",
          shipFee: f?.shipping?.mode === "paid" ? Number(f.shipping.fee) || 0 : 0,
          shipLabel: f?.shipping?.label || "ส่งฟรี",
          ok: !!f && f.status === "active" && (f.stock ?? 1) >= 1,
        };
      }));
    })();
  }, []);  // eslint-disable-line

  const bad = useMemo(() => (items || []).filter(x => !x.ok), [items]);
  const good = useMemo(() => (items || []).filter(x => x.ok), [items]);
  // สรุปยอดตาม prototype: ราคาสินค้า + ค่าส่ง + ค่าธรรมเนียมผู้ซื้อ (feeFor ต่อชิ้น) = ยอดโอนก้อนเดียว
  const subtotal = good.reduce((s, x) => s + x.price, 0);
  const shipping = good.reduce((s, x) => s + x.shipFee, 0);
  const buyerFee = good.reduce((s, x) => s + feeFor(x.price, tiers, "buyer"), 0);
  const total = subtotal + shipping + buyerFee;

  const shipTo = mode === "book" ? addresses.find(a => a.id === selId) : form;
  const missing = k => !String((shipTo || {})[k] || "").trim() || (k === "zip" && !/^[0-9]{5}$/.test(shipTo.zip || ""));
  const incomplete = !shipTo || REQ.some(missing);

  const submit = async () => {
    setErr("");
    if (bad.length) { setErr("มีสินค้าที่ไม่พร้อมขายในตะกร้า — กลับไปลบออกก่อน"); return; }
    if (!good.length) return;
    if (incomplete) { setShowErr(true); return; }
    setBusy(true);
    try {
      if (mode === "new" && saveToBook) {
        await supabase.from("addresses").insert({ ...form, user_id: userId, label: "ที่อยู่จัดส่ง", is_default: addresses.length === 0 });
      }
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: good.map(x => x.id),
          shipTo: { name: shipTo.name, phone: shipTo.phone, addr: shipTo.addr, sub: shipTo.sub, district: shipTo.district, province: shipTo.province, zip: shipTo.zip },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สั่งซื้อไม่สำเร็จ");
      clearCart();   // ออเดอร์เกิดแล้ว — ตะกร้าว่าง
      router.push(`/pay/${data.orderId}`);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const input = k => (
    <input value={form[k] || ""} placeholder={{ name: "ชื่อผู้รับ *", phone: "เบอร์โทร *", addr: "บ้านเลขที่ / ถนน / หมู่ *", sub: "ตำบล/แขวง *", district: "อำเภอ/เขต *", province: "จังหวัด *", zip: "รหัสไปรษณีย์ 5 หลัก *" }[k]}
      onChange={e => setForm({ ...form, [k]: e.target.value })}
      style={{ width: "100%", height: 40, borderRadius: 9, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none", background: "#fff", color: C.ink,
        border: `1.5px solid ${showErr && mode === "new" && missing(k) ? C.danger : C.line}` }} />
  );
  const card = { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };

  if (items === null) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center", color: C.muted, fontSize: 13, fontFamily: "inherit" }}>กำลังโหลด...</div>
  );

  if (items.length === 0) return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "60px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🧺</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, margin: "8px 0 6px" }}>ตะกร้าว่าง — ไม่มีรายการให้ชำระ</div>
      <Link href="/market" style={{ display: "inline-block", marginTop: 10, background: C.brand, color: "#fff", padding: "11px 22px", borderRadius: 10, fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>🛒 ไปตลาดสินค้า</Link>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "20px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/cart" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ ตะกร้า</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>🛒 ยืนยันคำสั่งซื้อ ({good.length} รายการ)</div>
        </div>

        {/* รายการสินค้า — prototype บรรทัด 2092–2104 */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 10 }}>รายการสินค้า ({items.length})</div>
          {items.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? `1px solid ${C.line}` : "none", opacity: p.ok ? 1 : .6 }}>
              <div style={{ width: 44, height: 44, borderRadius: 9, background: C.brandTint, color: C.brand, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>
                {p.img ? <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🎣"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                {p.ok
                  ? <div style={{ fontSize: 11, color: C.muted }}>{p.cond}{p.cond ? " · " : ""}{p.shipFee ? `ค่าส่ง ${baht(p.shipFee)}` : p.shipLabel}</div>
                  : <div style={{ fontSize: 11, color: C.danger, fontWeight: 700 }}>⚠ ไม่พร้อมขายแล้ว — กลับไปลบออกจากตะกร้า</div>}
              </div>
              <b style={{ color: C.brand, fontSize: 13.5, flex: "none" }}>{baht(p.price)}</b>
            </div>
          ))}
        </div>

        {/* ที่อยู่จัดส่ง — โครงเดียวกับ CheckoutClient เดิมทุกประการ (ที่อยู่ชุดเดียวใช้ทั้งกลุ่ม) */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>ที่อยู่จัดส่ง <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>· ใช้ที่อยู่เดียวกันทุกชิ้น</span></div>
          {addresses.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["book", "เลือกจากสมุดที่อยู่"], ["new", "กรอกใหม่"]].map(([k, label]) => (
                <div key={k} onClick={() => { setMode(k); setShowErr(false); }}
                  style={{ padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: `1.5px solid ${mode === k ? C.brand : C.line}`, background: mode === k ? C.brandTint : "#fff", color: mode === k ? C.brand : C.muted }}>
                  {label}
                </div>
              ))}
            </div>
          )}
          {mode === "book" ? (
            <div style={{ display: "grid", gap: 8 }}>
              {addresses.map(a => (
                <div key={a.id} onClick={() => setSelId(a.id)}
                  style={{ border: `1.5px solid ${selId === a.id ? C.brand : C.line}`, background: selId === a.id ? "#FAFDFD" : "#fff", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
                    {a.label} {a.is_default && <span style={{ color: C.brand, fontSize: 10.5 }}>· ค่าเริ่มต้น</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{a.name} · {a.phone}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmtAddr(a)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{input("name")}{input("phone")}</div>
              {input("addr")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{input("sub")}{input("district")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{input("province")}{input("zip")}</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: C.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={saveToBook} onChange={e => setSaveToBook(e.target.checked)} />
                บันทึกที่อยู่นี้เข้าสมุดที่อยู่
              </label>
              {showErr && incomplete && <div style={{ fontSize: 12, color: C.danger }}>กรอกที่อยู่ให้ครบทุกช่องก่อนชำระเงิน</div>}
            </div>
          )}
        </div>

        {/* สรุปยอด — prototype บรรทัด 2129–2146 */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>สรุปยอดชำระ (จ่ายครั้งเดียว)</div>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ราคาสินค้า ({good.length})</span><b>{baht(subtotal)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ค่าจัดส่ง</span><b>{shipping ? baht(shipping) : "ฟรี"}</b></div>
            {buyerFee > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ค่าธรรมเนียมผู้ซื้อ</span><b>{baht(buyerFee)}</b></div>}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 15 }}>
              <b>ยอดโอนทั้งหมด</b><b style={{ color: C.brand, fontSize: 17 }}>{baht(total)}</b>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
            🛡 โอนก้อนเดียว สลิปเดียว — ระบบแยกเป็น {good.length} ออเดอร์ คุ้มครองด้วย escrow รายชิ้น ผู้ขายแต่ละร้านได้เงินเมื่อคุณยืนยันรับสินค้าชิ้นนั้น
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
          <button onClick={submit} disabled={busy || !good.length || bad.length > 0}
            style={{ marginTop: 12, width: "100%", height: 48, border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15,
              cursor: (busy || !good.length || bad.length) ? "not-allowed" : "pointer",
              background: (!good.length || bad.length) ? "#C9D6D8" : C.brand, color: "#fff", opacity: busy ? .6 : 1 }}>
            {busy ? "กำลังสร้างคำสั่งซื้อ..." : `ยืนยันสั่งซื้อ ${good.length} รายการ · ${baht(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

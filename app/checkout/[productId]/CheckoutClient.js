"use client";
import { productPath } from "@/lib/slug";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { feeFor } from "@/lib/fees";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const EMPTY = { name: "", phone: "", addr: "", sub: "", district: "", province: "", zip: "" };
const REQ = ["name", "phone", "addr", "sub", "district", "province", "zip"];
const fmtAddr = a => [a.addr, a.sub && `ต.${a.sub}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`, a.zip].filter(Boolean).join(" ");

export default function CheckoutClient({ product: p, addresses, tiers, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState(addresses.length ? "book" : "new");   // book | new
  const [selId, setSelId] = useState(addresses.find(a => a.is_default)?.id || addresses[0]?.id || null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saveToBook, setSaveToBook] = useState(true);
  const [showErr, setShowErr] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const buyerFee = useMemo(() => feeFor(Number(p.price), tiers, "buyer"), [p, tiers]);
  const shipFee = p.shipping?.mode === "paid" ? Number(p.shipping.fee) || 0 : 0;
  const total = Number(p.price) + buyerFee + shipFee;

  const shipTo = mode === "book" ? addresses.find(a => a.id === selId) : form;
  const missing = k => !String((shipTo || {})[k] || "").trim() || (k === "zip" && !/^[0-9]{5}$/.test(shipTo.zip || ""));
  const incomplete = !shipTo || REQ.some(missing);   // กรอกไม่ครบ = จ่ายไม่ได้ (3 ชั้นตาม prototype)

  const submit = async () => {
    setErr("");
    if (incomplete) { setShowErr(true); return; }
    setBusy(true);
    try {
      if (mode === "new" && saveToBook) {
        await supabase.from("addresses").insert({ ...form, user_id: userId, label: "ที่อยู่จัดส่ง", is_default: addresses.length === 0 });
      }
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, shipTo: { name: shipTo.name, phone: shipTo.phone, addr: shipTo.addr, sub: shipTo.sub, district: shipTo.district, province: shipTo.province, zip: shipTo.zip } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สั่งซื้อไม่สำเร็จ");
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "20px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href={productPath(p)} style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ กลับ</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>🛒 ยืนยันคำสั่งซื้อ</div>
        </div>

        {/* สินค้า */}
        <div style={{ ...card, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>
            {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{p.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{p.cond} · {p.shipping?.label || "ส่งฟรี"}{Number(p.preorder_days) > 0 ? <b style={{ color: "#8A5A12" }}> · 🕒 พรีออเดอร์ ส่งใน {Number(p.preorder_days)} วัน</b> : null}</div>
          </div>
          <b style={{ color: C.brand, fontSize: 15 }}>{baht(p.price)}</b>
        </div>

        {/* ที่อยู่จัดส่ง */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>ที่อยู่จัดส่ง</div>
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

        {/* สรุปยอด */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>สรุปยอดชำระ</div>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ราคาสินค้า</span><b>{baht(p.price)}</b></div>
            {buyerFee > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ค่าธรรมเนียมผู้ซื้อ</span><b>{baht(buyerFee)}</b></div>}
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>ค่าจัดส่ง</span><b>{shipFee ? baht(shipFee) : "ฟรี"}</b></div>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 15 }}>
              <b>ยอดโอนทั้งหมด</b><b style={{ color: C.brand, fontSize: 17 }}>{baht(total)}</b>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
            🛡 เงินจะถูกฝากไว้กับ ClubAngler (escrow) — ผู้ขายได้รับเงินหลังคุณยืนยันรับสินค้าแล้วเท่านั้น
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
          <button onClick={submit} disabled={busy || incomplete}
            style={{ marginTop: 12, width: "100%", height: 48, border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: incomplete ? "not-allowed" : "pointer",
              background: incomplete ? "#C9D6D8" : C.brand, color: "#fff", opacity: busy ? .6 : 1 }}>
            {busy ? "กำลังสร้างคำสั่งซื้อ..." : `ยืนยันสั่งซื้อ · ${baht(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

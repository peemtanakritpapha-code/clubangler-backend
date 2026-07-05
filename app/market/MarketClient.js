"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CAT_MAINS } from "@/lib/catalog";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function MarketClient({ products, loggedIn }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ทั้งหมด");

  const list = useMemo(() => products.filter(p => {
    if (cat !== "ทั้งหมด" && p.cat_main !== cat) return false;
    const s = (q || "").trim().toLowerCase();
    if (s && !`${p.name} ${p.brand || ""} ${p.location || ""}`.toLowerCase().includes(s)) return false;
    return true;
  }), [products, q, cat]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif" }}>
      {/* header */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/" style={{ fontWeight: 800, color: C.brand, textDecoration: "none", whiteSpace: "nowrap" }}>🎣 ClubAngler</Link>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า แบรนด์ จังหวัด..."
            style={{ flex: 1, height: 38, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "0 16px", fontSize: 13, outline: "none", background: C.bg, color: C.ink }} />
          <Link href="/sell" style={{ background: C.brand, color: "#fff", padding: "9px 16px", borderRadius: 999, fontWeight: 800, fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>
            + ลงขาย
          </Link>
        </div>
        {/* แถบหมวดหลัก */}
        <div style={{ maxWidth: 960, margin: "10px auto 0", display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {["ทั้งหมด", ...CAT_MAINS].map(c => (
            <div key={c} onClick={() => setCat(c)}
              style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                border: `1.5px solid ${cat === c ? C.brand : C.line}`, background: cat === c ? C.brandTint : "#fff", color: cat === c ? C.brand : C.muted }}>
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* grid สินค้า */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "60px 0", fontSize: 13.5 }}>
            ยังไม่มีสินค้าในหมวดนี้ — <Link href="/sell" style={{ color: C.brand, fontWeight: 800 }}>เป็นคนแรกที่ลงขายเลย</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
            {list.map(p => (
              <Link key={p.id} href={`/product/${p.id}`} style={{ textDecoration: "none", background: "#fff", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, position: "relative" }}>
                <div style={{ aspectRatio: "1/1", background: "#EDF2F2", position: "relative" }}>
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 30 }}>🎣</div>}
                  {p.status === "sold" && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>ขายแล้ว</div>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, lineHeight: 1.35, height: 34, overflow: "hidden" }}>{p.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.brand, margin: "4px 0 2px" }}>{baht(p.price)}</div>
                  <div style={{ fontSize: 10.5, color: C.muted }}>
                    {p.cond}{p.location ? ` · ${p.location}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

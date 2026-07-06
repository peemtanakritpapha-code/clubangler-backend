"use client";
// app/my-products/MyProductsClient.js — สินค้าที่ลงขาย (W5.3)
// derive จาก prototype WMyProducts (บรรทัด 7523–7560):
//   แท็บ กำลังขาย (n) / รอตรวจ (n) / ขายแล้ว (n) · เมนู ⋯ บนการ์ด · ป้าย "ถูกระงับโดยแอดมิน"
//   กำลังขาย = active + suspended (มีป้ายแดง) · รอตรวจ = pending/review · ขายแล้ว = sold
// หมายเหตุ: "แก้ไขประกาศ" ของ prototype ยังไม่ใส่ — ระบบแก้ไขประกาศยังไม่มีหน้า (ไว้เป็นงานถัดไป)
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ChevronLeft, Fish } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function MyProductsClient({ products, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("active");
  const [menuFor, setMenuFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const active = products.filter(p => p.status === "active" || p.status === "suspended");
  const review = products.filter(p => p.status === "pending" || p.status === "review");
  const sold = products.filter(p => p.status === "sold");
  const list = tab === "active" ? active : tab === "review" ? review : sold;

  // ทำเครื่องหมายขายแล้ว ↔ ย้ายกลับไปกำลังขาย (อัปเดตสินค้าของตัวเอง)
  const setStatus = async (p, status) => {
    setMenuFor(null); setErr(""); setBusy(true);
    const { error } = await supabase.from("products").update({ status }).eq("id", p.id).eq("seller_id", userId);
    if (error) setErr(error.message || "อัปเดตไม่สำเร็จ");
    else router.refresh();
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.back()} aria-label="กลับ" style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, cursor: "pointer" }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>สินค้าที่ลงขาย</div>
        </div>

        {/* แท็บ 3 สถานะ (prototype 7535–7539) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["active", `กำลังขาย (${active.length})`], ["review", `รอตรวจ (${review.length})`], ["sold", `ขายแล้ว (${sold.length})`]].map(([k, l]) => {
            const on = tab === k;
            return (
              <span key={k} onClick={() => { setTab(k); setMenuFor(null); }}
                style={{ fontSize: 13, padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontWeight: on ? 700 : 500, border: `1px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff", color: on ? "#fff" : C.ink }}>
                {l}
              </span>
            );
          })}
        </div>

        {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{err}</div>}

        {list.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "48px 0", fontSize: 14 }}>
            {tab === "active"
              ? <>ยังไม่มีสินค้าที่กำลังลงขาย — <Link href="/sell" style={{ color: C.brand, fontWeight: 800 }}>ลงขายสินค้า</Link> เพื่อเริ่มได้เลย</>
              : tab === "review" ? "ไม่มีสินค้าที่รอตรวจสอบแบรนด์/หมวด" : "ยังไม่มีสินค้าที่ขายแล้ว"}
          </div>
        ) : (
          <div style={{ columns: "195px 4", columnGap: 12 }}>
            {list.map(p => (
              <div key={p.id} style={{ position: "relative", breakInside: "avoid", marginBottom: 12 }}>
                {/* ปุ่ม ⋯ (prototype 7545) */}
                <div onClick={e => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}
                  style={{ position: "absolute", top: 8, right: 8, zIndex: 5, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.95)", boxShadow: "0 1px 5px rgba(0,0,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <MoreHorizontal size={16} color={C.ink} />
                </div>
                {menuFor === p.id && (
                  <>
                    <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 5 }} />
                    <div style={{ position: "absolute", top: 40, right: 8, zIndex: 6, background: "#fff", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.15)", border: `1px solid ${C.line}`, overflow: "hidden", minWidth: 170 }}>
                      <Link href={`/product/${p.id}`} style={{ display: "block", padding: "10px 14px", fontSize: 12.5, color: C.ink, textDecoration: "none" }}>ดูหน้าสินค้า</Link>
                      <Link href={`/sell?edit=${p.id}`} style={{ display: "block", padding: "10px 14px", fontSize: 12.5, color: C.ink, textDecoration: "none", borderTop: `1px solid ${C.line}` }}>แก้ไขประกาศ</Link>
                      {p.status === "active" && (
                        <div onClick={() => !busy && setStatus(p, "sold")} style={{ padding: "10px 14px", fontSize: 12.5, color: C.ink, cursor: "pointer", borderTop: `1px solid ${C.line}` }}>ทำเครื่องหมายว่าขายแล้ว</div>
                      )}
                      {p.status === "sold" && (
                        <div onClick={() => !busy && setStatus(p, "active")} style={{ padding: "10px 14px", fontSize: 12.5, color: C.ink, cursor: "pointer", borderTop: `1px solid ${C.line}` }}>ย้ายกลับไปกำลังขาย</div>
                      )}
                    </div>
                  </>
                )}
                {p.status === "suspended" && (
                  <div style={{ position: "absolute", top: 8, left: 8, zIndex: 5, background: "#FBEAE8", color: C.danger, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid #F1D6D3" }}>ถูกระงับโดยแอดมิน</div>
                )}
                {(p.status === "pending" || p.status === "review") && (
                  <div style={{ position: "absolute", top: 8, left: 8, zIndex: 5, background: "#FEF6E7", color: "#B7791F", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid #F5E3BD" }}>รอตรวจสอบ</div>
                )}

                {/* การ์ดสินค้า */}
                <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
                  <div style={{ aspectRatio: p.image_ratio || "1/1", background: "#EDF2F2", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", color: C.brand }}>
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: p.status === "sold" ? "grayscale(.4)" : "none" }} />
                      : <Fish size={30} strokeWidth={1.5} />}
                    {p.status === "sold" && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center" }}>
                        <span style={{ border: "2px solid #fff", color: "#fff", fontWeight: 800, fontSize: 13, padding: "4px 14px", borderRadius: 999, transform: "rotate(-8deg)", letterSpacing: 1 }}>ขายแล้ว</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "9px 11px" }}>
                    <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, lineHeight: 1.35, minHeight: 34, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginTop: 3 }}>{baht(p.price)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

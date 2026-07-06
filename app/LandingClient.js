"use client";
// app/LandingClient.js — หน้า Landing สำหรับผู้ที่ยังไม่ล็อกอิน (W1)
// derive จาก prototype: WLanding (บรรทัด 6212) + WProductCard (5947) + WBtn (5909)
// หมายเหตุ: AnnouncementBanner ไม่ใส่ซ้ำ — AppShell แสดงให้อยู่แล้วทุกหน้า
import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Package, ShieldCheck, RotateCcw, Fish } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", bg2: "#F1F3F4", white: "#fff" };

/* ── ปุ่ม (WBtn จาก prototype — เวอร์ชันลิงก์/ปุ่ม) ── */
function LBtn({ children, variant = "primary", size = "md", href, onClick, style = {} }) {
  const s = { sm: { h: 32, px: 12, fs: 12.5 }, md: { h: 40, px: 16, fs: 13.5 }, lg: { h: 48, px: 24, fs: 15 } }[size];
  const v = {
    primary: { background: C.brand, color: "#fff", border: "none" },
    outline: { background: "transparent", color: C.brand, border: `1.5px solid ${C.brand}` },
  }[variant];
  const base = { ...v, height: s.h, padding: `0 ${s.px}px`, fontSize: s.fs, borderRadius: 9, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", textDecoration: "none", boxSizing: "border-box", fontFamily: "inherit", ...style };
  if (href) return <Link href={href} style={base}>{children}</Link>;
  return <button onClick={onClick} style={base}>{children}</button>;
}

/* ── การ์ดสินค้า (WProductCard จาก prototype — map เข้าคอลัมน์จริง) ── */
function LandingCard({ p }) {
  const s = p.seller || null;
  const name = s?.name || "บัญชีที่ถูกลบ";
  const avatar = (name || "?").trim().charAt(0).toUpperCase();
  const verified = ["approved", "verified"].includes(s?.kyc_status);
  const freeShip = (p.shipping?.mode || "free") !== "paid";
  return (
    <Link href={`/product/${p.id}`} style={{ display: "block", textDecoration: "none", background: C.white, borderRadius: 11, border: `1px solid ${C.line}`, overflow: "hidden", cursor: "pointer", transition: "transform .15s,box-shadow .15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ aspectRatio: "1/1", background: C.bg2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {p.images?.[0]
          ? <img src={p.images[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <Fish size={38} color={C.brand} strokeWidth={1.1} />}
        {freeShip && <div style={{ position: "absolute", top: 8, right: 8, background: C.brand, color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 999 }}>ส่งฟรี</div>}
        <div style={{ position: "absolute", left: 7, bottom: 7, background: "rgba(15,23,42,.72)", color: "#fff", fontWeight: 700, fontSize: 13, padding: "4px 9px", borderRadius: 8 }}>฿{Number(p.price || 0).toLocaleString()}</div>
      </div>
      <div style={{ padding: "8px 10px 9px" }}>
        <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, lineHeight: 1.35, marginBottom: 7, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 34 }}>{p.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: s?.is_shop ? "#F0A500" : C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flex: "none" }}>{avatar}</span>
          <span style={{ fontSize: 12, color: C.brand, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            {verified && <ShieldCheck size={12} style={{ flex: "none" }} />}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function LandingClient({ products = [] }) {
  const latest = products.slice(0, 4);
  // สุ่มหลัง mount เท่านั้น — render แรก (SSR + hydrate) ต้อง deterministic ไม่งั้น hydration mismatch
  const [random, setRandom] = useState(() => products.slice(0, 8));
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const a = [...products];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    setRandom(a.slice(0, 8));
  }, [seed, products]);
  const steps = [
    { icon: Lock, t: "1 · โอนเข้าบัญชีกลาง", d: "ผู้ซื้อชำระเข้าคนกลาง ไม่ใช่เข้าผู้ขายตรง" },
    { icon: Package, t: "2 · ได้ของ แล้วยืนยัน", d: "ผู้ขายส่งของ ผู้ซื้อกดยืนยันเมื่อได้รับ" },
    { icon: ShieldCheck, t: "3 · เงินถึงผู้ขาย", d: "ทีมงานโอนให้ผู้ขายในเวลาทำการ" },
  ];

  return (
    <div>
      {/* Hero — วิดีโอพื้นหลังวนซ้ำ (public/hero.mp4): autoPlay ต้องคู่กับ muted + playsInline (กติกาเบราว์เซอร์/iOS) */}
      <section style={{ position: "relative", padding: "44px 24px", textAlign: "center", background: C.bg, overflow: "hidden" }}>
        <video autoPlay muted loop playsInline preload="auto" aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }}>
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* ฟิล์มเข้มจางให้ตัวหนังสือขาวเด้ง — วิดีโอยังเห็นชัด (ปรับที่เลข .38) */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,26,32,.38)", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.white, border: `1px solid ${C.line}`, borderRadius: 999, padding: "5px 13px", fontSize: 12, color: C.brand, marginBottom: 16 }}><ShieldCheck size={15} /> ซื้อขายปลอดภัย มีคนกลางถือเงิน</div>
        <div style={{ fontSize: 25, fontWeight: 800, color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,.45)", lineHeight: 1.4, maxWidth: 520, margin: "0 auto 12px" }}>ตลาดอุปกรณ์ตกปลามือสอง ที่ไม่ต้องกลัวโดนโกง</div>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.45)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px" }}>โอนเงินเข้าบัญชีกลางก่อน ได้ของครบค่อยปล่อยให้ผู้ขาย — ปลอดภัยกว่าซื้อในกลุ่ม</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <LBtn size="lg" href="/market">เริ่มเลือกซื้อ</LBtn>
          <LBtn size="lg" variant="outline" href="/login" style={{ borderColor: "#fff", color: "#fff" }}>ลงขายสินค้า</LBtn>
        </div>
        </div>
      </section>

      {/* Escrow band */}
      <section style={{ background: C.brand, padding: "30px 24px" }}>
        <div style={{ textAlign: "center", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>ทำไมปลอดภัยกว่าซื้อในกลุ่ม Facebook</div>
        <div style={{ textAlign: "center", color: "#CDEDE4", fontSize: 13, marginBottom: 22 }}>เงินของคุณถูกพักไว้จนกว่าจะได้รับของ</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, maxWidth: 640, margin: "0 auto" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>
              <s.icon size={22} color="#fff" />
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{s.t}</div>
              <div style={{ color: "#CDEDE4", fontSize: 12.5, lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* สินค้าล่าสุด */}
      <section style={{ padding: "30px 24px 6px", background: C.white }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>สินค้าล่าสุด</div>
            <Link href="/market" style={{ fontSize: 13, color: C.brand, textDecoration: "none" }}>ดูทั้งหมด →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
            {latest.map(p => <LandingCard key={p.id} p={p} />)}
            {latest.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: "20px 0" }}>ยังไม่มีสินค้าในระบบ</div>}
          </div>
        </div>
      </section>

      {/* สไลด์สินค้าสุ่ม */}
      <section style={{ padding: "24px 0 26px", background: C.white }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>คัดมาให้คุณ</div>
              <div style={{ fontSize: 12, color: C.muted }}>สุ่มสินค้าน่าสนใจ · เลื่อนดูด้านข้าง</div>
            </div>
            <LBtn size="sm" variant="outline" onClick={() => setSeed(s => s + 1)}><RotateCcw size={14} /> สุ่มใหม่</LBtn>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 24px 8px" }}>
            {random.map(p => <div key={p.id} style={{ flex: "0 0 150px" }}><LandingCard p={p} /></div>)}
            {random.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: "12px 24px" }}>ยังไม่มีสินค้า</div>}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "34px 24px", textAlign: "center", background: C.white, borderTop: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8 }}>พร้อมเริ่มซื้อขายแบบไม่ต้องเสี่ยงแล้วหรือยัง</div>
        <p style={{ fontSize: 14, color: C.muted, margin: "0 0 18px" }}>สมัครฟรี ลงขายได้ทันที</p>
        <LBtn size="lg" href="/login">สมัครสมาชิกฟรี</LBtn>
      </section>
    </div>
  );
}

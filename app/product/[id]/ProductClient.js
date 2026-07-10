"use client";
import { productPath } from "@/lib/slug";
// app/product/[id]/ProductClient.js — หน้าสินค้าโฉมเว็บ (W5.4)
// derive จาก prototype WProduct (บรรทัด 6520–6736):
//   breadcrumb / 2 คอลัมน์: แกลเลอรี่ (รูปใหญ่ + thumbnail กดสลับ) | ชื่อ+ราคา+ปุ่มซื้อ+การ์ดผู้ขาย+
//   รายละเอียด+จุดที่ควรรู้+ตารางข้อมูลผลิตภัณฑ์+กล่อง escrow / แถวสินค้าที่คล้ายกันท้ายหน้า
// สิ่งที่จงใจต่างจาก prototype (ตามกติกา):
//   - "ซื้อเลย/ใส่ตะกร้า" ใช้ AddToCartBar เดิมของ A3 → เข้า flow /checkout จริง ไม่ทำ modal จ่ายด่วนซ้ำ
//   - ไม่มีการ์ด "ได้รับการสนับสนุน" และปุ่มหัวใจ — ระบบสปอนเซอร์/รายการโปรดยังไม่มีจริง (กติกาข้อ 18)
// จอแคบ: grid ยุบเป็นคอลัมน์เดียวอัตโนมัติ (.prod-grid ใน <style> ด้านล่าง breakpoint 900px เดียวกับ shell)
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Fish, Share2, Link2, Check } from "lucide-react"; // SHARE1
import ReportModal from "@/components/ReportModal"; // POST2
import AddToCartBar from "@/components/AddToCartBar";
import TimeLeft from "@/components/TimeLeft";
import { COND_GRADES } from "@/lib/catalog";

const C = { brand: "#0E7E8C", brandDk: "#0B5F6A", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", shop: "#F0A500" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function ProductClient({ p, seller, views, canBuy, isOwner, similar, loggedIn }) {
  // SHARE1: แชร์สินค้า — มือถือ/แอพใช้ชีตแชร์ระบบ (Web Share API) · เดสก์ท็อป fallback เมนูคัดลอก/LINE/FB
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false); // POST2
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = `${p.name} · ${baht(p.price)} — ClubAngler`;
  const doShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl }); return; } catch {}
      return; // ผู้ใช้กดยกเลิกชีตระบบ — ไม่ต้องเด้งเมนูซ้ำ
    }
    setShareOpen(o => !o);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {
      const ta = document.createElement("textarea"); ta.value = shareUrl; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setShareOpen(false); }, 1200);
  };
  const imgs = p.images?.length ? p.images : [];
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false); // lightbox ดูรูปขยายใหญ่
  const [hold, setHold] = useState(null); // ST1 6c: มีคนกำลังซื้อชิ้นนี้อยู่ไหม — poll 10 วิ
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/products/holds?ids=${p.id}`);
        const data = await res.json();
        if (!stop) setHold(data.holds?.[p.id] || null);
      } catch {}
    };
    load();
    const t = setInterval(load, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [p.id]);
  const sold = p.status === "sold";
  const verified = seller?.kyc_status === "verified";
  const sAvatar = (seller?.name || "?").trim().charAt(0).toUpperCase();
  const grade = p.cond_label ? COND_GRADES.find(g => g.key === p.cond_label) : null;
  const shipLabel = p.shipping?.mode === "paid"
    ? `฿${Number(p.shipping?.fee || 0).toLocaleString()}`
    : "จัดส่งฟรี";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit" }}>
      <style>{`.prod-grid { display: grid; grid-template-columns: 1fr; gap: 22px; align-items: start; }
@media (min-width: 900px) { .prod-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; } }`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* breadcrumb (prototype 6641–6647) */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, color: C.muted, marginBottom: 18, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: C.brand, textDecoration: "none" }}>หน้าหลัก</Link>
          <ChevronRight size={13} />
          <Link href="/market" style={{ color: C.brand, textDecoration: "none" }}>ตลาด</Link>
          <ChevronRight size={13} />
          <span>{p.cat_main || "สินค้า"}</span>
        </div>

        <div className="prod-grid" style={{ marginBottom: 34 }}>
          {/* ── แกลเลอรี่ ── */}
          <div>
            <div style={{ aspectRatio: "1/1", background: C.brandTint, borderRadius: 16, position: "relative", overflow: "hidden", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {imgs[imgIdx]
                ? <img src={imgs[imgIdx]} alt={p.name} onClick={() => setZoom(true)} title="คลิกเพื่อขยาย"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                : <Fish size={80} color={C.brand} strokeWidth={1} />}
              {sold && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center" }}>
                  <span style={{ border: "3px solid #fff", color: "#fff", fontWeight: 800, fontSize: 20, padding: "8px 24px", borderRadius: 999, transform: "rotate(-8deg)", letterSpacing: 1 }}>ขายแล้ว</span>
                </div>
              )}
              {imgs.length > 1 && (
                <span style={{ position: "absolute", right: 12, bottom: 12, background: "rgba(15,23,42,.6)", color: "#fff", fontSize: 11, padding: "3px 9px", borderRadius: 999 }}>{imgIdx + 1}/{imgs.length}</span>
              )}
            </div>
            {imgs.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {imgs.map((u, i) => (
                  <div key={i} onClick={() => setImgIdx(i)}
                    style={{ aspectRatio: "1", borderRadius: 9, border: `2px solid ${i === imgIdx ? C.brand : C.line}`, overflow: "hidden", cursor: "pointer", background: C.brandTint }}>
                    <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── ข้อมูลสินค้า ── */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.ink, lineHeight: 1.3, margin: 0, flex: 1, minWidth: 0 }}>{p.name}</h1>
              <div style={{ position: "relative", flex: "none" }}>
                <button onClick={doShare} aria-label="แชร์สินค้า" title="แชร์สินค้า"
                  style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${C.line}`, background: shareOpen ? C.brandTint : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: C.brand }}>
                  <Share2 size={17} />
                </button>
                {shareOpen && (
                  <>
                    <div onClick={() => setShareOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 210, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 10px 26px rgba(0,0,0,.12)", overflow: "hidden", zIndex: 50 }}>
                      <div onClick={copyLink} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", fontSize: 12.5, fontWeight: 600, color: copied ? C.brand : C.ink, cursor: "pointer" }}>
                        {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์"}
                      </div>
                      <a href={"https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(shareUrl)} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", fontSize: 12.5, fontWeight: 600, color: C.ink, textDecoration: "none", borderTop: `1px solid ${C.line}` }}>
                        <span style={{ width: 15, textAlign: "center", color: "#06C755", fontWeight: 900 }}>L</span> แชร์ไป LINE
                      </a>
                      <a href={"https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareUrl)} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", fontSize: 12.5, fontWeight: 600, color: C.ink, textDecoration: "none", borderTop: `1px solid ${C.line}` }}>
                        <span style={{ width: 15, textAlign: "center", color: "#1877F2", fontWeight: 900 }}>f</span> แชร์ไป Facebook
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.brand, marginBottom: 16 }}>{baht(p.price)}</div>

            {/* ปุ่มซื้อ — flow จริงของ A3 (ใส่ตะกร้า/ซื้อเลย → /checkout) */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {canBuy && hold ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, background: "#F6F9F9", border: `1.5px solid ${C.brand}`, borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: C.brand }}>🔒 มีคนกำลังทำรายการซื้อชิ้นนี้</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {hold.until
                      ? <>หากเขาไม่ชำระ สินค้าจะว่างอีกครั้งใน <TimeLeft startIso={hold.until} prefix="" clock overdueText="อีกครู่..." style={{ color: "#B7791F" }} /> — หน้านี้จะปลดล็อกให้เอง</>
                      : <>กำลังรอตรวจสอบการชำระเงิน — หากไม่สำเร็จ สินค้าจะกลับมาว่างอีกครั้ง</>}
                  </span>
                </div>
              ) : canBuy ? (
                <AddToCartBar product={{ id: p.id, name: p.name, price: p.price, img: p.images?.[0] || null }} />
              ) : (
                <span style={{ height: 44, lineHeight: "44px", padding: "0 26px", borderRadius: 10, background: "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 14 }}>
                  {isOwner ? "สินค้าของคุณ" : "ขายแล้ว"}
                </span>
              )}
            </div>

            {/* การ์ดผู้ขาย (prototype 6675–6684) — โชว์รูปโปรไฟล์จริงจาก W5.2 ถ้ามี */}
            <Link href={`/seller/${p.seller_id}`} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 16, textDecoration: "none", background: "#fff" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: seller?.is_shop ? C.shop : C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flex: "none", overflow: "hidden" }}>
                {seller?.avatar_path ? <img src={seller.avatar_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : sAvatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, display: "flex", alignItems: "center", gap: 5 }}>
                  {seller?.name || "บัญชีที่ถูกลบ"}{verified && <ShieldCheck size={14} color={C.brand} />}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{seller?.is_shop ? "ร้านค้า" : "ผู้ขาย"} · ดูโปรไฟล์ผู้ขาย</div>
              </div>
              <ChevronRight size={18} color={C.muted} />
            </Link>

            {/* รายละเอียด */}
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 7 }}>รายละเอียดสินค้า</div>
            <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>
              {p.description || "ผู้ขายยังไม่ได้ใส่รายละเอียดเพิ่มเติมสำหรับสินค้านี้"}
            </p>

            {/* จุดที่ควรรู้ก่อนซื้อ (prototype 6687–6694) */}
            {(p.issues || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 8 }}>จุดที่ควรรู้ก่อนซื้อ</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.issues.map(iss => <span key={iss} style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 999, background: "#fff", border: `1px solid ${C.line}`, color: C.ink }}>{iss}</span>)}
                </div>
                {p.cond_note && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{p.cond_note}</div>}
              </div>
            )}

            {/* ตารางข้อมูลผลิตภัณฑ์ (prototype 6695–6709) */}
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>ข้อมูลผลิตภัณฑ์</div>
            <div style={{ borderTop: `1px solid ${C.line}`, marginBottom: 16 }}>
              {[
                ["สภาพสินค้า", <span key="c">{p.cond}{p.cond_label ? ` · ${p.cond_label}` : ""}{grade?.desc ? <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 2 }}>{grade.desc}</span> : null}</span>],
                ["ประเภทการจัดส่ง", shipLabel],
                ["หมวดหมู่", <span key="cat" style={{ color: C.brand }}>{p.cat_main}{p.cat_sub ? <> <ChevronRight size={11} style={{ verticalAlign: -1 }} /> {p.cat_sub}</> : null}</span>],
                ["แบรนด์", p.brand ? <span key="b" style={{ color: C.brand }}>{p.brand}</span> : "—"],
                ["จังหวัด", p.location || "—"],
                ["ยอดเข้าชม", `${Number(views).toLocaleString()} ครั้ง`],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: "flex", padding: "11px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>
                  <span style={{ width: 120, color: C.muted, flex: "none" }}>{l}</span>
                  <span style={{ color: C.ink, flex: 1 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* กล่อง escrow (prototype 6721–6723) */}
            <div style={{ padding: 11, borderRadius: 9, background: C.brandTint, fontSize: 12, color: C.brandDk, lineHeight: 1.7 }}>
              🔒 <b>ปลอดภัยด้วย Escrow</b> — เงินของคุณถูกพักไว้กับแพลตฟอร์มจนกว่าจะได้รับสินค้า ผู้ขายได้เงินเมื่อคุณกดยืนยันรับของ
            </div>
            {/* POST2: รายงานสินค้า — ไม่โชว์กับเจ้าของ · guest กดแล้วพาไป login */}
            {!isOwner && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <span onClick={() => { if (!loggedIn) { window.location.href = "/login"; return; } setReportOpen(true); }}
                  style={{ fontSize: 12, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>
                  🚩 รายงานสินค้านี้
                </span>
              </div>
            )}
            <ReportModal open={reportOpen} onClose={() => setReportOpen(false)}
              targetType="product" targetId={p.id} targetLabel={`สินค้า: ${p.name}`} />
          </div>
        </div>

        {/* สินค้าที่คล้ายกัน (prototype 6726–6733) */}
        {similar.length > 0 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 14 }}>สินค้าที่คล้ายกับสินค้านี้</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {similar.map(x => (
                <Link key={x.id} href={productPath(x)} style={{ textDecoration: "none", background: "#fff", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
                  <div style={{ aspectRatio: "1/1", background: "#EDF2F2", display: "flex", alignItems: "center", justifyContent: "center", color: C.brand }}>
                    {x.images?.[0]
                      ? <img src={x.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : <Fish size={26} strokeWidth={1.5} />}
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.35, minHeight: 32, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{x.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginTop: 3 }}>{baht(x.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* lightbox ดูรูปขยาย: คลิกพื้นปิด · ‹ › เลื่อนรูป · ✕ ปิด */}
      {zoom && imgs[imgIdx] && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.92)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <img src={imgs[imgIdx]} alt={p.name} onClick={e => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10 }} />
          <button onClick={() => setZoom(false)} aria-label="ปิด"
            style={{ position: "fixed", top: 18, right: 18, width: 40, height: 40, borderRadius: 999, border: "none", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>✕</button>
          {imgs.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + imgs.length) % imgs.length); }} aria-label="รูปก่อนหน้า"
                style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: 999, border: "none", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 19, cursor: "pointer" }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % imgs.length); }} aria-label="รูปถัดไป"
                style={{ position: "fixed", right: 14, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: 999, border: "none", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 19, cursor: "pointer" }}>›</button>
              <span style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,.14)", padding: "5px 14px", borderRadius: 999 }}>{imgIdx + 1} / {imgs.length}</span>
            </>
          )}
        </div>
      )}

    </div>
  );
}

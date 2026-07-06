"use client";
// app/seller/[id]/SellerClient.js — หน้าร้านค้า (A4 ก้าว 1)
// UI ยกจาก prototype WSellerProfile (บรรทัด 5975–6072):
// ปก 120px ลายจุด + avatar วงกลมทับปก / ชื่อ+โล่ KYC / ปุ่มติดตาม↔กำลังติดตาม + แชร์
// กล่อง bio+ที่ตั้ง+เข้าร่วมเมื่อ+KYC / แถบสถิติ 3 ช่อง / 3 แท็บ: โพสต์ · สินค้า · เกี่ยวกับ
// ปุ่มติดตามใช้แพทเทิร์นเดียวกับ FeedClient (A2): insert/delete ตาราง follows ฝั่ง client
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Clock, ShieldCheck, Share2, Heart, MessageCircle, Package, Plus, Check, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", shop: "#F0A500" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const ago = d => { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} นาทีที่แล้ว`; if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`; return `${Math.floor(s / 86400)} วันที่แล้ว`; };

export default function SellerClient({ seller: s, products, posts, followers: followers0, sales, me, initiallyFollowing }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("โพสต์");
  const [following, setFollowing] = useState(initiallyFollowing);
  const [followers, setFollowers] = useState(followers0);
  const [copied, setCopied] = useState(false);

  const isOwner = me && me.id === s.id;
  const verified = s.kyc_status === "verified";
  const avatar = (s.name || "?").trim().charAt(0).toUpperCase();
  const joined = s.created_at ? new Date(s.created_at).toLocaleDateString("th-TH", { month: "long", year: "numeric" }) : null;
  // สินค้าขายแล้วจมท้ายรายการ (prototype บรรทัด 5981)
  const items = [...products].sort((a, b) => (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0));

  const toggleFollow = async () => {
    if (!me) { router.push("/login"); return; }
    if (following) {
      setFollowing(false); setFollowers(n => Math.max(0, n - 1));
      await supabase.from("follows").delete().eq("follower_id", me.id).eq("followee_id", s.id);
    } else {
      setFollowing(true); setFollowers(n => n + 1);
      await supabase.from("follows").insert({ follower_id: me.id, followee_id: s.id });
    }
  };

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const info = { display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: C.muted };
  const card = { background: "#fff", borderRadius: 12, border: `1px solid ${C.line}` };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", paddingBottom: 60 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ padding: "14px 20px" }}>
          <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13.5, fontFamily: "inherit" }}>
            <ChevronLeft size={17} /> กลับ
          </button>
        </div>

        <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", background: "#fff", margin: "0 20px" }}>
          {/* ปกลายจุด (prototype บรรทัด 5991–5992) */}
          <div style={{ height: 120, background: C.brand, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, opacity: .12, backgroundImage: "radial-gradient(circle,#fff 1.5px,transparent 1.5px)", backgroundSize: "22px 22px" }} />
          </div>

          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -38, position: "relative", zIndex: 1 }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: s.is_shop ? C.shop : C.brand, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, flex: "none" }}>{avatar}</div>
              <div style={{ flex: 1, paddingBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>{s.name || "ผู้ขาย"}</span>
                  {verified && <ShieldCheck size={18} color={C.brand} />}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{s.is_shop ? "ร้านค้า" : "ผู้ขาย"}</div>
              </div>
            </div>

            {!isOwner && (
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={toggleFollow} style={{
                  flex: 1, height: 42, borderRadius: 9, cursor: "pointer", fontWeight: 800, fontSize: 13.5, fontFamily: "inherit",
                  border: `1.5px solid ${C.brand}`, background: following ? "#fff" : C.brand, color: following ? C.brand : "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  {following ? <><Check size={15} /> กำลังติดตาม</> : <><Plus size={15} /> ติดตาม</>}
                </button>
                <button aria-label="แชร์" onClick={share} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 9, padding: "0 14px", cursor: "pointer" }}>
                  {copied ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.brand }}>คัดลอกแล้ว ✓</span> : <Share2 size={16} />}
                </button>
              </div>
            )}

            {/* bio + ข้อมูลร้าน (โชว์เฉพาะที่มีข้อมูลจริง) */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginTop: 16 }}>
              {s.bio && <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6, margin: "0 0 12px" }}>{s.bio}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {s.location && <div style={info}><MapPin size={16} color={C.brand} /> {s.location}</div>}
                {joined && <div style={info}><Clock size={16} color={C.brand} /> เข้าร่วมเมื่อ {joined}</div>}
                {verified && <div style={info}><ShieldCheck size={16} color={C.brand} /> ยืนยันตัวตนผู้ขายแล้ว (KYC)</div>}
                {!s.bio && !s.location && !joined && !verified && <div style={{ fontSize: 13, color: C.muted }}>ยังไม่มีข้อมูลร้าน</div>}
              </div>
            </div>

            {/* สถิติ 3 ช่อง (prototype บรรทัด 6022–6026) */}
            <div style={{ display: "flex", marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
              {[[items.length, "สินค้าที่ขาย"], [followers, "ผู้ติดตาม"], [sales, "ขายสำเร็จ"]].map((x, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px 8px", borderLeft: i > 0 ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{x[0]}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{x[1]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 แท็บ */}
          <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
            {["โพสต์", "สินค้า", "เกี่ยวกับ"].map(t => (
              <div key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: "center", padding: 12, fontSize: 13.5, fontWeight: tab === t ? 700 : 400, color: tab === t ? C.brand : C.muted, borderBottom: tab === t ? `2px solid ${C.brand}` : "2px solid transparent", cursor: "pointer" }}>{t}</div>
            ))}
          </div>

          <div style={{ padding: "16px 20px 20px", background: C.bg }}>
            {tab === "โพสต์" && (posts.length ? posts.map(f => (
              <div key={f.id} style={{ ...card, padding: 15, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: s.is_shop ? C.shop : C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>{avatar}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{ago(f.created_at)}</div>
                  </div>
                </div>
                {f.text ? <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{f.text}</p> : null}
                {f.image_url ? <div style={{ borderRadius: 10, overflow: "hidden", margin: "0 0 10px" }}><img src={f.image_url} alt="" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} /></div> : null}
                {f.products ? (
                  <Link href={`/product/${f.products.id}`} style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 10px", background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, textDecoration: "none" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 9, overflow: "hidden", background: "#EDF2F2", flex: "none" }}>
                      {f.products.images?.[0] && <img src={f.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.products.name}</div>
                      <b style={{ fontSize: 13, color: C.brand }}>{baht(f.products.price)}</b>
                    </div>
                  </Link>
                ) : null}
                <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: C.muted }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Heart size={16} /> {f.post_likes?.[0]?.count ?? 0}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MessageCircle size={16} /> {f.post_comments?.[0]?.count ?? 0}</span>
                </div>
              </div>
            )) : <div style={{ textAlign: "center", color: C.muted, fontSize: 13.5, padding: "30px 0" }}>ยังไม่มีโพสต์</div>)}

            {tab === "สินค้า" && (
              <>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>สินค้าทั้งหมด {items.length} รายการ</div>
                {items.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
                    {items.map(p => (
                      <Link key={p.id} href={`/product/${p.id}`} style={{ textDecoration: "none", background: "#fff", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
                        <div style={{ aspectRatio: "1/1", background: "#EDF2F2", position: "relative" }}>
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            : <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 26 }}>🎣</div>}
                          {p.status === "sold" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>ขายแล้ว</div>}
                        </div>
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.35, height: 32, overflow: "hidden" }}>{p.name}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginTop: 3 }}>{baht(p.price)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : <div style={{ textAlign: "center", color: C.muted, fontSize: 13.5, padding: "30px 0" }}>ยังไม่มีสินค้า</div>}
              </>
            )}

            {tab === "เกี่ยวกับ" && (
              <div style={{ ...card, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10 }}>เกี่ยวกับ {s.name}</div>
                <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.7, margin: "0 0 14px" }}>{s.bio || "ยังไม่มีข้อมูล"}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  {s.location && <div style={info}><MapPin size={16} color={C.brand} /> ที่ตั้ง: {s.location}</div>}
                  {joined && <div style={info}><Clock size={16} color={C.brand} /> เข้าร่วมเมื่อ: {joined}</div>}
                  <div style={info}><Package size={16} color={C.brand} /> ขายสำเร็จ: {sales} รายการ</div>
                  <div style={info}><ShieldCheck size={16} color={C.brand} /> สถานะ: {verified ? "ยืนยันตัวตนแล้ว" : "ยังไม่ยืนยัน"}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

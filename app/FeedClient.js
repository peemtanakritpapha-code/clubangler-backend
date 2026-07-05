"use client";
// app/FeedClient.js — ฟีดชุมชนตาม prototype: composer + 4 แท็บ + ไลก์/คอมเมนต์/ติดตาม + แถบข้าง (จอกว้าง)
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Heart, MessageCircle, Plus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", accent: "#D98A3D", danger: "#C24D42" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const FILTERS = ["ทั้งหมด", "ติดตาม", "ร้านค้า", "ประกาศ"];

const ago = t => {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "เมื่อครู่";
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  if (s < 172800) return "เมื่อวาน";
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
};
const AV = ({ name, shop }) => (
  <span style={{ width: 40, height: 40, borderRadius: 999, flex: "none", background: shop ? C.accent : C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>
    {(name || "?").trim().charAt(0).toUpperCase()}
  </span>
);

function Composer({ user, myProducts, onPosted }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [prodId, setProdId] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const canAnnounce = user?.isAdmin || user?.isShop;

  const submit = async () => {
    setErr("");
    if (!text.trim()) return;
    setBusy(true);
    try {
      let image_url = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/post-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, file);
        if (error) throw error;
        image_url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({
        author_id: user.id, text: text.trim(), image_url,
        product_id: prodId ? Number(prodId) : null,
        is_announcement: canAnnounce && announce,
      });
      if (error) throw error;
      setText(""); setFile(null); setProdId(""); setAnnounce(false);
      onPosted();
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  if (!user) return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: C.muted }}>เข้าสู่ระบบเพื่อโพสต์และพูดคุยกับนักตกปลา</span>
      <Link href="/login" style={{ background: C.brand, color: "#fff", padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>เข้าสู่ระบบ</Link>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <AV name={user.name} shop={user.isShop} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="คุณกำลังคิดอะไรอยู่..."
          style={{ flex: 1, height: 42, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "0 16px", fontSize: 13.5, outline: "none", background: "#FAFAF8" }} />
        <label title="แนบรูป" style={{ width: 42, height: 42, borderRadius: 999, border: `1px solid ${file ? C.brand : C.line}`, background: file ? C.brandTint : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: file ? C.brand : C.muted }}>
          <Camera size={18} />
          <input type="file" accept="image/*" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        {myProducts.length > 0 && (
          <select value={prodId} onChange={e => setProdId(e.target.value)}
            style={{ height: 32, border: `1px solid ${C.line}`, borderRadius: 999, padding: "0 10px", fontSize: 11.5, background: "#fff", color: C.muted, maxWidth: 220 }}>
            <option value="">🏷️ แนบสินค้าที่ขาย (ไม่บังคับ)</option>
            {myProducts.map(p => <option key={p.id} value={p.id}>{p.name} · {baht(p.price)}</option>)}
          </select>
        )}
        {canAnnounce && (
          <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 11.5, color: C.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={announce} onChange={e => setAnnounce(e.target.checked)} /> 📢 ติดป้ายประกาศ
          </label>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={submit} disabled={busy || !text.trim()}
          style={{ height: 34, padding: "0 20px", border: "none", borderRadius: 999, background: text.trim() ? C.brand : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: text.trim() ? "pointer" : "default" }}>
          {busy ? "กำลังโพสต์..." : "โพสต์"}
        </button>
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 12, color: C.danger }}>{err}</div>}
    </div>
  );
}

function PostCard({ p, user, liked0, following0, onNeedLogin }) {
  const supabase = createClient();
  const author = p.profiles || {};
  const isShop = !!author.is_shop;
  const isMine = user && p.author_id === user.id;
  const [liked, setLiked] = useState(liked0);
  const [likeN, setLikeN] = useState(p.post_likes?.[0]?.count || 0);
  const [following, setFollowing] = useState(following0);
  const [showCm, setShowCm] = useState(false);
  const [cms, setCms] = useState(null);           // null = ยังไม่โหลด
  const [cmN, setCmN] = useState(p.post_comments?.[0]?.count || 0);
  const [cmText, setCmText] = useState("");

  const toggleLike = async () => {
    if (!user) return onNeedLogin();
    if (liked) { setLiked(false); setLikeN(n => n - 1); await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id); }
    else { setLiked(true); setLikeN(n => n + 1); await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id }); }
  };
  const toggleFollow = async () => {
    if (!user) return onNeedLogin();
    if (following) { setFollowing(false); await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", p.author_id); }
    else { setFollowing(true); await supabase.from("follows").insert({ follower_id: user.id, followee_id: p.author_id }); }
  };
  const openComments = async () => {
    setShowCm(s => !s);
    if (cms === null) {
      const { data } = await supabase.from("post_comments")
        .select("*, profiles(name, is_shop)").eq("post_id", p.id).order("created_at");
      setCms(data || []);
    }
  };
  const addComment = async () => {
    if (!user) return onNeedLogin();
    const t = cmText.trim();
    if (!t) return;
    setCmText("");
    const { data } = await supabase.from("post_comments")
      .insert({ post_id: p.id, user_id: user.id, text: t })
      .select("*, profiles(name, is_shop)").single();
    if (data) { setCms(c => [...(c || []), data]); setCmN(n => n + 1); }
  };

  const badge = (txt, bg, fg) => <span style={{ fontSize: 10.5, fontWeight: 800, background: bg, color: fg, borderRadius: 999, padding: "3px 9px" }}>{txt}</span>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <AV name={author.name} shop={isShop} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13.5, color: C.ink }}>{author.name || "ผู้ใช้"}</b>
            {isShop && badge("ร้านค้า", "#FBF1E6", C.accent)}
            {p.is_announcement && badge("ประกาศ", C.brandTint, C.brand)}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>{ago(p.created_at)}</div>
        </div>
        {!isMine && user && (
          <button onClick={toggleFollow}
            style={{ height: 30, padding: "0 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
              border: `1.5px solid ${C.brand}`, background: following ? C.brandTint : "#fff", color: C.brand, display: "flex", alignItems: "center", gap: 4 }}>
            {following ? <><Check size={13} /> ติดตามแล้ว</> : <><Plus size={13} /> ติดตาม</>}
          </button>
        )}
      </div>

      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.65, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{p.text}</div>
      {p.image_url && <img src={p.image_url} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10, border: `1px solid ${C.line}` }} />}

      {p.products && (
        <Link href={`/product/${p.products.id}`} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, textDecoration: "none" }}>
          <div style={{ width: 46, height: 46, borderRadius: 9, background: "#EDF2F2", overflow: "hidden", flex: "none" }}>
            {p.products.images?.[0] && <img src={p.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.products.name}</div>
            <b style={{ fontSize: 13.5, color: C.brand }}>{baht(p.products.price)}</b>
          </div>
          <span style={{ background: C.brand, color: "#fff", fontSize: 11.5, fontWeight: 800, borderRadius: 9, padding: "8px 14px" }}>ดูสินค้า</span>
        </Link>
      )}

      <div style={{ display: "flex", gap: 18, marginTop: 10, alignItems: "center" }}>
        <button onClick={toggleLike} style={{ display: "flex", gap: 6, alignItems: "center", border: "none", background: "none", cursor: "pointer", color: liked ? C.danger : C.muted, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
          <Heart size={17} fill={liked ? C.danger : "none"} /> {likeN}
        </button>
        <button onClick={openComments} style={{ display: "flex", gap: 6, alignItems: "center", border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 12.5, fontWeight: 700, padding: 0 }}>
          <MessageCircle size={17} /> {cmN} ความเห็น
        </button>
      </div>

      {showCm && (
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: "grid", gap: 8 }}>
          {cms === null && <div style={{ fontSize: 12, color: C.muted }}>กำลังโหลด...</div>}
          {(cms || []).map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, flex: "none", background: c.profiles?.is_shop ? C.accent : C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>
                {(c.profiles?.name || "?").charAt(0).toUpperCase()}
              </span>
              <div style={{ background: "#FAFAF8", borderRadius: 10, padding: "7px 11px", flex: 1 }}>
                <b style={{ fontSize: 11.5, color: C.ink }}>{c.profiles?.name || "ผู้ใช้"}</b>
                <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{ago(c.created_at)}</span>
                <div style={{ fontSize: 12.5, color: C.ink, marginTop: 1 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {user && (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cmText} onChange={e => setCmText(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()}
                placeholder="แสดงความคิดเห็น..." style={{ flex: 1, height: 36, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "0 14px", fontSize: 12.5, outline: "none" }} />
              <button onClick={addComment} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 999, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>ส่ง</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FeedClient({ posts, latest, user, myLikes, myFollows, myProducts }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ทั้งหมด");

  const list = useMemo(() => posts.filter(p => {
    if (filter === "ติดตาม") return user && (myFollows.includes(p.author_id) || p.author_id === user.id);
    if (filter === "ร้านค้า") return !!p.profiles?.is_shop;
    if (filter === "ประกาศ") return p.is_announcement;
    return true;
  }), [posts, filter, myFollows, user]);

  const chip = on => ({ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff", color: on ? "#fff" : C.muted });

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: 14, display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }} className="feed-grid">
      <style>{`@media (min-width: 900px) { .feed-grid { grid-template-columns: minmax(0,1fr) 300px !important; } }`}</style>

      {/* คอลัมน์ฟีด */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {FILTERS.map(f => <div key={f} style={chip(filter === f)} onClick={() => setFilter(f)}>{f}</div>)}
        </div>
        <Composer user={user} myProducts={myProducts} onPosted={() => router.refresh()} />
        {list.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>
            {filter === "ติดตาม" ? "ยังไม่ได้ติดตามใคร — กดติดตามจากโพสต์ในแท็บทั้งหมดได้เลย" : "ยังไม่มีโพสต์ — เป็นคนแรกที่ทักทายชุมชนเลยครับ 🎣"}
          </div>
        )}
        {list.map(p => (
          <PostCard key={p.id} p={p} user={user}
            liked0={myLikes.includes(p.id)} following0={myFollows.includes(p.author_id)}
            onNeedLogin={() => router.push("/login")} />
        ))}
      </div>

      {/* แถบข้าง: สินค้ามาใหม่ (โชว์เฉพาะจอกว้าง ผ่าน CSS shell-web ไม่ได้ — ใช้ media query ตรงนี้) */}
      <div className="shell-web" style={{ display: "none", flexDirection: "column", gap: 10, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, position: "sticky", top: 76 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{ fontSize: 14, color: C.ink }}>🕐 สินค้ามาใหม่</b>
          <Link href="/market" style={{ fontSize: 11.5, fontWeight: 700, color: C.brand, textDecoration: "none" }}>ดูทั้งหมด ›</Link>
        </div>
        {latest.map(p => (
          <Link key={p.id} href={`/product/${p.id}`} style={{ display: "flex", gap: 10, alignItems: "center", textDecoration: "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: 9, background: "#EDF2F2", overflow: "hidden", flex: "none" }}>
              {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <b style={{ fontSize: 13, color: C.brand }}>{baht(p.price)}</b>
            </div>
          </Link>
        ))}
        {latest.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>ยังไม่มีสินค้า</span>}
      </div>
    </div>
  );
}

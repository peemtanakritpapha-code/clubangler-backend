"use client";
import { productPath } from "@/lib/slug";
// app/FeedClient.js — ฟีดชุมชนตาม prototype: composer + 4 แท็บ + ไลก์/คอมเมนต์/ติดตาม + แถบข้าง (จอกว้าง)
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Heart, MessageCircle, Plus, Check, RotateCcw, MoreHorizontal, Pencil, Trash2, X, Flag, Ban } from "lucide-react"; // POST1+POST2
import ReportModal from "@/components/ReportModal"; // POST2
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
const AV = ({ name, shop, src }) => (
  <span style={{ width: 40, height: 40, borderRadius: 999, flex: "none", background: shop ? C.accent : C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, overflow: "hidden" }}>
    {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").trim().charAt(0).toUpperCase()}
  </span>
);

function Composer({ user, myProducts, onPosted }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);           // W5.6b: แนบได้สูงสุด 4 รูป
  const [previews, setPreviews] = useState([]);
  const pickImgs = e => {
    const list = [...files, ...Array.from(e.target.files || [])].slice(0, 4);
    setFiles(list);
    setPreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return list.map(x => URL.createObjectURL(x)); });
    e.target.value = "";
  };
  const removeImg = i => {
    const list = files.filter((_, x) => x !== i);
    setFiles(list);
    setPreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return list.map(x => URL.createObjectURL(x)); });
  };
  const [prodId, setProdId] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState(""); // POST3.1: แจ้ง "รออนุมัติ"
  const canAnnounce = user?.isAdmin || user?.isShop;

  const submit = async () => {
    setErr(""); setNotice("");
    if (!text.trim()) return;
    setBusy(true);
    try {
      const imgUrls = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, file);
        if (error) throw error;
        imgUrls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      // POST3.1: สร้างโพสต์ผ่าน API — server แปะสถานะตามสวิตช์อนุมัติ + กันคนโดนแบน (Iron Rule 17 แนวเดียวกับคอมเมนต์)
      const res = await fetch("/api/posts/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), images: imgUrls, productId: prodId ? Number(prodId) : null, announce: canAnnounce && announce }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "โพสต์ไม่สำเร็จ");
      if (j.status === "pending") setNotice("✅ ส่งโพสต์แล้ว — รอแอดมินอนุมัติก่อนแสดงให้คนอื่นเห็น");
      setText(""); setFiles([]); setPreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return []; }); setProdId(""); setAnnounce(false);
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
        <AV name={user.name} shop={user.isShop} src={user.avatar} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="คุณกำลังคิดอะไรอยู่..."
          style={{ flex: 1, height: 42, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "0 16px", fontSize: 13.5, outline: "none", background: "#FAFAF8" }} />
        <label title="แนบรูป (สูงสุด 4)" style={{ width: 42, height: 42, borderRadius: 999, border: `1px solid ${files.length ? C.brand : C.line}`, background: files.length ? C.brandTint : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: files.length ? C.brand : C.muted, position: "relative" }}>
          <Camera size={18} />
          {files.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, background: C.brand, color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 3px" }}>{files.length}</span>}
          <input type="file" accept="image/*" multiple hidden onChange={pickImgs} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        {previews.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                <button type="button" onClick={() => removeImg(i)} aria-label="ลบรูปนี้"
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
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
      {notice && <div style={{ marginTop: 8, fontSize: 12, color: C.brand, fontWeight: 600 }}>{notice}</div>}
    </div>
  );
}

function PostCard({ p, user, liked0, following0, onNeedLogin, blocks, onBlock }) {
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
  const [cmErr, setCmErr] = useState(""); // AUTO1.3: โชว์เหตุผลตอนคอมเมนต์โดนบล็อก
  // POST1: แก้ไข/ลบโพสต์ตัวเอง + ลบคอมเมนต์ตัวเอง
  const [gone, setGone] = useState(false);
  const [pText, setPText] = useState(p.text);
  const [pImgs, setPImgs] = useState(p.images?.length ? p.images : (p.image_url ? [p.image_url] : []));
  const [editedAt, setEditedAt] = useState(p.edited_at || null);
  const [menu, setMenu] = useState(false);
  // POST2: รายงาน + บล็อก
  const [reportOpen, setReportOpen] = useState(false);
  const [cmReport, setCmReport] = useState(null); // {id, name} คอมเมนต์ที่กำลังรายงาน
  const [blockOpen, setBlockOpen] = useState(false);
  const doBlock = async () => {
    const { error } = await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: p.author_id });
    if (error && error.code !== "23505") { alert("บล็อกไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
    setBlockOpen(false);
    onBlock?.(p.author_id); // ฟีดกรองโพสต์/คอมเมนต์ของคนนี้ออกทันที
  };
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editImgs, setEditImgs] = useState([]);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cmDelId, setCmDelId] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // CM3: {id, name} คอมเมนต์ที่กำลังตอบ

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
        .select("*, profiles(name, is_shop, avatar_path)").eq("post_id", p.id).order("created_at");
      setCms(data || []);
    }
  };
  const addComment = async () => { // CM2: ผ่าน API เพื่อยิงแจ้งเตือนด้วย service key
    if (!user) return onNeedLogin();
    const t = cmText.trim();
    if (!t) return;
    setCmErr("");
    const res = await fetch("/api/posts/comment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: p.id, text: t, parentId: replyTo?.id || null }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.comment) {
      // สำเร็จค่อยล้างช่องพิมพ์ (AUTO1.3 — เดิมล้างก่อนส่ง พอโดนบล็อกข้อความหายเงียบ)
      setCmText(""); setCms(c => [...(c || []), j.comment]); setCmN(n => n + 1); setReplyTo(null);
    } else {
      setCmErr(j.error || "ส่งความคิดเห็นไม่สำเร็จ ลองใหม่อีกครั้ง"); // เช่น โดนตัวกรองคำต้องห้าม
    }
  };

  // POST1: บันทึกแก้ไข (ข้อความ+ถอดรูป) — ตีตรา edited_at
  const saveEdit = async () => {
    const t = editText.trim();
    if (!t || busy) return;
    setBusy(true);
    const stamp = new Date().toISOString();
    const { error } = await supabase.from("posts")
      .update({ text: t, images: editImgs, image_url: editImgs[0] || null, edited_at: stamp })
      .eq("id", p.id);
    setBusy(false);
    if (!error) { setPText(t); setPImgs(editImgs); setEditedAt(stamp); setEditing(false); }
  };
  // POST1: ลบโพสต์จริง (เจ้าของลบเอง) — เก็บกวาดรูปใน storage แบบ best-effort แล้วลบแถว (ไลก์/คอมเมนต์หายตาม cascade)
  const removePost = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const paths = pImgs.map(u => { const i = u.indexOf("/products/"); return i >= 0 ? decodeURIComponent(u.slice(i + 10)) : null; }).filter(Boolean);
      if (paths.length) await supabase.storage.from("products").remove(paths);
    } catch {}
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    setBusy(false);
    if (!error) { setDelOpen(false); setGone(true); }
  };
  const delComment = async c => { // CM1: เจ้าของคอมเมนต์ หรือเจ้าของโพสต์ (policy ฝั่ง DB คุมสิทธิ์จริง)
    const { error } = await supabase.from("post_comments").delete().eq("id", c.id);
    if (!error) {
      const rest = (cms || []).filter(x => x.id !== c.id && String(x.parent_id) !== String(c.id));
      setCms(rest);
      setCmN(rest.length);
      setCmDelId(null);
    }
  };
  if (gone) return null;

  const badge = (txt, bg, fg) => <span style={{ fontSize: 10.5, fontWeight: 800, background: bg, color: fg, borderRadius: 999, padding: "3px 9px" }}>{txt}</span>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <AV name={author.name} shop={isShop} src={author.avatar_path} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13.5, color: C.ink }}>{author.name || "ผู้ใช้"}</b>
            {isShop && badge("ร้านค้า", "#FBF1E6", C.accent)}
            {p.is_announcement && badge("ประกาศ", C.brandTint, C.brand)}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>{ago(p.created_at)}{editedAt ? " · แก้ไขแล้ว" : ""}{p.status === "pending" && <span style={{ marginLeft: 6, background: "#FEF3C7", color: "#92400E", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>⏳ รออนุมัติ</span>}</div>
        </div>
        {user && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu(m => !m)} aria-label="ตัวเลือกโพสต์"
              style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.line}`, background: menu ? "#F1F3F4" : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: C.muted }}>
              <MoreHorizontal size={16} />
            </button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 158, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 10px 26px rgba(0,0,0,.12)", overflow: "hidden", zIndex: 50 }}>
                  {isMine ? (<>
                    <div onClick={() => { setMenu(false); setEditText(pText); setEditImgs(pImgs); setEditing(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: "pointer" }}>
                      <Pencil size={14} /> แก้ไขโพสต์
                    </div>
                    <div onClick={() => { setMenu(false); setDelOpen(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: C.danger, cursor: "pointer", borderTop: `1px solid ${C.line}` }}>
                      <Trash2 size={14} /> ลบโพสต์
                    </div>
                  </>) : (<>
                    <div onClick={() => { setMenu(false); setReportOpen(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: "pointer" }}>
                      <Flag size={14} /> รายงานโพสต์
                    </div>
                    <div onClick={() => { setMenu(false); setBlockOpen(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: C.danger, cursor: "pointer", borderTop: `1px solid ${C.line}` }}>
                      <Ban size={14} /> บล็อกผู้ใช้นี้
                    </div>
                  </>)}
                </div>
              </>
            )}
          </div>
        )}
        {editing && (
          <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.42)", display: "grid", placeItems: "center", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <b style={{ fontSize: 15, color: C.ink }}>แก้ไขโพสต์</b>
                <button onClick={() => setEditing(false)} style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: C.muted }}><X size={15} /></button>
              </div>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                style={{ width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 12, padding: 12, fontSize: 13.5, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
              {editImgs.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {editImgs.map((u, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={u} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                      <button type="button" onClick={() => setEditImgs(a => a.filter((_, j) => j !== i))} aria-label="ถอดรูปนี้"
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8 }}>ถอดรูปได้ แต่เพิ่มรูปใหม่ให้ลบแล้วโพสต์ใหม่ · โพสต์จะติดป้าย "แก้ไขแล้ว"</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={() => setEditing(false)} style={{ height: 36, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, color: C.muted, cursor: "pointer" }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={busy || !editText.trim()}
                  style={{ height: 36, padding: "0 18px", borderRadius: 999, border: "none", background: editText.trim() ? C.brand : "#C9D6D8", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                  {busy ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        )}
        {delOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.42)", display: "grid", placeItems: "center", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, padding: 18 }}>
              <b style={{ fontSize: 15, color: C.ink }}>ลบโพสต์นี้?</b>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>โพสต์ รูปภาพ ไลก์ และความคิดเห็นทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={() => setDelOpen(false)} style={{ height: 36, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, color: C.muted, cursor: "pointer" }}>ยกเลิก</button>
                <button onClick={removePost} disabled={busy}
                  style={{ height: 36, padding: "0 18px", borderRadius: 999, border: "none", background: C.danger, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                  {busy ? "กำลังลบ..." : "ลบโพสต์"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* POST2: modal รายงาน (โพสต์/คอมเมนต์) + ยืนยันบล็อก */}
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)}
          targetType="post" targetId={p.id} targetLabel={`โพสต์ของ ${author.name || "ผู้ใช้"}`} />
        <ReportModal open={!!cmReport} onClose={() => setCmReport(null)}
          targetType="comment" targetId={cmReport?.id} targetLabel={`คอมเมนต์ของ ${cmReport?.name || "ผู้ใช้"}`} />
        {blockOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.42)", display: "grid", placeItems: "center", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, padding: 18 }}>
              <b style={{ fontSize: 15, color: C.ink }}>บล็อก {author.name || "ผู้ใช้"}?</b>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.8 }}>
                • คุณจะไม่เห็นโพสต์และคอมเมนต์ของเขาในฟีดอีก<br />
                • สินค้าของเขาในตลาดยังแสดงตามปกติ<br />
                • เขาจะไม่ได้รับแจ้งว่าถูกบล็อก · ปลดบล็อกได้ที่หน้าโปรไฟล์ของเขา
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={() => setBlockOpen(false)} style={{ height: 36, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, color: C.muted, cursor: "pointer" }}>ยกเลิก</button>
                <button onClick={doBlock}
                  style={{ height: 36, padding: "0 18px", borderRadius: 999, border: "none", background: C.danger, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                  บล็อก
                </button>
              </div>
            </div>
          </div>
        )}
        {!isMine && user && (
          <button onClick={toggleFollow}
            style={{ height: 30, padding: "0 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
              border: `1.5px solid ${C.brand}`, background: following ? C.brandTint : "#fff", color: C.brand, display: "flex", alignItems: "center", gap: 4 }}>
            {following ? <><Check size={13} /> ติดตามแล้ว</> : <><Plus size={13} /> ติดตาม</>}
          </button>
        )}
      </div>

      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.65, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{pText}</div>
      {(() => { // W5.6b: โพสต์หลายรูป — โพสต์เก่ามีแต่ image_url ก็ยังแสดงได้
        const pics = pImgs; // POST1: ใช้ state เพื่อสะท้อนการแก้ไขทันที
        if (!pics.length) return null;
        if (pics.length === 1) return <img src={pics[0]} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 10, border: `1px solid ${C.line}` }} />;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
            {pics.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", aspectRatio: "1/1", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
                <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </a>
            ))}
          </div>
        );
      })()}

      {p.products && (
        <Link href={productPath(p.products)} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, textDecoration: "none" }}>
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
          {(() => { // CM3: เธรด 1 ชั้น — หลักก่อน แล้วตามด้วยตอบกลับ (ย่อหน้า)
            const rowUI = (c, isReply) => (
              <div key={c.id} style={{ display: "flex", gap: 8, marginLeft: isReply ? 34 : 0 }}>
                <span style={{ width: isReply ? 24 : 28, height: isReply ? 24 : 28, borderRadius: 999, flex: "none", background: c.profiles?.is_shop ? C.accent : C.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, overflow: "hidden" }}>
                  {c.profiles?.avatar_path ? <img src={c.profiles.avatar_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.profiles?.name || "?").charAt(0).toUpperCase()}
                </span>
                <div style={{ background: "#FAFAF8", borderRadius: 10, padding: "7px 11px", flex: 1 }}>
                  <b style={{ fontSize: 11.5, color: C.ink }}>{c.profiles?.name || "ผู้ใช้"}</b>
                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{ago(c.created_at)}</span>
                  <div style={{ fontSize: 12.5, color: C.ink, marginTop: 1 }}>{c.text}</div>
                  <div style={{ marginTop: 3, display: "flex", gap: 14, alignItems: "center" }}>
                    {(user && !isReply) && (
                      <span onClick={() => setReplyTo({ id: c.id, name: c.profiles?.name || "ผู้ใช้" })}
                        style={{ fontSize: 10.5, color: C.brand, fontWeight: 700, cursor: "pointer" }}>ตอบกลับ</span>
                    )}
                    {(user && c.user_id !== user.id) && (
                      <span onClick={() => setCmReport({ id: c.id, name: c.profiles?.name || "ผู้ใช้" })}
                        style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>รายงาน</span>
                    )}
                    {(user && (c.user_id === user.id || isMine)) && (
                      cmDelId === c.id ? (
                        <span style={{ fontSize: 10.5 }}>
                          <span onClick={() => delComment(c)} style={{ color: C.danger, fontWeight: 800, cursor: "pointer" }}>ยืนยันลบ</span>
                          <span onClick={() => setCmDelId(null)} style={{ color: C.muted, marginLeft: 10, cursor: "pointer" }}>ยกเลิก</span>
                        </span>
                      ) : (
                        <span onClick={() => setCmDelId(c.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>ลบ</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
            const hidden = c => (blocks || []).includes(c.user_id); // POST2: ซ่อนคอมเมนต์คนที่บล็อก
            const tops = (cms || []).filter(c => !c.parent_id && !hidden(c));
            const kidsOf = id => (cms || []).filter(c => String(c.parent_id) === String(id) && !hidden(c));
            return tops.map(c => [rowUI(c, false), ...kidsOf(c.id).map(k => rowUI(k, true))]);
          })()}
          {user && (
            <div style={{ display: "grid", gap: 6 }}>
              {replyTo && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: C.brand, fontWeight: 700 }}>
                  <span>↩ กำลังตอบกลับ {replyTo.name}</span>
                  <span onClick={() => setReplyTo(null)} style={{ color: C.muted, cursor: "pointer", fontWeight: 800 }}>✕ ยกเลิก</span>
                </div>
              )}
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cmText} onChange={e => setCmText(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()}
                placeholder={replyTo ? ("ตอบกลับ " + replyTo.name + "...") : "แสดงความคิดเห็น..."} style={{ flex: 1, height: 36, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "0 14px", fontSize: 12.5, outline: "none" }} />
              <button onClick={addComment} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 999, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>ส่ง</button>
              </div>
              {cmErr && <div style={{ marginTop: 6, fontSize: 11.5, color: C.danger, fontWeight: 600 }}>{cmErr}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FeedClient({ posts, latest, user, myLikes, myFollows, myProducts, myBlocks }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ทั้งหมด");
  const [blocks, setBlocks] = useState(myBlocks || []); // POST2: อัปเดตสดเมื่อกดบล็อกในฟีด

  const list = useMemo(() => posts.filter(p => {
    if (blocks.includes(p.author_id)) return false; // POST2
    if (p.status === "removed") return false; // POST3.1: soft delete — แอดมินเห็นในหลังบ้านเท่านั้น
    if (filter === "ติดตาม") return user && (myFollows.includes(p.author_id) || p.author_id === user.id);
    if (filter === "ร้านค้า") return !!p.profiles?.is_shop;
    if (filter === "ประกาศ") return p.is_announcement;
    return true;
  }), [posts, filter, myFollows, user, blocks]);

  const chip = on => ({ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff", color: on ? "#fff" : C.muted });

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: 14, display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }} className="feed-grid">
      <style>{`@media (min-width: 900px) { .feed-grid { grid-template-columns: minmax(0,1fr) 300px !important; } .feed-side { display: flex !important; } }`}</style>

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
            blocks={blocks} onBlock={id => setBlocks(b => [...b, id])}
            onNeedLogin={() => router.push("/login")} />
        ))}
      </div>

      {/* แถบข้าง: สินค้ามาใหม่ (จอกว้าง — prototype ฟีดเว็บ: หัวข้อ + ปุ่มรีเฟรชวงกลม + บรรทัดรอง) */}
      {/* หมายเหตุ W3: inline display:none + .feed-side !important ใน <style> ด้านบน = ซ่อนมือถือ/โชว์จอกว้าง */}
      <div className="feed-side" style={{ display: "none", flexDirection: "column", gap: 10, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, position: "sticky", top: 76 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{ fontSize: 14, color: C.ink }}>🕐 สินค้ามาใหม่</b>
          <button onClick={() => router.refresh()} title="รีเฟรชรายการ" style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <RotateCcw size={13} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: -4 }}>
          ลงขายล่าสุดในตลาด · <Link href="/market" style={{ color: C.brand, fontWeight: 700, textDecoration: "none" }}>ดูทั้งหมด ›</Link>
        </div>
        {latest.map(p => (
          <Link key={p.id} href={productPath(p)} style={{ display: "flex", gap: 10, alignItems: "center", textDecoration: "none" }}>
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

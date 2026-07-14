# patch-feed-search.py — FEEDSEARCH-1: ค้นหาในฟีด + รูปโปรไฟล์คลิกได้
# รันที่รากโปรเจกต์: python patch-feed-search.py
# แก้ app/FeedClient.js 10 จุด (A–J) · anchor เดี่ยว assert count == 1 ทุกจุด · กันรันซ้ำ · คง CRLF
import io, sys

PATH = "app/FeedClient.js"
MARK = "FEEDSEARCH-1"
NL = "\r\n"

src = io.open(PATH, encoding="utf-8", newline="").read()

if MARK in src:
    print("ข้าม: ไฟล์ถูก patch แล้ว (พบ marker FEEDSEARCH-1) — ไม่ทำซ้ำ")
    sys.exit(0)

def rep(tag, anchor, new):
    global src
    n = src.count(anchor)
    assert n == 1, f"[{tag}] anchor พบ {n} ครั้ง (ต้องเป็น 1) — หยุดทันที ไม่แตะไฟล์"
    src = src.replace(anchor, new)
    print(f"[{tag}] OK")

# ── A: เพิ่ม useRef ──
rep("A react import",
    'import { useMemo, useState } from "react";',
    'import { useMemo, useRef, useState } from "react";')

# ── B: เพิ่มไอคอน lucide ──
rep("B lucide import",
    'import { Camera, Heart, MessageCircle, Plus, Check, RotateCcw, MoreHorizontal, Pencil, Trash2, X, Flag, Ban } from "lucide-react"; // POST1+POST2',
    'import { Camera, Heart, MessageCircle, Plus, Check, RotateCcw, MoreHorizontal, Pencil, Trash2, X, Flag, Ban, Search, Store, MessageSquare, Users, User } from "lucide-react"; // POST1+POST2+FEEDSEARCH-1')

# ── C: การ์ดโพสต์มี id ให้เลื่อนหาได้ ──
rep("C post id",
    '    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>',
    '    <div id={`post-${p.id}`} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>')

# ── D: รูปโปรไฟล์ผู้โพสต์คลิกได้ ──
rep("D avatar link",
    '        <AV name={author.name} shop={isShop} src={author.avatar_path} />',
    '        <Link href={`/seller/${p.author_id}`} aria-label={`ดูโปรไฟล์ ${author.name || "ผู้ใช้"}`} style={{ textDecoration: "none" }}>' + NL +
    '          <AV name={author.name} shop={isShop} src={author.avatar_path} />' + NL +
    '        </Link>')

# ── E: ชื่อผู้โพสต์คลิกได้ ──
rep("E name link",
    '<b style={{ fontSize: 13.5, color: C.ink }}>{author.name || "ผู้ใช้"}</b>',
    '<Link href={`/seller/${p.author_id}`} style={{ textDecoration: "none" }}><b style={{ fontSize: 13.5, color: C.ink }}>{author.name || "ผู้ใช้"}</b></Link>')

# ── F: รูปโปรไฟล์ในคอมเมนต์คลิกได้ ──
rep("F comment avatar",
    '<span style={{ width: isReply ? 24 : 28,',
    '<span onClick={() => { window.location.href = "/seller/" + c.user_id; }} style={{ cursor: "pointer", width: isReply ? 24 : 28,')

# ── G: ชื่อคนคอมเมนต์คลิกได้ ──
rep("G comment name",
    '<b style={{ fontSize: 11.5, color: C.ink }}>{c.profiles?.name || "ผู้ใช้"}</b>',
    '<b onClick={() => { window.location.href = "/seller/" + c.user_id; }} style={{ fontSize: 11.5, color: C.ink, cursor: "pointer" }}>{c.profiles?.name || "ผู้ใช้"}</b>')

# ── H: state + ฟังก์ชันค้นหา ──
STATE = NL.join([
'',
'  // FEEDSEARCH-1: ค้นหาในฟีด — ผู้คน/ร้านค้า/โพสต์ (ตาม mock v3 · 14 ก.ค. 2569)',
'  const [sOpen, setSOpen] = useState(false);      // ช่องค้นหากางอยู่ไหม',
'  const [sQ, setSQ] = useState("");               // คำค้น',
'  const [sType, setSType] = useState("all");      // ตัวกรอง: all | people | shop | post',
'  const [sRes, setSRes] = useState(null);         // ผลจาก API (null = ยังไม่ได้ค้น)',
'  const [sBusy, setSBusy] = useState(false);',
'  const [sMsg, setSMsg] = useState("");',
'  const sTimer = useRef(null);',
'',
'  const runSearch = (q) => {                      // หน่วง 350ms ค่อยยิง — ไม่ถามเซิร์ฟเวอร์ทุกตัวอักษร',
'    setSQ(q); setSMsg("");',
'    if (sTimer.current) clearTimeout(sTimer.current);',
'    const qq = q.trim();',
'    if (qq.length < 2) { setSRes(null); setSBusy(false); return; }',
'    sTimer.current = setTimeout(async () => {',
'      setSBusy(true);',
'      try { const r = await fetch(`/api/feed/search?q=${encodeURIComponent(qq)}`); setSRes(await r.json()); }',
'      catch { setSRes({ people: [], posts: [] }); }',
'      setSBusy(false);',
'    }, 350);',
'  };',
'  const toggleSearch = () => setSOpen(o => { if (o) { setSQ(""); setSRes(null); setSType("all"); setSMsg(""); } return !o; });',
'  const gotoPost = (id) => {                      // เลื่อนไปโพสต์ + กะพริบกรอบให้เห็น',
'    const el = document.getElementById(`post-${id}`);',
'    if (!el) { setSMsg("โพสต์นี้เก่ากว่า 40 รายการล่าสุดของฟีด — อ่านเนื้อหาได้จากการ์ดผลค้นหาครับ"); return; }',
'    setSOpen(false); setSQ(""); setSRes(null); setSType("all");',
'    setTimeout(() => {',
'      el.scrollIntoView({ behavior: "smooth", block: "center" });',
'      el.style.transition = "box-shadow .3s"; el.style.boxShadow = `0 0 0 3px ${C.brand}`;',
'      setTimeout(() => { el.style.boxShadow = "none"; }, 1800);',
'    }, 60);',
'  };',
'  const hiText = (t) => {                         // ไฮไลต์คำค้นในข้อความ',
'    const q = sQ.trim(); const i = (t || "").toLowerCase().indexOf(q.toLowerCase());',
'    if (i < 0 || !q) return t;',
'    return <>{t.slice(0, i)}<mark style={{ background: "#FFE9A8", borderRadius: 3, padding: "0 2px" }}>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;',
'  };',
'  const sPeople = (sRes?.people || []).filter(x => sType === "all" ? true : sType === "shop" ? x.is_shop : sType === "people" ? !x.is_shop : false);',
'  const sPosts = (sType === "all" || sType === "post") ? (sRes?.posts || []) : [];',
])
rep("H states",
    '  const [blocks, setBlocks] = useState(myBlocks || []); // POST2: อัปเดตสดเมื่อกดบล็อกในฟีด',
    '  const [blocks, setBlocks] = useState(myBlocks || []); // POST2: อัปเดตสดเมื่อกดบล็อกในฟีด' + STATE)

# ── I: ปุ่มแว่นขยายท้ายแถบแท็บ ──
rep("I search button",
    '          {FILTERS.map(f => <div key={f} style={chip(filter === f)} onClick={() => setFilter(f)}>{f}</div>)}',
    NL.join([
'          {FILTERS.map(f => <div key={f} style={chip(filter === f)} onClick={() => setFilter(f)}>{f}</div>)}',
'          <div onClick={toggleSearch} title="ค้นหาในฟีด" aria-label="ค้นหาในฟีด"',
'            style={{ marginLeft: "auto", width: 37, height: 37, borderRadius: 999, flex: "none", display: "grid", placeItems: "center", cursor: "pointer",',
'              border: `1.5px solid ${sOpen ? C.brand : C.line}`, background: sOpen ? C.brand : "#fff", color: sOpen ? "#fff" : C.muted }}>',
'            <Search size={16} />',
'          </div>',
]))

# ── J: กล่องค้นหา + ผลลัพธ์ (แทรกเหนือ Composer) ──
SEARCH_UI = NL.join([
'        {sOpen && (',
'          <div style={{ display: "grid", gap: 10 }}>',
'            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>',
'              <input value={sQ} onChange={e => runSearch(e.target.value)} placeholder="ค้นหาผู้คน ร้านค้า หรือโพสต์…" autoFocus',
'                style={{ flex: 1, minWidth: 0, padding: "11px 16px", borderRadius: 999, border: `1.5px solid ${C.brand}`, fontSize: 14, outline: "none", background: "#fff" }} />',
'              <span onClick={toggleSearch} style={{ color: C.brand, fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}>ยกเลิก</span>',
'            </div>',
'            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>',
'              {[["all", "ทั้งหมด", null], ["people", "ผู้คน", User], ["shop", "ร้านค้า", Store], ["post", "โพสต์", MessageSquare]].map(([v, label, Ic]) => (',
'                <div key={v} onClick={() => setSType(v)}',
'                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",',
'                    border: `1.5px solid ${sType === v ? C.ink : C.line}`, background: sType === v ? C.ink : "#fff", color: sType === v ? "#fff" : C.muted }}>',
'                  {Ic && <Ic size={12} />}{label}',
'                </div>',
'              ))}',
'            </div>',
'            {sQ.trim().length < 2 && <div style={{ fontSize: 11.5, color: C.muted, paddingLeft: 6 }}>พิมพ์อย่างน้อย 2 ตัวอักษร</div>}',
'            {sBusy && <div style={{ fontSize: 12, color: C.muted, paddingLeft: 6 }}>กำลังค้นหา…</div>}',
'            {sMsg && <div style={{ fontSize: 11.5, color: C.accent, fontWeight: 600, paddingLeft: 6 }}>{sMsg}</div>}',
'            {sRes && !sBusy && sPeople.length > 0 && (',
'              <div>',
'                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: C.brand, margin: "2px 2px 8px" }}>',
'                  {sType === "shop" ? <Store size={14} /> : sType === "people" ? <User size={14} /> : <Users size={14} />}',
'                  {sType === "people" ? "ผู้คน" : sType === "shop" ? "ร้านค้า" : "ผู้คน & ร้านค้า"}',
'                </div>',
'                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>',
'                  {sPeople.map(x => (',
'                    <div key={x.id} onClick={() => router.push(`/seller/${x.id}`)}',
'                      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: "12px 14px", minWidth: 122, textAlign: "center", cursor: "pointer", flex: "none" }}>',
'                      <span style={{ width: 50, height: 50, borderRadius: 999, display: "inline-grid", placeItems: "center", overflow: "hidden", background: x.is_shop ? C.accent : C.brand }}>',
'                        <img src={x.avatar_path || avatarDataUri(x.name, x.is_shop)} alt="" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 999 }} />',
'                      </span>',
'                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginTop: 6, maxWidth: 118, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: "auto", marginRight: "auto" }}>{x.name || "ผู้ใช้"}</div>',
'                      <div style={{ fontSize: 10.5, color: C.muted }}>ผู้ติดตาม {x.followers}</div>',
'                      {x.is_shop && <div style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, fontSize: 10, background: "#FBF1E6", color: C.accent, borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}><Store size={10} />ร้านค้า</div>}',
'                    </div>',
'                  ))}',
'                </div>',
'              </div>',
'            )}',
'            {sRes && !sBusy && sPosts.length > 0 && (',
'              <div>',
'                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: C.brand, margin: "2px 2px 8px" }}><MessageSquare size={14} />โพสต์</div>',
'                <div style={{ display: "grid", gap: 8 }}>',
'                  {sPosts.map(x => (',
'                    <div key={x.id} onClick={() => gotoPost(x.id)}',
'                      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: 12, cursor: "pointer" }}>',
'                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>',
'                        <span style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", flex: "none", display: "inline-block", background: x.profiles?.is_shop ? C.accent : C.brand }}>',
'                          <img src={x.profiles?.avatar_path || avatarDataUri(x.profiles?.name, x.profiles?.is_shop)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />',
'                        </span>',
'                        <div><b style={{ fontSize: 12.5, color: C.ink }}>{x.profiles?.name || "ผู้ใช้"}</b><div style={{ fontSize: 10.5, color: C.muted }}>{ago(x.created_at)}</div></div>',
'                      </div>',
'                      <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{hiText(x.text)}</div>',
'                    </div>',
'                  ))}',
'                </div>',
'              </div>',
'            )}',
'            {sRes && !sBusy && sPeople.length === 0 && sPosts.length === 0 && (',
'              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "22px 0" }}>ไม่พบผลลัพธ์ — ลองคำอื่นดูครับ 🎣</div>',
'            )}',
'          </div>',
'        )}',
'        <Composer user={user} myProducts={myProducts} onPosted={() => router.refresh()} />',
])
rep("J search UI",
    '        <Composer user={user} myProducts={myProducts} onPosted={() => router.refresh()} />',
    SEARCH_UI)

io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("เขียนไฟล์เรียบร้อย —", PATH)

# ── ตรวจสมดุลวงเล็บ (JSX ใช้ node --check ไม่ได้) ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"วงเล็บ {a}{b} ไม่สมดุล: {ca} vs {cb}"
print("วงเล็บสมดุลครบ ✓ เสร็จสมบูรณ์")

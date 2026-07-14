# patch-perks-swipe.py — W1.9: การ์ดจุดขายบนมือถือ → แถวเดียวปัดเลื่อน (แบบ A ที่เคาะ)
# มือถือ/แอพ: การ์ดกว้าง 72% ปัดแล้วดูดล็อกทีละใบ + จุดบอกตำแหน่ง 4 จุด
# จอคอม: grid 4 ช่องแถวเดียว คงเดิมเป๊ะ
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-perks-swipe.py

import io, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "W1.9" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) import เพิ่ม useRef ──
A = 'import { useEffect, useState } from "react";'
B = 'import { useEffect, useRef, useState } from "react";'
src = rep(A, B, "import useRef")

# ── 2) state + handler ของแถบปัด — แทรกเหนือ const steps ──
A = "  const steps = ["
B = (
    "  // W1.9: การ์ดจุดขายมือถือ = แถวเดียวปัดเลื่อน — จับ scroll คำนวณใบที่กำลังดู (จุดขาว)" + NL
    + "  const perkRef = useRef(null);" + NL
    + "  const [perkIdx, setPerkIdx] = useState(0);" + NL
    + "  const onPerkScroll = () => {" + NL
    + "    const el = perkRef.current; if (!el) return;" + NL
    + "    const max = el.scrollWidth - el.clientWidth;" + NL
    + "    if (max <= 0) return;" + NL
    + "    setPerkIdx(Math.round((el.scrollLeft / max) * (steps.length - 1)));" + NL
    + "  };" + NL
    + "  const steps = ["
)
src = rep(A, B, "state แถบปัด")

# ── 3) แทนก้อน section การ์ดทั้งหมด ──
OLD = NL.join([
    '      <section style={{ background: C.brand, padding: small ? "20px 14px" : "30px 24px" }}>',
    '        <div style={{ display: "grid", gridTemplateColumns: small ? "1fr 1fr" : "repeat(4,1fr)", gap: small ? 9 : 12, maxWidth: 860, margin: "0 auto" }}>',
    "          {steps.map((s, i) => (",
    '            <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: small ? "10px 12px" : 16 }}>',
    "              {small ? (",
    '                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>',
    '                  <s.icon size={16} color="#fff" style={{ flex: "none" }} />',
    '                  <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{s.t}</div>',
    "                </div>",
    "              ) : (<>",
    '                <s.icon size={22} color="#fff" />',
    '                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{s.t}</div>',
    "              </>)}",
    '              <div style={{ color: "#CDEDE4", fontSize: small ? 11 : 12.5, lineHeight: 1.5 }}>{s.d}</div>',
    "            </div>",
    "          ))}",
    "        </div>",
    "      </section>",
])
NEW = NL.join([
    '      <section style={{ background: C.brand, padding: small ? "20px 0" : "30px 24px" }}>',
    "        {small ? (<>",
    "          {/* W1.9: มือถือ — แถวเดียวปัดเลื่อน ดูดล็อกทีละใบ (scroll-snap) */}",
    '          <div ref={perkRef} onScroll={onPerkScroll} style={{ display: "flex", gap: 9, overflowX: "auto", scrollSnapType: "x mandatory", padding: "0 14px", scrollbarWidth: "none" }}>',
    "            {steps.map((s, i) => (",
    '              <div key={i} style={{ flex: "none", width: "72%", scrollSnapAlign: "center", background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px" }}>',
    '                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>',
    '                  <s.icon size={16} color="#fff" style={{ flex: "none" }} />',
    '                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{s.t}</div>',
    "                </div>",
    '                <div style={{ color: "#CDEDE4", fontSize: 11.5, lineHeight: 1.5 }}>{s.d}</div>',
    "              </div>",
    "            ))}",
    "          </div>",
    '          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 10 }}>',
    '            {steps.map((_, i) => (',
    '              <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === perkIdx ? "#fff" : "rgba(255,255,255,.35)" }} />',
    "            ))}",
    "          </div>",
    "        </>) : (",
    '          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, maxWidth: 860, margin: "0 auto" }}>',
    "            {steps.map((s, i) => (",
    '              <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>',
    '                <s.icon size={22} color="#fff" />',
    '                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{s.t}</div>',
    '                <div style={{ color: "#CDEDE4", fontSize: 12.5, lineHeight: 1.5 }}>{s.d}</div>',
    "              </div>",
    "            ))}",
    "          </div>",
    "        )}",
    "      </section>",
])
src = rep(OLD, NEW, "ก้อน section การ์ด")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.9 มือถือปัดเลื่อนแถวเดียว + จุดบอกตำแหน่ง (คอมเดิม) · CRLF=" + str(crlf))

# patch-landing-mobilecard.py — W1.5: จูนการ์ดจุดขายบนมือถือให้กะทัดรัด
# มือถือ: ไอคอน 16px อยู่แถวเดียวกับหัวข้อ + ฟอนต์เล็กลง + padding หด + แถบเขียวบางลง
# จอคอม: คงเดิมเป๊ะทุกอย่าง
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-landing-mobilecard.py

import io, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if 'small ? "10px 12px"' in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) แถบเขียวบางลงบนมือถือ ──
A = '      <section style={{ background: C.brand, padding: "30px 24px" }}>'
B = '      <section style={{ background: C.brand, padding: small ? "20px 14px" : "30px 24px" }}>'
src = rep(A, B, "padding แถบเขียว")

# ── 2) ก้อนการ์ด: มือถือ = ไอคอน+หัวแถวเดียว / คอม = เลย์เดิม ──
A = NL.join([
    '            <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>',
    '              <s.icon size={22} color="#fff" />',
    '              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{s.t}</div>',
    '              <div style={{ color: "#CDEDE4", fontSize: 12.5, lineHeight: 1.5 }}>{s.d}</div>',
    '            </div>',
])
B = NL.join([
    '            <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: small ? "10px 12px" : 16 }}>',
    '              {small ? (',
    '                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>',
    '                  <s.icon size={16} color="#fff" style={{ flex: "none" }} />',
    '                  <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{s.t}</div>',
    '                </div>',
    '              ) : (<>',
    '                <s.icon size={22} color="#fff" />',
    '                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{s.t}</div>',
    '              </>)}',
    '              <div style={{ color: "#CDEDE4", fontSize: small ? 11 : 12.5, lineHeight: 1.5 }}>{s.d}</div>',
    '            </div>',
])
src = rep(A, B, "ก้อนการ์ด")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.5 การ์ดมือถือกะทัดรัด (ไอคอน inline + ฟอนต์เล็ก + แถบบาง) · CRLF=" + str(crlf))

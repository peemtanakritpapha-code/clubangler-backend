# patch-landing-icon.py — W1.3: ถอดหัว "ทำไมน้าๆ..." + ใส่ไอคอนคันเบ็ดหน้าซับไลน์
# ต้องมีไฟล์ public/rod-money.png ก่อนรัน (แพตช์จะเช็คให้)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-landing-icon.py

import io, os, sys

PATH = "app/LandingClient.js"

# ── เช็ครูปก่อน — กัน deploy แล้วรูปแตก ──
assert os.path.exists(os.path.join("public", "rod-money.png")), \
    "ไม่พบ public/rod-money.png — ย้ายไฟล์รูปเข้า public ก่อนแล้วค่อยรันใหม่"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "rod-money.png" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว (พบ rod-money.png ในโค้ด) — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) ถอดหัวแถบเขียวทิ้งทั้งบรรทัด ──
A = '        <div style={{ textAlign: "center", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 22 }}>ทำไมน้าๆ ย้ายมาซื้อขายที่นี่</div>' + NL
src = rep(A, "", "ถอดหัวแถบ")

# ── 2) ใส่ไอคอนหน้าซับไลน์ (จัดกึ่งกลางแนวเดียวกับข้อความ) ──
A = '<p style={{ fontSize: 15, color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.45)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px" }}>ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ</p>'
B = '<p style={{ fontSize: 15, color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.45)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><img src="/rod-money.png" alt="" style={{ width: 26, height: 26, flex: "none" }} />ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ</p>'
src = rep(A, B, "ไอคอนซับไลน์")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.3 (ถอดหัวแถบ + ไอคอนคันเบ็ดหน้าซับไลน์) · CRLF=" + str(crlf))

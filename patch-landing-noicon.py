# patch-landing-noicon.py — W1.4: ถอดไอคอนคันเบ็ดหน้าซับไลน์ออก (ย้อนเฉพาะส่วนไอคอนของ W1.3)
# หัวแถบเขียวที่ถอดไปแล้วคงเดิม ไม่แตะ
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-landing-noicon.py

import io, os, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "rod-money.png" not in src:
    print("SKIP: ไอคอนถูกถอดไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── ซับไลน์กลับเป็นข้อความล้วน (สไตล์เดิมก่อน W1.3) ──
A = '<p style={{ fontSize: 15, color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.45)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><img src="/rod-money.png" alt="" style={{ width: 26, height: 26, flex: "none" }} />ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ</p>'
B = '<p style={{ fontSize: 15, color: "rgba(255,255,255,.94)", textShadow: "0 1px 10px rgba(0,0,0,.45)", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 22px" }}>ลงขายเลย ถ้าน้าร้อน ผมรอช้อนอยู่ครับ</p>'
src = rep(A, B, "ถอดไอคอนซับไลน์")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── ลบรูปที่ไม่ใช้แล้วออกจาก public ──
p = os.path.join("public", "rod-money.png")
if os.path.exists(p):
    os.remove(p)
    print("ลบ public/rod-money.png แล้ว")

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.4 ถอดไอคอนออกแล้ว ซับไลน์กลับเป็นข้อความล้วน")

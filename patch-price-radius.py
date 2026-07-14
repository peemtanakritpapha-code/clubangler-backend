# patch-price-radius.py — GRID-8: ต้นตอกรอบใหญ่ = borderRadius 999 (pill เต็ม)
# ครึ่งวงกลมหัว-ท้ายกว้างเท่าความสูงเสมอ → ลด padding เท่าไหร่ก็ไม่รัด — เปลี่ยนเป็นมุมโค้ง 7px
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-radius.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "GRID-8" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

A = '"rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 999, padding:'
B = '"rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 7 /* GRID-8: pill กลมเต็มทำให้กรอบไม่รัด */, padding:'
src = rep(A, B, "มุมโค้งป้ายราคา")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-8 มุมโค้งป้าย 999→7 กรอบรัดตัวเลขจริง")

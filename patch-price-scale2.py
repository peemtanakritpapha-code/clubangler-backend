# patch-price-scale2.py — GRID-5: ป้ายราคาบนมือถือ/แอพยังบังภาพ → หดลงอีกขั้น
# มือถือ: 2 คอลัมน์ 86%→78% · 3 คอลัมน์ 68%→52% (เว็บคงเดิม 105/92/86)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-price-scale2.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

if "{ 2: 0.78, 3: 0.52 }" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

A = "    const m = smallScr ? { 2: 0.86, 3: 0.68 } : { 3: 1.05, 4: 0.92, 5: 0.86 };"
B = "    const m = smallScr ? { 2: 0.78, 3: 0.52 } : { 3: 1.05, 4: 0.92, 5: 0.86 }; // GRID-5: มือถือหดลงอีก (ป้ายบังภาพ)"
src = rep(A, B, "ค่าสเกลมือถือ")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-5 ป้ายมือถือหดลง (2→78% · 3→52%)")

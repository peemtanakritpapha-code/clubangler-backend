# patch-hero-spacing.py — W1.10: จัดระยะมือถือ 2 จุด (จอคอมคงเดิม)
# 1) แบดจ์โหลดแอพ: ขยับลงชิดขอบล่าง hero — เพิ่มช่องเหนือแบดจ์ + ลด padding ล่าง hero เหลือ 16px
# 2) แถบเขียวการ์ดปัด: ระยะบน-ล่างบาลานซ์ (บน 16 / ใต้จุดขาว 12)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-hero-spacing.py

import io, sys

PATH = "app/LandingClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if '"44px 24px 16px"' in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) hero: มือถือลด padding ล่างเหลือ 16px ──
A = '      <section style={{ position: "relative", padding: "44px 24px", textAlign: "center", background: C.bg, overflow: "hidden" }}>'
B = '      <section style={{ position: "relative", padding: small ? "44px 24px 16px" : "44px 24px", textAlign: "center", background: C.bg, overflow: "hidden" }}>'
src = rep(A, B, "hero padding")

# ── 2) แบดจ์: มือถือเพิ่มช่องเหนือแบดจ์ ดันลงชิดขอบล่าง ──
A = '        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>'
B = '        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: small ? 26 : 16 }}>'
src = rep(A, B, "แบดจ์ marginTop")

# ── 3) แถบเขียว: บน 16 / ล่าง 12 (คู่กับจุดขาว marginTop 10 → สายตาบาลานซ์) ──
A = 'padding: small ? "20px 0" : "30px 24px"'
B = 'padding: small ? "16px 0 12px" : "30px 24px"'
src = rep(A, B, "แถบเขียว padding")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.10 จัดระยะแบดจ์+แถบเขียวมือถือ")

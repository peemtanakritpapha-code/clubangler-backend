# patch-badges-official.py — W1.7: เปลี่ยนปุ่มดำ custom (W1.6) → รูปแบดจ์ทางการ Apple/Google
# ต้องมี public/badge-appstore.png และ public/badge-googleplay.png ก่อนรัน (แพตช์เช็คให้)
# ลิงก์ปลายทางคงเดิม: App Store จริง / Google Play = ลิงก์สมัคร tester ช่วง closed testing
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-badges-official.py

import io, os, sys

PATH = "app/LandingClient.js"

for p in ["badge-appstore.png", "badge-googleplay.png"]:
    assert os.path.exists(os.path.join("public", p)), \
        f"ไม่พบ public/{p} — ย้ายไฟล์รูปเข้า public ก่อนแล้วค่อยรันใหม่"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "badge-appstore.png" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── แทนบล็อกแบดจ์ W1.6 ทั้งก้อนด้วยรูปทางการ ──
A = NL.join([
    '        {/* W1.6: แบดจ์โหลดแอพ — Android ช่วง closed testing ชี้ลิงก์สมัคร tester (เปิด public แล้วแก้ href+ข้อความตรงนี้จุดเดียว) */}',
    '        <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>',
    '          <a href="https://apps.apple.com/th/app/id6789353247" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "7px 16px", textDecoration: "none", textAlign: "left" }}>',
    '            <span><span style={{ display: "block", fontSize: 10, opacity: .85, lineHeight: 1.2 }}>ดาวน์โหลดบน</span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>App Store</span></span>',
    "          </a>",
    '          <a href="https://play.google.com/apps/testing/com.clubangler.app" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "7px 16px", textDecoration: "none", textAlign: "left" }}>',
    '            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">🤖</span>',
    '            <span><span style={{ display: "block", fontSize: 10, opacity: .85, lineHeight: 1.2 }}>Android — Google Play</span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>ร่วมทดสอบ Alpha ก่อนใคร</span></span>',
    "          </a>",
    "        </div>",
])
B = NL.join([
    '        {/* W1.7: แบดจ์ทางการ Apple/Google — Android ช่วง closed testing ชี้ลิงก์สมัคร tester (เปิด public แล้วแก้ href จุดเดียว) */}',
    '        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>',
    '          <a href="https://apps.apple.com/th/app/id6789353247" target="_blank" rel="noopener noreferrer"><img src="/badge-appstore.png" alt="Download on the App Store" style={{ height: 42, display: "block" }} /></a>',
    '          <a href="https://play.google.com/apps/testing/com.clubangler.app" target="_blank" rel="noopener noreferrer"><img src="/badge-googleplay.png" alt="Get it on Google Play" style={{ height: 42, display: "block" }} /></a>',
    "        </div>",
])
src = rep(A, B, "บล็อกแบดจ์ W1.6 → รูปทางการ")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: LandingClient.js → W1.7 แบดจ์ทางการ Apple/Google · CRLF=" + str(crlf))

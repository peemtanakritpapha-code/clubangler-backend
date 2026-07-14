# patch-app-badges.py — W1.6: ชวนโหลดแอพ เฟส 1
# 1) app/layout.js  : เพิ่ม itunes appId → Safari บน iPhone เด้ง Smart App Banner เองอัตโนมัติ
# 2) LandingClient  : แถวแบดจ์ปุ่มดำใต้ปุ่ม CTA — App Store จริง + Android "ร่วมทดสอบ Alpha ก่อนใคร"
#    (Android ชี้ลิงก์สมัคร tester ช่วง closed testing — เปิด public แล้วค่อยแก้ข้อความ/ลิงก์จุดเดียว)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-app-badges.py

import io, sys

IOS_URL = "https://apps.apple.com/th/app/id6789353247"
AND_URL = "https://play.google.com/apps/testing/com.clubangler.app"

def load(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def save(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def rep(src, old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

done = 0

# ════ 1) layout.js — Smart App Banner ════
P1 = "app/layout.js"
src = load(P1)
if "itunes" in src:
    print("SKIP layout.js: itunes ลงไปแล้ว")
else:
    crlf = "\r\n" in src
    NL = "\r\n" if crlf else "\n"
    A = '  description: "ตลาดซื้อขายอุปกรณ์ตกปลา แบบมีคนกลางถือเงิน (escrow)",'
    B = A + NL + '  itunes: { appId: "6789353247" }, // W1.6: Safari iOS เด้งแถบ "ดูใน App Store" ให้เอง'
    src = rep(src, A, B, "layout itunes")
    save(P1, src)
    print("OK layout.js: เพิ่ม Smart App Banner (CRLF=" + str(crlf) + ")")
    done += 1

# ════ 2) LandingClient.js — แถวแบดจ์ ════
P2 = "app/LandingClient.js"
src = load(P2)
if "apps.apple.com" in src:
    print("SKIP LandingClient.js: แบดจ์ลงไปแล้ว")
else:
    crlf = "\r\n" in src
    NL = "\r\n" if crlf else "\n"
    A = NL.join([
        '          <LBtn size="lg" variant="outline" href="/login" style={{ borderColor: "#fff", color: "#fff" }}>ลงขายสินค้า</LBtn>',
        "        </div>",
    ])
    BADGES = NL.join([
        '          <LBtn size="lg" variant="outline" href="/login" style={{ borderColor: "#fff", color: "#fff" }}>ลงขายสินค้า</LBtn>',
        "        </div>",
        '        {/* W1.6: แบดจ์โหลดแอพ — Android ช่วง closed testing ชี้ลิงก์สมัคร tester (เปิด public แล้วแก้ href+ข้อความตรงนี้จุดเดียว) */}',
        '        <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>',
        '          <a href="' + IOS_URL + '" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "7px 16px", textDecoration: "none", textAlign: "left" }}>',
        '            <span><span style={{ display: "block", fontSize: 10, opacity: .85, lineHeight: 1.2 }}>ดาวน์โหลดบน</span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>App Store</span></span>',
        "          </a>",
        '          <a href="' + AND_URL + '" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, padding: "7px 16px", textDecoration: "none", textAlign: "left" }}>',
        '            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">🤖</span>',
        '            <span><span style={{ display: "block", fontSize: 10, opacity: .85, lineHeight: 1.2 }}>Android — Google Play</span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>ร่วมทดสอบ Alpha ก่อนใคร</span></span>',
        "          </a>",
        "        </div>",
    ])
    src = rep(src, A, BADGES, "แถวแบดจ์ใต้ CTA")
    save(P2, src)
    # sanity check วงเล็บ
    for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
        ca, cb = src.count(a), src.count(b)
        assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"
    print("OK LandingClient.js: เพิ่มแถวแบดจ์ปุ่มดำ (CRLF=" + str(crlf) + ")")
    done += 1

print(("OK: W1.6 เสร็จ %d ส่วน" % done) if done else "SKIP: ทุกส่วนลงไปแล้ว — ไม่ทำอะไร")

# patch-consent1b-fix.py — CONSENT-1b (ฉบับแก้: ตรวจ CRLF/LF ต่อไฟล์อัตโนมัติ)
# ทำงานแทน patch-consent1b.py ทั้งหมด — ส่วนที่ลงไปแล้วจะ SKIP เอง (marker)
# รันจาก root: python patch-consent1b-fix.py
import io, os, sys

MARKER = "CONSENT-1"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def eol_of(src):
    return "\r\n" if "\r\n" in src else "\n"

def after_line(src, anchor, add_lines, path):
    EOL = eol_of(src)
    n = src.count(anchor)
    assert n == 1, "ANCHOR ERROR %s: %d of %r — STOP" % (path, n, anchor[:40])
    le = src.index(EOL, src.index(anchor)) + len(EOL)
    return src[:le] + EOL.join(add_lines) + EOL + src[le:]

def rep(src, old, new, path):
    n = src.count(old)
    assert n == 1, "REPLACE ERROR %s: %d of %r — STOP" % (path, n, old[:40])
    return src.replace(old, new)

def bal(t):
    for a, b in [("(", ")"), ("{", "}"), ("[", "]")]:
        assert t.count(a) == t.count(b), "BALANCE ERROR — STOP"

# ---------- (1) components/ConsentBuyModal.js ----------
PM = "components/ConsentBuyModal.js"
ML = [
'// components/ConsentBuyModal.js — CONSENT-1: popup จุดที่ 2 ยอมรับกติกาก่อนยืนยันสั่งซื้อ',
'// เลขวันดึงจาก platform_config (auto_confirm_days) — แอดมินแก้ได้ ข้อความเปลี่ยนตาม',
'"use client";',
'import Link from "next/link";',
'',
'const C = { brand: "#0E7E8C", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", danger: "#C0392B" };',
'',
'export default function ConsentBuyModal({ open, days, busy, onAccept, onClose }) {',
'  if (!open) return null;',
'  const rows = [',
'    ["📹", <>ถ่ายวิดีโอตอนแกะพัสดุทุกครั้ง <b>เริ่มถ่ายตั้งแต่ยังไม่แกะ ให้เห็นสภาพกล่องรอบด้าน</b> — เป็นหลักฐานบังคับหากต้องเปิดเคส &quot;ของไม่ตรงปก&quot;</>],',
'    ["⏱", <>ตรวจสินค้าและแจ้งปัญหา<b>ก่อนกดยืนยันรับ</b> — หากไม่กดใดๆ ระบบจะยืนยันแทนภายใน {days} วันหลังจัดส่ง แล้วโอนเงินให้ผู้ขาย</>],',
'    ["↩️", <>สินค้ามือสองซื้อขายขาด <b>ไม่รับคืนกรณีเปลี่ยนใจ</b></>],',
'    ["💰", <>กรณีได้รับอนุมัติให้คืนสินค้า <b>ผู้ซื้อเป็นผู้ชำระค่าจัดส่งคืน</b></>],',
'  ];',
'  return (',
'    <div style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>',
'      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.18)" }} onClick={e => e.stopPropagation()}>',
'        <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 12 }}>ก่อนสั่งซื้อ อ่านสักนิด 🎣</div>',
'        <div style={{ display: "grid", gap: 10 }}>',
'          {rows.map(([ic, tx], i) => (',
'            <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: C.ink, lineHeight: 1.65 }}>',
'              <span style={{ flexShrink: 0 }}>{ic}</span><span>{tx}</span>',
'            </div>',
'          ))}',
'        </div>',
'        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>',
'          <button onClick={onClose} disabled={busy} style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>',
'          <button onClick={onAccept} disabled={busy} style={{ flex: 2, height: 42, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: busy ? .6 : 1 }}>{busy ? "กำลังดำเนินการ..." : "ยอมรับและสั่งซื้อ"}</button>',
'        </div>',
'        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>การกดยอมรับถูกบันทึกเวลาไว้ ใช้อ้างอิงกรณีพิพาท · <Link href="/terms" style={{ color: C.brand, fontWeight: 700 }}>อ่านกติกาฉบับเต็ม</Link></div>',
'      </div>',
'    </div>',
'  );',
'}',
]
if os.path.exists(PM):
    print("SKIP (1): %s มีอยู่แล้ว" % PM)
else:
    write(PM, "\r\n".join(ML) + "\r\n"); print("CREATED (1): %s" % PM)

# ---------- (2) CheckoutCartClient.js ----------
P2 = "app/checkout/CheckoutCartClient.js"
s = read(P2)
if MARKER in s:
    print("SKIP (2): patched แล้ว")
else:
    s = after_line(s, 'import { getCart, clearCart } from "@/lib/cart";',
        ['import ConsentBuyModal from "@/components/ConsentBuyModal"; // CONSENT-1'], P2)
    s = rep(s, 'export default function CheckoutCartClient({ addresses, tiers, userId }) {',
        'export default function CheckoutCartClient({ addresses, tiers, userId, autoDays }) {', P2)
    s = after_line(s, 'const [busy, setBusy] = useState(false);',
        ['  const [consentOpen, setConsentOpen] = useState(false); // CONSENT-1: จุดที่ 2'], P2)
    s = rep(s, '<button onClick={submit} disabled={busy || !good.length || bad.length > 0}',
        '<button onClick={() => setConsentOpen(true)} disabled={busy || !good.length || bad.length > 0}', P2)
    EOL = eol_of(s)
    mj = '          <ConsentBuyModal open={consentOpen} days={autoDays} busy={busy} onClose={() => setConsentOpen(false)} onAccept={() => { setConsentOpen(false); submit(); }} />'
    anchor = 'ยืนยันสั่งซื้อ ${good.length} รายการ'
    n = s.count(anchor); assert n == 1, "ANCHOR ERROR (2): %d — STOP" % n
    j = s.index("</button>", s.index(anchor)); le = s.index(EOL, j) + len(EOL)
    s = s[:le] + mj + EOL + s[le:]
    bal(mj); write(P2, s); print("PATCHED (2) OK: %s" % P2)

# ---------- (2s) app/checkout/page.js ----------
P2S = "app/checkout/page.js"
s = read(P2S)
if MARKER in s:
    print("SKIP (2s): patched แล้ว")
else:
    s = after_line(s, 'const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");',
        ['  const { data: cfgRows } = await supabase.from("platform_config").select("auto_confirm_days").limit(1); // CONSENT-1'], P2S)
    s = rep(s, 'return <CheckoutCartClient addresses={addresses || []} tiers={tiers || []} userId={user.id} />;',
        'return <CheckoutCartClient addresses={addresses || []} tiers={tiers || []} userId={user.id} autoDays={Number(cfgRows?.[0]?.auto_confirm_days) || 5} />;', P2S)
    write(P2S, s); print("PATCHED (2s) OK: %s [EOL=%s]" % (P2S, "CRLF" if eol_of(s) == "\r\n" else "LF"))

# ---------- (3) CheckoutClient.js ----------
P3 = "app/checkout/[productId]/CheckoutClient.js"
s = read(P3)
if MARKER in s:
    print("SKIP (3): patched แล้ว")
else:
    s = after_line(s, 'import { feeFor } from "@/lib/fees";',
        ['import ConsentBuyModal from "@/components/ConsentBuyModal"; // CONSENT-1'], P3)
    s = rep(s, 'export default function CheckoutClient({ product: p, addresses, tiers, userId }) {',
        'export default function CheckoutClient({ product: p, addresses, tiers, userId, autoDays }) {', P3)
    s = after_line(s, 'const [busy, setBusy] = useState(false);',
        ['  const [consentOpen, setConsentOpen] = useState(false); // CONSENT-1: จุดที่ 2'], P3)
    s = rep(s, '<button onClick={submit} disabled={busy || incomplete}',
        '<button onClick={() => setConsentOpen(true)} disabled={busy || incomplete}', P3)
    EOL = eol_of(s)
    mj = '          <ConsentBuyModal open={consentOpen} days={autoDays} busy={busy} onClose={() => setConsentOpen(false)} onAccept={() => { setConsentOpen(false); submit(); }} />'
    anchor = '`ยืนยันสั่งซื้อ · ${baht(total)}`'
    n = s.count(anchor); assert n == 1, "ANCHOR ERROR (3): %d — STOP" % n
    j = s.index("</button>", s.index(anchor)); le = s.index(EOL, j) + len(EOL)
    s = s[:le] + mj + EOL + s[le:]
    bal(mj); write(P3, s); print("PATCHED (3) OK: %s" % P3)

# ---------- (3s) app/checkout/[productId]/page.js ----------
P3S = "app/checkout/[productId]/page.js"
s = read(P3S)
if MARKER in s:
    print("SKIP (3s): patched แล้ว")
else:
    s = after_line(s, 'const { data: tiers } = await supabase.from("fee_tiers").select("*").order("min");',
        ['  const { data: cfgRows } = await supabase.from("platform_config").select("auto_confirm_days").limit(1); // CONSENT-1'], P3S)
    s = rep(s, 'return <CheckoutClient product={product} addresses={addresses || []} tiers={tiers || []} userId={user.id} />;',
        'return <CheckoutClient product={product} addresses={addresses || []} tiers={tiers || []} userId={user.id} autoDays={Number(cfgRows?.[0]?.auto_confirm_days) || 5} />;', P3S)
    write(P3S, s); print("PATCHED (3s) OK: %s [EOL=%s]" % (P3S, "CRLF" if eol_of(s) == "\r\n" else "LF"))

# ---------- (4) /api/orders — log ----------
P4 = "app/api/orders/route.js"
s = read(P4)
if MARKER in s:
    print("SKIP (4): patched แล้ว")
else:
    EOL = eol_of(s)
    log_line = '  await admin.from("consent_logs").insert({ user_id: user.id, point: "order_terms", order_id: String(orders[0].id) }); // CONSENT-1: จุดที่ 2 — UI บังคับผ่าน popup ยอมรับก่อนถึงจุดนี้เสมอ'
    anchor = 'orderId: orders[0].id,'
    n = s.count(anchor); assert n == 1, "ANCHOR ERROR (4): %d — STOP" % n
    i = s.index(anchor)
    r = s.rfind("return NextResponse.json({", 0, i)
    assert r != -1 and i - r < 120, "DISTANCE ERROR (4) — STOP"
    ls = s.rfind(EOL, 0, r) + len(EOL)
    s = s[:ls] + log_line + EOL + EOL + s[ls:]
    write(P4, s); print("PATCHED (4) OK: %s" % P4)

print("DONE — CONSENT-1b (fix) complete")

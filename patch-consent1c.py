# patch-consent1c.py — CONSENT-1c: จุดที่ 3 (checkbox ก่อนจัดส่ง) + จุดที่ 4 (popup ก่อนเปิดเคสคืนของ)
# ไฟล์เดียว: app/orders/[id]/OrderDetailClient.js — ตรวจ CRLF/LF อัตโนมัติต่อไฟล์ (บทเรียนจาก 1b)
# รันจาก root: python patch-consent1c.py
import io, os

MARKER = "CONSENT-1"
PATH = "app/orders/[id]/OrderDetailClient.js"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def eol_of(src):
    return "\r\n" if "\r\n" in src else "\n"

def after_line(src, anchor, add_lines, EOL, label):
    n = src.count(anchor)
    assert n == 1, "ANCHOR ERROR %s: %d of %r — STOP" % (label, n, anchor[:50])
    le = src.index(EOL, src.index(anchor)) + len(EOL)
    return src[:le] + EOL.join(add_lines) + EOL + src[le:]

def rep(src, old, new, label):
    n = src.count(old)
    assert n == 1, "REPLACE ERROR %s: %d of %r — STOP" % (label, n, old[:50])
    return src.replace(old, new)

def bal(t):
    for a, b in [("(", ")"), ("{", "}"), ("[", "]")]:
        assert t.count(a) == t.count(b), "BALANCE ERROR — STOP"

s = read(PATH)
if MARKER in s:
    print("SKIP: %s ถูก patch แล้ว" % PATH)
else:
    EOL = eol_of(s)

    # ---------- ส่วน A: DisputeModal — เพิ่ม prop returnDays + state returnConfirm + overlay จุดที่ 4 ----------
    s = rep(s, 'function DisputeModal({ order, userId, onClose, onDone }) {',
        'function DisputeModal({ order, userId, onClose, onDone, returnDays }) { // CONSENT-1: returnDays = จุดที่ 4', "A signature")

    s = after_line(s, 'const dOk = dF.reason && dF.detail.trim() && dF.files.length > 0;',
        ['  const [returnConfirm, setReturnConfirm] = useState(false); // CONSENT-1: จุดที่ 4'], EOL, "A state")

    s = rep(s, 'const submit = async () => {' + EOL + '    if (!dOk || busy) return;',
        'const doSubmit = async () => {' + EOL + '    if (!dOk || busy) return;', "A rename doSubmit")

    s = rep(s,
        'if (!res.ok) throw new Error(data.error || "ส่งเรื่องไม่สำเร็จ");',
        'if (!res.ok) throw new Error(data.error || "ส่งเรื่องไม่สำเร็จ");' + EOL +
        '      if (dF.returnWant) fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ point: "return_terms", order_id: String(order.id) }) }).catch(() => {}); // CONSENT-1',
        "A consent log")

    s = rep(s,
        '<button onClick={submit} disabled={!dOk || busy}',
        '<button onClick={() => (dF.returnWant ? setReturnConfirm(true) : doSubmit())} disabled={!dOk || busy}',
        "A button onClick")

    overlay = (
'        {returnConfirm && (' + EOL +
'          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>' + EOL +
'            <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 14, padding: 18 }}>' + EOL +
'              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, marginBottom: 8 }}>เงื่อนไขการส่งคืน</div>' + EOL +
'              <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.7 }}>หากเคสได้รับอนุมัติ ผู้ซื้อเป็นผู้ดำเนินการส่งคืนสินค้าและ<b>ชำระค่าจัดส่งคืนทั้งหมด</b> ภายใน {returnDays} วัน ตามกติกาที่ท่านยอมรับเมื่อสมัครสมาชิก</div>' + EOL +
'              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.65, marginTop: 8 }}>เกินกำหนดส่งคืน ระบบจะปิดเคสและโอนเงินให้ผู้ขายอัตโนมัติ</div>' + EOL +
'              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>' + EOL +
'                <button onClick={() => setReturnConfirm(false)} disabled={busy} style={{ flex: 1, height: 40, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>' + EOL +
'                <button onClick={() => { setReturnConfirm(false); doSubmit(); }} disabled={busy} style={{ flex: 2, height: 40, border: "none", borderRadius: 10, background: DANGER, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{busy ? "กำลังดำเนินการ..." : "เข้าใจแล้ว เปิดเคสต่อ"}</button>' + EOL +
'              </div>' + EOL +
'            </div>' + EOL +
'          </div>' + EOL +
'        )}' + EOL
    )
    anchor_close = '<button onClick={onClose} style={{ height: 38, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>'
    n = s.count(anchor_close)
    assert n == 1, "ANCHOR ERROR A overlay insert: %d — STOP" % n
    le = s.index(EOL, s.index(anchor_close)) + len(EOL)
    s = s[:le] + overlay + s[le:]
    bal(overlay)

    # ---------- ส่วน B: จุดเรียก DisputeModal — ส่ง returnDays prop ----------
    s = rep(s,
        '{dispute && <DisputeModal order={o} userId={userId} onClose={() => setDispute(false)}',
        '{dispute && <DisputeModal order={o} userId={userId} returnDays={Y_DAYS} onClose={() => setDispute(false)} /* CONSENT-1: จุดที่ 4 */',
        "B call site")

    # ---------- ส่วน C: modal จัดส่ง — checkbox จุดที่ 3 + hint + บล็อกปุ่มจนกว่าจะติ๊ก ----------
    s = after_line(s, 'const [ship, setShip] = useState({ carrier: CARRIERS[0], no: "" });',
        ['  const [shipAgree, setShipAgree] = useState(false); // CONSENT-1: จุดที่ 3'], EOL, "C state")

    hint_block = (
'              <div style={{ fontSize: 12, color: "#92400E", background: "#FEF3C7", borderRadius: 9, padding: "9px 11px", marginBottom: 10, lineHeight: 1.65 }}>' + EOL +
'                📸 อย่าลืมเก็บหลักฐานก่อนส่งนะครับ หลักฐานสำคัญที่สุดหากเกิดข้อพิพาท<br />ของมูลค่าสูงควรซื้อประกันขนส่ง' + EOL +
'              </div>' + EOL +
'              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: C.ink, lineHeight: 1.6, cursor: "pointer", marginBottom: 10 }}>' + EOL +
'                <input type="checkbox" checked={shipAgree} onChange={e => setShipAgree(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, accentColor: C.brand, flexShrink: 0 }} />' + EOL +
'                <span>ฉันเข้าใจว่าฉันเป็นคู่สัญญากับขนส่ง — กรณีพัสดุสูญหายหรือเสียหายระหว่างทาง ฉันเป็นผู้ดำเนินการเคลมกับขนส่ง</span>' + EOL +
'              </label>' + EOL
    )
    anchor_c = '<div style={{ display: "flex", gap: 8, marginBottom: 10 }}>' + EOL + '                <select value={ship.carrier}'
    n = s.count(anchor_c)
    assert n == 1, "ANCHOR ERROR C hint block: %d — STOP" % n
    s = s.replace(anchor_c, hint_block + anchor_c)
    bal(hint_block)

    s = rep(s,
        '<button disabled={busy || !ship.no.trim()} onClick={() => call(`/api/orders/${o.id}/ship`, { carrier: ship.carrier, trackingNo: ship.no })}',
        '<button disabled={busy || !ship.no.trim() || !shipAgree} onClick={() => { fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ point: "ship_terms", order_id: String(o.id) }) }).catch(() => {}); call(`/api/orders/${o.id}/ship`, { carrier: ship.carrier, trackingNo: ship.no }); }} // CONSENT-1',
        "C ship button")
    s = rep(s,
        'style={{ width: "100%", height: 46, border: "none", borderRadius: 10, background: ship.no.trim() ? C.brand : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>' + EOL + '                🚚 ยืนยันแจ้งจัดส่ง',
        'style={{ width: "100%", height: 46, border: "none", borderRadius: 10, background: (ship.no.trim() && shipAgree) ? C.brand : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: (ship.no.trim() && shipAgree) ? "pointer" : "not-allowed" }}>' + EOL + '                🚚 ยืนยันแจ้งจัดส่ง',
        "C ship button style")

    write(PATH, s)
    print("PATCHED OK: %s [EOL=%s]" % (PATH, "CRLF" if EOL == "\r\n" else "LF"))

print("DONE — CONSENT-1c complete")

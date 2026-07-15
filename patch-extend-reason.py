# patch-extend-reason.py — EXTEND-REASON
# (1) app/orders/[id]/OrderDetailClient.js — ปุ่มขอขยายเปิด overlay เลือกเหตุผลสำเร็จรูป 3 ข้อ
# (2) app/api/orders/[id]/extend/route.js — รับ reason, บันทึก extend_reason, ใส่ในแจ้งเตือนผู้ขาย
# ตรวจ CRLF/LF ต่อไฟล์อัตโนมัติ — รันจาก root: python patch-extend-reason.py
import io

MARKER = "EXTEND-REASON"

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

# ---------- (1) OrderDetailClient.js ----------
P1 = "app/orders/[id]/OrderDetailClient.js"
s = read(P1)
if MARKER in s:
    print("SKIP (1): %s ถูก patch แล้ว" % P1)
else:
    EOL = eol_of(s)

    s = after_line(s, "const [shipAgree, setShipAgree] = useState(false); // CONSENT-1: จุดที่ 3",
        ['  const [extendReasonOpen, setExtendReasonOpen] = useState(false); // EXTEND-REASON'], EOL, "1 state")

    REASONS = [
        "ยังไม่ได้รับพัสดุ",
        "ได้รับแล้วแต่ตรวจไม่ครบ",
        "ติดธุระ ยังไม่ว่างแกะของ",
    ]
    chip_lines = []
    for r in REASONS:
        chip_lines.append(
            '                <button disabled={busy} onClick={() => { setExtendReasonOpen(false); '
            'call(`/api/orders/${o.id}/extend`, { action: "request", reason: "' + r + '" }); }} '
            'style={{ width: "100%", textAlign: "left", height: 40, borderRadius: 9, border: `1px solid ${C.line}`, '
            'background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: "0 12px" }}>' + r + '</button>'
        )
    overlay = (
'          {extendReasonOpen && (' + EOL +
'            <div onClick={() => setExtendReasonOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.55)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>' + EOL +
'              <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: "#fff", borderRadius: 14, padding: 16 }}>' + EOL +
'                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink, marginBottom: 4 }}>ยังไม่ได้รับของ?</div>' + EOL +
'                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>เลือกเหตุผล — ผู้ขายจะเห็นข้อความนี้ในแจ้งเตือน (ขอได้ 1 ครั้ง)</div>' + EOL +
'                <div style={{ display: "grid", gap: 8 }}>' + EOL +
        EOL.join(chip_lines) + EOL +
'                </div>' + EOL +
'                <button onClick={() => setExtendReasonOpen(false)} style={{ marginTop: 10, width: "100%", height: 36, border: "none", background: "transparent", color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>ยกเลิก</button>' + EOL +
'              </div>' + EOL +
'            </div>' + EOL +
'          )} // EXTEND-REASON' + EOL
    )

    old_btn = (
'          {!isSeller && o.status === "shipped" && !o.extend_status && (' + EOL +
'            <button disabled={busy} onClick={() => call(`/api/orders/${o.id}/extend`, { action: "request" }, `ขอขยายเวลายืนยันรับของ +${E_DAYS} วัน?\\n\\nต้องได้รับการยืนยันจากผู้ขาย (ขอได้ 1 ครั้ง)`)}' + EOL +
'              style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>' + EOL +
'              ⏳ ยังไม่ได้รับของ? ขอขยายเวลา +{E_DAYS} วัน (ผู้ขายต้องยืนยัน)' + EOL +
'            </button>' + EOL +
'          )}'
    )
    new_btn = (
'          {!isSeller && o.status === "shipped" && !o.extend_status && (' + EOL +
'            <button disabled={busy} onClick={() => setExtendReasonOpen(true)} // EXTEND-REASON' + EOL +
'              style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>' + EOL +
'              ⏳ ยังไม่ได้รับของ? ขอขยายเวลา +{E_DAYS} วัน (ผู้ขายต้องยืนยัน)' + EOL +
'            </button>' + EOL +
'          )}' + EOL +
        overlay
    )
    s = rep(s, old_btn, new_btn, "1 button+overlay")
    bal(overlay)
    write(P1, s)
    print("PATCHED (1) OK: %s [EOL=%s]" % (P1, "CRLF" if EOL == "\r\n" else "LF"))

# ---------- (2) extend/route.js ----------
P2 = "app/api/orders/[id]/extend/route.js"
s = read(P2)
if MARKER in s:
    print("SKIP (2): %s ถูก patch แล้ว" % P2)
else:
    EOL = eol_of(s)
    s = rep(s,
        'const { action, kind = "receive" } = await req.json(); // kind: "receive" (ผู้ซื้อขอขยายรับของ) | "ship" (ผู้ขายขอขยายจัดส่ง)',
        'const { action, kind = "receive", reason } = await req.json(); // kind: "receive" (ผู้ซื้อขอขยายรับของ) | "ship" (ผู้ขายขอขยายจัดส่ง) — reason: EXTEND-REASON',
        "2 destructure")

    s = rep(s,
        'const { error } = await admin.from("orders").update({ extend_status: "pending", extend_days: days })' + EOL +
        '      .eq("id", o.id).eq("status", "shipped").is("extend_status", null);',
        'const cleanReason = String(reason || "").trim().slice(0, 100) || null; // EXTEND-REASON' + EOL +
        '    const { error } = await admin.from("orders").update({ extend_status: "pending", extend_days: days, extend_reason: cleanReason })' + EOL +
        '      .eq("id", o.id).eq("status", "shipped").is("extend_status", null);',
        "2 update")

    s = rep(s,
        'body: `${o.item} — ขอเพิ่ม ${days} วัน กดยืนยัน/ปฏิเสธในหน้าออเดอร์ (ระหว่างรอ เงินจะยังไม่ถูกปล่อยอัตโนมัติ)`, ref: o.order_no,',
        'body: `${o.item} — ขอเพิ่ม ${days} วัน${cleanReason ? ` (${cleanReason})` : ""} กดยืนยัน/ปฏิเสธในหน้าออเดอร์ (ระหว่างรอ เงินจะยังไม่ถูกปล่อยอัตโนมัติ)`, ref: o.order_no, // EXTEND-REASON',
        "2 notification")

    write(P2, s)
    print("PATCHED (2) OK: %s [EOL=%s]" % (P2, "CRLF" if EOL == "\r\n" else "LF"))

print("DONE — EXTEND-REASON complete")

# patch-dispute2c.py — DISPUTE-2c: ซ่อนปุ่ม "แจ้งปัญหา/ขอคืนสินค้า" ถาวรเมื่อ dispute_closed_at มีค่า
# รัน: python patch-dispute2c.py
# แก้ไฟล์: app/orders/[id]/OrderDetailClient.js
import sys

PATH = "app/orders/[id]/OrderDetailClient.js"
MARKER = "DISPUTE-2c"

def eol_of(text):
    return "\r\n" if "\r\n" in text else "\n"

def apply_one(text, old, new, label):
    n = text.count(old)
    assert n == 1, f"[FAIL] anchor ไม่ unique หรือหาไม่เจอ ({label}) — เจอ {n} จุด ต้องเจอ 1 จุดเท่านั้น"
    print(f"[OK] {label}")
    return text.replace(old, new, 1)

with open(PATH, encoding="utf-8", newline="") as f:
    text = f.read()

if MARKER in text:
    print(f"[SKIP] เจอ marker '{MARKER}' อยู่แล้ว — patch นี้รันไปแล้ว ไม่ทำซ้ำ")
    sys.exit(0)

E = eol_of(text)

old = E.join([
    '          {!isSeller && ["shipped", "delivered"].includes(o.status) && (',
    '            <button onClick={() => setDispute(true)}',
    '              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 10, border: `1.5px solid ${C.ret}`, background: "#fff", color: C.ret, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>',
    '              ⚠ แจ้งปัญหา / ขอคืนสินค้า',
    '            </button>',
    '          )}',
])
new = E.join([
    f'          {{/* {MARKER}: เคสปิดแล้ว (dispute_closed_at) → ซ่อนปุ่มถาวร โชว์ข้อความแทน — เหตุผลปฏิเสธแสดงแยกอยู่แล้วด้านบน (o.return_reject_reason) */}}',
    '          {!isSeller && ["shipped", "delivered"].includes(o.status) && (',
    '            o.dispute_closed_at ? (',
    '              <div style={{ marginTop: 8, fontSize: 12, color: C.muted, background: "#F6F9F9", borderRadius: 10, padding: "10px 13px", lineHeight: 1.6, textAlign: "center" }}>',
    '                🔒 เคสของออเดอร์นี้ถูกแอดมินพิจารณาแล้ว — ไม่สามารถเปิดเคสใหม่ได้อีก',
    '              </div>',
    '            ) : (',
    '              <button onClick={() => setDispute(true)}',
    '                style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 10, border: `1.5px solid ${C.ret}`, background: "#fff", color: C.ret, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>',
    '                ⚠ แจ้งปัญหา / ขอคืนสินค้า',
    '              </button>',
    '            )',
    '          )}',
])
text = apply_one(text, old, new, "1/1 ซ่อนปุ่มถาวรเมื่อ dispute_closed_at มีค่า")

with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("\n========== เสร็จ: DISPUTE-2c ==========")

# patch-extend-reason-fix.py — ลบตัวเลือก "ได้รับแล้วแต่ตรวจไม่ครบ" ออก (ขัดกับความหมายปุ่ม "ยังไม่ได้รับของ")
# รันจาก root: python patch-extend-reason-fix.py
import io

PATH = "app/orders/[id]/OrderDetailClient.js"
MARKER = "EXTEND-REASON-FIX"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

s = read(PATH)
if MARKER in s:
    print("SKIP: ถูกแก้ไปแล้ว")
else:
    old = '<button disabled={busy} onClick={() => { setExtendReasonOpen(false); call(`/api/orders/${o.id}/extend`, { action: "request", reason: "ได้รับแล้วแต่ตรวจไม่ครบ" }); }} style={{ width: "100%", textAlign: "left", height: 40, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: "0 12px" }}>ได้รับแล้วแต่ตรวจไม่ครบ</button>'
    n = s.count(old)
    assert n == 1, "ANCHOR ERROR: พบ %d จุด (ต้องการ 1) — หยุด แจ้ง Claude" % n
    s = s.replace(old, "{/* " + MARKER + ": เอาตัวเลือก \u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e2d\u0e2d\u0e01 \u0e02\u0e31\u0e14\u0e01\u0e31\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e2b\u0e21\u0e32\u0e22\u0e1b\u0e38\u0e48\u0e21 */}")
    write(PATH, s)
    print("PATCHED OK: %s — เหลือ 2 เหตุผล (ยังไม่ได้รับพัสดุ / ติดธุระ)" % PATH)

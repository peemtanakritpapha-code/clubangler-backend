# patch-dispute2a.py — DISPUTE-2a
# (1) app/api/orders/route.js — snapshot ประกาศขาย ณ วินาทีสั่งซื้อ ลง product_snapshot (jsonb)
# (2) app/api/admin/return-decide/route.js — ปฏิเสธคำขอคืน = ปั๊ม dispute_closed_at (ล็อกถาวร)
# (3) app/api/orders/[id]/dispute/route.js — เช็ค dispute_closed_at ก่อนให้เปิดเคสใหม่
# ตรวจ CRLF/LF ต่อไฟล์อัตโนมัติ — รันจาก root: python patch-dispute2a.py
import io

MARKER = "DISPUTE-2a"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def eol_of(src):
    return "\r\n" if "\r\n" in src else "\n"

def rep(src, old, new, label):
    n = src.count(old)
    assert n == 1, "REPLACE ERROR %s: %d of %r — STOP" % (label, n, old[:50])
    return src.replace(old, new)

def bal(t):
    for a, b in [("(", ")"), ("{", "}"), ("[", "]")]:
        assert t.count(a) == t.count(b), "BALANCE ERROR — STOP"

# ---------- (1) app/api/orders/route.js ----------
P1 = "app/api/orders/route.js"
s = read(P1)
if MARKER in s:
    print("SKIP (1): %s ถูก patch แล้ว" % P1)
else:
    EOL = eol_of(s)
    old = "ship_days: l.shipDays, // PRE-1: เดดไลน์ส่งของใบนี้ตรึงตายตัว — ผู้ขายแก้สินค้าทีหลังไม่มีผลย้อนหลัง"
    new = (
        old + EOL +
        "    product_snapshot: { // DISPUTE-2a: สำเนาประกาศขาย ณ วินาทีสั่งซื้อ — ผู้ขายแก้ไขทีหลังไม่มีผลย้อนหลัง (ไม่ต้องก็อปไฟล์รูป เพราะ path อัปโหลดไม่ซ้ำกันตลอดไป)" + EOL +
        "      name: l.p.name, description: l.p.description, price: l.p.price," + EOL +
        "      brand: l.p.brand, cond: l.p.cond, cond_label: l.p.cond_label, cond_note: l.p.cond_note," + EOL +
        "      issues: l.p.issues, cat_main: l.p.cat_main, cat_sub: l.p.cat_sub, images: l.p.images," + EOL +
        "    },"
    )
    s = rep(s, old, new, "1 snapshot")
    bal(new)
    write(P1, s)
    print("PATCHED (1) OK: %s [EOL=%s]" % (P1, "CRLF" if EOL == "\r\n" else "LF"))

# ---------- (2) app/api/admin/return-decide/route.js ----------
P2 = "app/api/admin/return-decide/route.js"
s = read(P2)
if MARKER in s:
    print("SKIP (2): %s ถูก patch แล้ว" % P2)
else:
    EOL = eol_of(s)
    old = 'const { error } = await admin.from("orders").update({ status: "delivered", return_reject_reason: reason.trim() }).eq("id", o.id);'
    new = 'const { error } = await admin.from("orders").update({ status: "delivered", return_reject_reason: reason.trim(), dispute_closed_at: new Date().toISOString() }).eq("id", o.id); // DISPUTE-2a: ล็อกไม่ให้เปิดเคสซ้ำ'
    s = rep(s, old, new, "2 reject-lock")
    write(P2, s)
    print("PATCHED (2) OK: %s [EOL=%s]" % (P2, "CRLF" if EOL == "\r\n" else "LF"))

# ---------- (3) app/api/orders/[id]/dispute/route.js ----------
P3 = "app/api/orders/[id]/dispute/route.js"
s = read(P3)
if MARKER in s:
    print("SKIP (3): %s ถูก patch แล้ว" % P3)
else:
    EOL = eol_of(s)
    old = 'if (!o || o.buyer_id !== user.id) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });'
    new = (
        old + EOL +
        '  if (o.dispute_closed_at) return NextResponse.json({ error: "เคสของออเดอร์นี้ถูกแอดมินพิจารณาแล้ว ไม่สามารถเปิดเคสซ้ำได้" }, { status: 400 }); // DISPUTE-2a'
    )
    s = rep(s, old, new, "3 reopen-guard")
    write(P3, s)
    print("PATCHED (3) OK: %s [EOL=%s]" % (P3, "CRLF" if EOL == "\r\n" else "LF"))

print("DONE — DISPUTE-2a complete")

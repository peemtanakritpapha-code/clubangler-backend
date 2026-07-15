# patch-dispute2a-snapshot-extra.py — เพิ่มค่าส่ง (shipping) + จังหวัด (location) เข้า snapshot
# (1) app/api/orders/route.js — เก็บ shipping, location เข้า product_snapshot
# (2) app/admin/AdminClient.js — แสดงค่าส่ง + จังหวัด ในกล่อง snapshot
# รันจาก root: python patch-dispute2a-snapshot-extra.py
import io

MARKER = "SNAPSHOT-EXTRA"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def eol_of(src):
    return "\r\n" if "\r\n" in src else "\n"

def rep(src, old, new, label):
    n = src.count(old)
    assert n == 1, "REPLACE ERROR %s: %d of %r — STOP" % (label, n, old[:60])
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
    old = "issues: l.p.issues, cat_main: l.p.cat_main, cat_sub: l.p.cat_sub, images: l.p.images,"
    new = "issues: l.p.issues, cat_main: l.p.cat_main, cat_sub: l.p.cat_sub, images: l.p.images," + EOL + "      shipping: l.p.shipping, location: l.p.location, // " + MARKER
    s = rep(s, old, new, "1 snapshot-extra")
    write(P1, s)
    print("PATCHED (1) OK: %s [EOL=%s]" % (P1, "CRLF" if EOL == "\r\n" else "LF"))

# ---------- (2) app/admin/AdminClient.js ----------
P2 = "app/admin/AdminClient.js"
s = read(P2)
if MARKER in s:
    print("SKIP (2): %s ถูก patch แล้ว" % P2)
else:
    EOL = eol_of(s)
    old = '                    {o.product_snapshot.cond ? ` · ${o.product_snapshot.cond}` : ""}' + EOL + '                  </div>'
    new = (
        '                    {o.product_snapshot.cond ? ` · ${o.product_snapshot.cond}` : ""}' + EOL +
        '                    {o.product_snapshot.location ? ` · ${o.product_snapshot.location}` : ""} {/* ' + MARKER + ' */}' + EOL +
        '                  </div>' + EOL +
        '                  {o.product_snapshot.shipping && (' + EOL +
        '                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>\U0001F69A {o.product_snapshot.shipping.label || (o.product_snapshot.shipping.mode === "free" ? "\u0e2a\u0e48\u0e07\u0e1f\u0e23\u0e35" : `\u0e04\u0e48\u0e32\u0e2a\u0e48\u0e07 \u0e3f${Number(o.product_snapshot.shipping.fee || 0).toLocaleString()}`)}</div>' + EOL +
        '                  )}'
    )
    s = rep(s, old, new, "2 admin-extra")
    bal(new)
    write(P2, s)
    print("PATCHED (2) OK: %s [EOL=%s]" % (P2, "CRLF" if EOL == "\r\n" else "LF"))

print("DONE — SNAPSHOT-EXTRA complete")

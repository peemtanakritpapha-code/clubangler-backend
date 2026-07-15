# patch-dispute2a-admin.py — เพิ่มกล่อง "สำเนาประกาศขาย ณ วันสั่งซื้อ" ในการ์ดตรวจเคสแอดมิน (แท็บ returns)
# ให้แอดมินเห็น snapshot ที่ ORDER-SNAPSHOT บันทึกไว้ ใช้เทียบกับหลักฐานผู้ซื้อตอนตัดสินเคส
# รันจาก root: python patch-dispute2a-admin.py
import io

PATH = "app/admin/AdminClient.js"
MARKER = "DISPUTE-2a-ADMIN"

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

s = read(PATH)
if MARKER in s:
    print("SKIP: %s ถูก patch แล้ว" % PATH)
else:
    EOL = eol_of(s)

    anchor_close = (
'                )}' + EOL +
'              </div>' + EOL +
'              {/* AD3: \u0e15\u0e31\u0e14\u0e2a\u0e34\u0e19 3 \u0e17\u0e32\u0e07 (spec \u00a73) \u2014 \u0e17\u0e38\u0e01\u0e17\u0e32\u0e07\u0e40\u0e02\u0e35\u0e22\u0e19 state \u0e01\u0e25\u0e32\u0e07\u0e1c\u0e48\u0e32\u0e19 return-decide \u0e15\u0e31\u0e27\u0e40\u0e14\u0e35\u0e22\u0e27 */}'
    )
    n = s.count(anchor_close)
    assert n == 1, "ANCHOR ERROR: found %d of anchor_close — STOP" % n

    snapshot_box = (
'              {/* ' + MARKER + ': \u0e40\u0e17\u0e35\u0e22\u0e1a\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e01\u0e31\u0e1a\u0e2a\u0e33\u0e40\u0e19\u0e32\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e02\u0e32\u0e22 \u0e13 \u0e27\u0e31\u0e19\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d */}' + EOL +
'              {o.product_snapshot ? (' + EOL +
'                <div style={{ background: "#F1F5F9", borderRadius: 10, padding: "10px 12px", marginTop: 8 }}>' + EOL +
'                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#334155" }}>\U0001F4CB \u0e2a\u0e33\u0e40\u0e19\u0e32\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e02\u0e32\u0e22 \u0e13 \u0e27\u0e31\u0e19\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d (\u0e1c\u0e39\u0e49\u0e02\u0e32\u0e22\u0e41\u0e01\u0e49\u0e44\u0e02\u0e17\u0e35\u0e2b\u0e25\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e25\u0e22\u0e49\u0e2d\u0e19\u0e2b\u0e25\u0e31\u0e07)</div>' + EOL +
'                  <div style={{ fontSize: 12, color: C.ink, marginTop: 3 }}>' + EOL +
'                    {o.product_snapshot.name} \u00b7 \u0e3f{Number(o.product_snapshot.price).toLocaleString()}' + EOL +
'                    {o.product_snapshot.brand ? ` \u00b7 ${o.product_snapshot.brand}` : ""}' + EOL +
'                    {o.product_snapshot.cond ? ` \u00b7 ${o.product_snapshot.cond}` : ""}' + EOL +
'                  </div>' + EOL +
'                  {o.product_snapshot.cond_note && <div style={{ fontSize: 11.5, color: "#475569", marginTop: 3 }}>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38\u0e2a\u0e20\u0e32\u0e1e: {o.product_snapshot.cond_note}</div>}' + EOL +
'                  {(o.product_snapshot.issues || []).length > 0 && (' + EOL +
'                    <div style={{ fontSize: 11.5, color: "#B45309", marginTop: 3 }}>\u0e15\u0e33\u0e2b\u0e19\u0e34\u0e17\u0e35\u0e48\u0e41\u0e08\u0e49\u0e07\u0e15\u0e2d\u0e19\u0e25\u0e07\u0e02\u0e32\u0e22: {o.product_snapshot.issues.join(", ")}</div>' + EOL +
'                  )}' + EOL +
'                  {(o.product_snapshot.images || []).length > 0 && (' + EOL +
'                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>' + EOL +
'                      {o.product_snapshot.images.slice(0, 5).map((u, i) => (' + EOL +
'                        <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, border: "1px solid #CBD5E1" }} /></a>' + EOL +
'                      ))}' + EOL +
'                    </div>' + EOL +
'                  )}' + EOL +
'                </div>' + EOL +
'              ) : (' + EOL +
'                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e01\u0e48\u0e2d\u0e19\u0e21\u0e35\u0e23\u0e30\u0e1a\u0e1a\u0e2a\u0e33\u0e40\u0e19\u0e32 \u2014 \u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a</div>' + EOL +
'              )}' + EOL
    )

    new_close = (
'                )}' + EOL +
'              </div>' + EOL +
        snapshot_box +
'              {/* AD3: \u0e15\u0e31\u0e14\u0e2a\u0e34\u0e19 3 \u0e17\u0e32\u0e07 (spec \u00a73) \u2014 \u0e17\u0e38\u0e01\u0e17\u0e32\u0e07\u0e40\u0e02\u0e35\u0e22\u0e19 state \u0e01\u0e25\u0e32\u0e07\u0e1c\u0e48\u0e32\u0e19 return-decide \u0e15\u0e31\u0e27\u0e40\u0e14\u0e35\u0e22\u0e27 */}'
    )

    s = rep(s, anchor_close, new_close, "snapshot box insert")
    bal(snapshot_box)
    write(PATH, s)
    print("PATCHED OK: %s [EOL=%s]" % (PATH, "CRLF" if EOL == "\r\n" else "LF"))

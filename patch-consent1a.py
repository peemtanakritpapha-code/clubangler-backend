# patch-consent1a.py — CONSENT-1a
# (1) สร้างไฟล์ใหม่ app/api/consent/route.js — จุดรับบันทึกการกดยอมรับ
# (2) แก้ app/login/page.js — checkbox ยอมรับกติกาตอนสมัคร + บล็อกปุ่ม + บันทึก log
# รันจาก root ของ repo: python patch-consent1a.py
import io, os, sys

MARKER = "CONSENT-1"
CRLF = "\r\n"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def insert_after_line(src, anchor, addition, path):
    n = src.count(anchor)
    assert n == 1, "ANCHOR ERROR in %s: found %d of %r — STOP" % (path, n, anchor[:40])
    le = src.index(CRLF, src.index(anchor)) + 2
    return src[:le] + addition + src[le:]

def replace_once(src, old, new, path):
    n = src.count(old)
    assert n == 1, "REPLACE ERROR in %s: found %d of %r — STOP" % (path, n, old[:40])
    return src.replace(old, new)

# ---------- (1) ไฟล์ใหม่: app/api/consent/route.js ----------
PA = "app/api/consent/route.js"
ROUTE = (
'// app/api/consent/route.js — CONSENT-1: บันทึกการกดยอมรับกติกา (จุด: signup / order_terms / ship_terms / return_terms)' + CRLF +
'import { NextResponse } from "next/server";' + CRLF +
'import { createClient } from "@/lib/supabase/server";' + CRLF +
'import { createAdminClient } from "@/lib/supabase/admin";' + CRLF +
CRLF +
'const POINTS = ["signup", "order_terms", "ship_terms", "return_terms"];' + CRLF +
CRLF +
'export async function POST(req) {' + CRLF +
'  const supabase = await createClient();' + CRLF +
'  const { data: { user } } = await supabase.auth.getUser();' + CRLF +
'  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });' + CRLF +
CRLF +
'  const body = await req.json().catch(() => ({}));' + CRLF +
'  const point = String(body.point || "");' + CRLF +
'  if (!POINTS.includes(point)) return NextResponse.json({ error: "จุดยอมรับไม่ถูกต้อง" }, { status: 400 });' + CRLF +
CRLF +
'  const row = { user_id: user.id, point };' + CRLF +
'  if (body.order_id != null) row.order_id = String(body.order_id);' + CRLF +
CRLF +
'  const admin = createAdminClient();' + CRLF +
'  const { error } = await admin.from("consent_logs").insert(row);' + CRLF +
'  if (error) return NextResponse.json({ error: error.message }, { status: 500 });' + CRLF +
'  return NextResponse.json({ ok: true });' + CRLF +
'}' + CRLF
)

if os.path.exists(PA):
    print("SKIP (1): %s มีอยู่แล้ว" % PA)
else:
    os.makedirs(os.path.dirname(PA), exist_ok=True)
    write(PA, ROUTE)
    print("CREATED (1): %s" % PA)

# ---------- (2) แก้ app/login/page.js ----------
PB = "app/login/page.js"
sb = read(PB)
if MARKER in sb:
    print("SKIP (2): %s ถูก patch แล้ว" % PB)
else:
    sb = insert_after_line(sb,
        'const [busy, setBusy] = useState(false);',
        '  const [agree, setAgree] = useState(false); // CONSENT-1: จุดยอมรับที่ 1' + CRLF, PB)

    sb = insert_after_line(sb,
        'if (mode === "signup" && !name.trim())',
        '    if (mode === "signup" && !agree) { setErr("กรุณายอมรับกติกาการซื้อขายและข้อพิพาทก่อนสมัครสมาชิก"); return; }' + CRLF, PB)

    consent_call = '    if (mode === "signup") await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ point: "signup" }) }).catch(() => {}); // CONSENT-1' + CRLF
    anchor = 'router.push("/");'
    n = sb.count(anchor)
    assert n == 1, "ANCHOR ERROR in %s: router.push found %d — STOP" % (PB, n)
    i = sb.index(anchor)
    ls = sb.rfind(CRLF, 0, i) + 2
    sb = sb[:ls] + consent_call + sb[ls:]

    checkbox = (
'          {mode === "signup" && (' + CRLF +
'            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: C.ink, lineHeight: 1.6, cursor: "pointer" }}>' + CRLF +
'              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width: 17, height: 17, marginTop: 2, accentColor: C.brand, flexShrink: 0 }} />' + CRLF +
'              <span>ฉันได้อ่านและยอมรับ <Link href="/terms" style={{ color: C.brand, fontWeight: 700 }}>กติกาการซื้อขายและข้อพิพาท</Link> ของ ClubAngler</span>' + CRLF +
'            </label>' + CRLF +
'          )}' + CRLF
    )
    sb = insert_after_line(sb, '{err && <div style={{ fontSize: 12.5, color: C.danger', checkbox, PB)

    sb = replace_once(sb,
        '<button onClick={submit} disabled={busy}',
        '<button onClick={submit} disabled={busy || (mode === "signup" && !agree)}', PB)
    sb = replace_once(sb,
        'opacity: busy ? .6 : 1',
        'opacity: busy || (mode === "signup" && !agree) ? .6 : 1', PB)

    for a, b in [("(", ")"), ("{", "}"), ("[", "]")]:
        assert checkbox.count(a) == checkbox.count(b), "BALANCE ERROR — STOP"

    write(PB, sb)
    print("PATCHED (2) OK: %s (+checkbox +validation +log +disable)" % PB)

print("DONE — CONSENT-1a complete")

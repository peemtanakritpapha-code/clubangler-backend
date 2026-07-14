# patch-product-delete.py — PRODDEL-1: ปุ่ม "ลบถาวร" ในแท็บสินค้าแอดมิน (เฉพาะสินค้าที่ระงับแล้ว)
# รันที่รากโปรเจกต์: python patch-product-delete.py
import io, sys

PATH = "app/admin/AdminClient.js"
MARK = "PRODDEL-1"
NL = "\r\n"

src = io.open(PATH, encoding="utf-8", newline="").read()

if MARK in src:
    print("ข้าม: ไฟล์ถูก patch แล้ว (พบ marker PRODDEL-1) — ไม่ทำซ้ำ")
    sys.exit(0)

def rep(tag, anchor, new):
    global src
    n = src.count(anchor)
    assert n == 1, f"[{tag}] anchor พบ {n} ครั้ง (ต้องเป็น 1) — หยุดทันที ไม่แตะไฟล์"
    src = src.replace(anchor, new)
    print(f"[{tag}] OK")

# ── A: state เก็บสินค้าที่กำลังจะลบถาวร ──
rep("A state",
    "const [suspendP, setSuspendP] = useState(null);",
    "const [suspendP, setSuspendP] = useState(null);" + NL +
    "  const [purgeP, setPurgeP] = useState(null); // PRODDEL-1: สินค้าที่กำลังยืนยันลบถาวร")

# ── B: ปุ่มลบถาวร (โผล่เฉพาะแถวที่ระงับแล้ว ต่อท้ายปุ่มเปิดขาย/ระงับ) ──
rep("B ปุ่มลบถาวร",
    '>ระงับ</button>}',
    '>ระงับ</button>}' + NL +
    '                  {p.status === "suspended" && (' + NL +
    '                    <button onClick={() => setPurgeP(p)} disabled={busy} title="ลบถาวร — กู้คืนไม่ได้"' + NL +
    '                      style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "none", background: C.danger, color: "#fff", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>🗑️ ลบถาวร</button>' + NL +
    '                  )}')

# ── C: ReasonModal ยืนยันลบถาวร ──
rep("C modal",
    "{reject && <ReasonModal",
    '{purgeP && <ReasonModal title={`ลบ "${purgeP.name}" ถาวร — กู้คืนไม่ได้ และรูปจะถูกลบจาก storage ด้วย · ใช้กับสินค้าเทส/ผิดกฎร้ายแรงเท่านั้น — เหตุผล (ผู้ขายจะเห็น)`}' + NL +
    "        onCancel={() => setPurgeP(null)}" + NL +
    '        onSubmit={r => { const id = purgeP.id; setPurgeP(null); call("/api/admin/product-delete", { productId: id, reason: r }); }} />}' + NL +
    "      {reject && <ReasonModal")

io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("เขียนไฟล์เรียบร้อย —", PATH)

for a, b in [("{", "}"), ("(", ")")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"วงเล็บ {a}{b} ไม่สมดุล: {ca} vs {cb}"
print("วงเล็บสมดุลครบ ✓ เสร็จสมบูรณ์")

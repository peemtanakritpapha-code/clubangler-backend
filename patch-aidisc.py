# patch-aidisc.py — AI-DISC: ยืนยันก่อนโพสต์ทุกครั้งที่ใช้ AI ช่วยกรอก + ธง ai_assisted
# ⚠️ ต้องรัน SQL นี้ใน Supabase "ก่อน" deploy (ไม่งั้นบันทึกสินค้าพังทันที):
#    alter table public.products add column if not exists ai_assisted boolean default false;
# วางที่รากโปรเจกต์แล้วรัน:  python patch-aidisc.py
import io, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
F_SELL = os.path.join(ROOT, "app", "sell", "SellClient.js")
F_SAVE = os.path.join(ROOT, "app", "api", "products", "save", "route.js")
for p in (F_SELL, F_SAVE): assert os.path.exists(p), "ไม่พบไฟล์: %s" % p
sell = io.open(F_SELL, encoding="utf-8").read()
save = io.open(F_SAVE, encoding="utf-8").read()

done = [("AI-DISC" in sell), ("AI-DISC" in save)]
if all(done): print("แพตช์ครบแล้ว — ไม่ต้องรันซ้ำ ✅"); sys.exit(0)
assert not any(done), "สถานะครึ่งๆ กลางๆ (%s) — หยุด ส่งข้อความนี้ให้ Claude" % done

def rep(src, a, b, tag):
    assert src.count(a) == 1, "anchor '%s' พบ %d จุด (ต้อง 1)" % (tag, src.count(a))
    return src.replace(a, b, 1)

# ── SellClient ──
# 1) state
sell = rep(sell, 'const [brandOpen, setBrandOpen] = useState(false);',
"""const [aiUsed, setAiUsed] = useState(false);          // AI-DISC: โพสต์นี้มีช่องที่ AI เติมสำเร็จอย่างน้อย 1 ช่อง
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);""", "state")
# 2) applyDraft ติดธง
sell = rep(sell, 'return { filled, skipped: skipped.filter(s => !filled.includes(s)) };',
"""if (filled.length) setAiUsed(true); // AI-DISC
    return { filled, skipped: skipped.filter(s => !filled.includes(s)) };""", "applyDraft")
# 3) ด่านยืนยันใน submit (ปุ่มเรียก onClick={submit} — event ที่ติดมาไม่ใช่ true จึงไม่หลุดด่าน)
sell = rep(sell, 'const submit = async () => {', 'const submit = async (aiOk) => {', "submit-sig")
sell = rep(sell, 'if (f.shipMode === "paid" && !(Number(f.shipFee) >= 0)) return setErr("กรอกค่าส่ง");',
"""if (f.shipMode === "paid" && !(Number(f.shipFee) >= 0)) return setErr("กรอกค่าส่ง");
    if (aiUsed && aiOk !== true) { setAiConfirmOpen(true); return; } // AI-DISC: ใช้ AI กรอก → ต้องยืนยันก่อนโพสต์""", "submit-gate")
# 4) ส่งธงเข้า API
sell = rep(sell, 'images: allImgs, ratio: f.ratio,',
"""images: allImgs, ratio: f.ratio,
          aiAssisted: aiUsed, // AI-DISC""", "body")
# 5) modal (วางก่อน modal หมวดหมู่ — สไตล์เดียวกับ catOpen)
MODAL = """      {/* AI-DISC: ยืนยันก่อนโพสต์เมื่อใช้ AI ช่วยกรอก — ห้าม window.confirm (กติกาเหล็ก) */}
      {aiConfirmOpen && (
        <div onClick={() => setAiConfirmOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: "20px 18px" }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: C.ink, marginBottom: 8 }}>✨ โพสต์นี้ใช้ AI ช่วยกรอกข้อมูล</div>
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.7 }}>ระบบเติมข้อมูลบางส่วนจากรูปภาพให้โดยอัตโนมัติ (ชื่อ · หมวดหมู่ · แบรนด์ · สเปก · รายละเอียด)</div>
            <div style={{ background: "#FCF3E3", border: "1px solid #EBCF9C", color: "#8A5A12", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.65, margin: "12px 0" }}>
              ⚠️ โปรดตรวจทุกช่องให้ถูกต้องครบถ้วนก่อนโพสต์ — ข้อมูลที่คลาดเคลื่อน<b>มีผลต่อการตีกลับ/คืนสินค้า</b> และถือเป็นความรับผิดชอบของผู้ขาย
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAiConfirmOpen(false)} style={{ flex: 1, padding: 11, borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: "#fff", border: `1.5px solid ${C.line}`, color: C.muted }}>กลับไปตรวจก่อน</button>
              <button onClick={() => { setAiConfirmOpen(false); submit(true); }} style={{ flex: 1, padding: 11, borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: C.brand, border: "none", color: "#fff" }}>ตรวจครบแล้ว · โพสต์เลย</button>
            </div>
          </div>
        </div>
      )}
      {catOpen && ("""
sell = rep(sell, "      {catOpen && (", MODAL, "modal")

# ── save route: ธงติดหนึบ (เคยเป็น true แล้ว การแก้ไขรอบหลังไม่ล้างทิ้ง) ──
save = rep(save, "    image_ratio: ratio,",
"""    image_ratio: ratio,
    ...(body?.aiAssisted === true ? { ai_assisted: true } : {}), // AI-DISC: ธงหลักฐานใช้ AI กรอก — ติดแล้วไม่ถอด""", "save-row")

assert sell.count("AI-DISC") == 5 and save.count("AI-DISC") == 1
io.open(F_SELL, "w", encoding="utf-8", newline="\r\n").write(sell)
io.open(F_SAVE, "w", encoding="utf-8", newline="\r\n").write(save)
print("แพตช์สำเร็จ 2 ไฟล์ ✅ (SellClient + save route)")
print("⚠️ อย่าลืม: รัน SQL เพิ่มคอลัมน์ ai_assisted ใน Supabase ก่อน deploy!")

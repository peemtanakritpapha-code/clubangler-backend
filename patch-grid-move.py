# patch-grid-move.py — GRID-2: แก้ 2 จุดจากรีวิวจริง
# 1) มือถือเลือก 3 คอลัมน์แล้วล้นขอบขวา → คอลัมน์ Masonry เพิ่ม minWidth:0 (flex item เดิมไม่ยอมหด)
# 2) ปุ่ม ⊞: มือถือ/แอพ ย้ายไปเรียงข้างปุ่มตัวกรอง (แถวค้นหา) · จอกว้างคงที่เดิม (แถวพบ N รายการ)
#    ใช้ render function เดียวสองตำแหน่ง สลับด้วย class .mkt-mobile/.mkt-desk ตามแพทเทิร์นไฟล์นี้
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-grid-move.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "renderGridCtl" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

assert "ca_grid_cols" in src, "ต้องรัน patch-grid-setting.py (GRID-1) ก่อน"

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) คอลัมน์ Masonry: เพิ่ม minWidth:0 กันล้นขอบขวา ──
A = '<div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: ci % 2 === 1 ? 24 : 0 }}>'
B = '<div key={ci} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, marginTop: ci % 2 === 1 ? 24 : 0 }}>'
src = rep(A, B, "Masonry minWidth")

# ── 2) render function ปุ่ม ⊞ ใช้ร่วมสองตำแหน่ง — ต่อท้าย dismissGridHint ──
A = NL.join([
    "  const dismissGridHint = () => {",
    "    setGridHint(false);",
    '    try { localStorage.setItem("ca_grid_hint_done", "1"); } catch {}',
    "  };",
])
B = A + NL + NL.join([
    "  // GRID-2: ปุ่ม ⊞ + bubble + popover — ตัวเดียวใช้สองตำแหน่ง (มือถือ: ข้างปุ่มตัวกรอง / จอกว้าง: แถวพบรายการ)",
    "  const renderGridCtl = (mobile) => (",
    '    <div className={mobile ? "mkt-mobile" : "mkt-desk"} style={{ position: "relative", flex: "none" }}>',
    '      <button onClick={() => { dismissGridHint(); setGridOpen(o => !o); }} aria-label="ปรับขนาดตารางสินค้า" style={{ width: mobile ? 42 : 32, height: mobile ? 42 : 32, borderRadius: mobile ? 12 : 8, border: `${mobile ? 1 : 1.5}px solid ${gridOpen || gridHint ? C.brand : C.line}`, background: gridOpen || gridHint ? C.brandTint : "#fff", color: C.brand, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>',
    "        <LayoutGrid size={mobile ? 17 : 16} />",
    "      </button>",
    "      {gridHint && (",
    '        <div style={{ position: "absolute", right: -4, top: mobile ? 50 : 42, width: 226, background: C.brand, color: "#fff", borderRadius: 14, padding: "13px 14px 12px", zIndex: 45, boxShadow: "0 10px 28px rgba(14,126,140,.35)" }}>',
    '          <div style={{ position: "absolute", top: -8, right: 14, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: `9px solid ${C.brand}` }} />',
    '          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>🆕 ปรับตารางสินค้าได้แล้วน้า</div>',
    '          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "#CDEDE4", marginBottom: 10 }}>แตะปุ่มนี้เพื่อเลือกจำนวนคอลัมน์ที่สบายตาสุด — เลือกครั้งเดียว ระบบจำให้ตลอด</div>',
    '          <button onClick={dismissGridHint} style={{ width: "100%", height: 34, border: "none", borderRadius: 8, background: "#fff", color: C.brand, fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>เข้าใจแล้ว 👍</button>',
    "        </div>",
    "      )}",
    "      {gridOpen && (<>",
    '        <div onClick={() => setGridOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 44 }} />',
    '        <div style={{ position: "absolute", right: 0, top: mobile ? 46 : 38, width: 180, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 26px rgba(16,19,20,.14)", padding: "11px 12px", zIndex: 45 }}>',
    '          <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 8 }}>จำนวนคอลัมน์</div>',
    '          <div style={{ display: "flex", gap: 6 }}>',
    "            {(smallScr ? [2, 3] : [3, 4, 5]).map(n => (",
    '              <button key={n} onClick={() => pickCols(n)} style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${n === nCols ? C.brand : C.line}`, background: n === nCols ? C.brandTint : "#fff", cursor: "pointer", fontFamily: "inherit", color: C.ink, padding: 0 }}>',
    '                <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{n}</div>',
    '                <div style={{ fontSize: 9, color: C.muted }}>คอลัมน์</div>',
    "              </button>",
    "            ))}",
    "          </div>",
    "        </div>",
    "      </>)}",
    "    </div>",
    "  );",
])
src = rep(A, B, "renderGridCtl")

# ── 3) แถวค้นหา: แทรกปุ่มเวอร์ชันมือถือหลังปุ่มตัวกรอง ──
A = NL.join([
    "            </button>",
    "            {/* desktop: dropdown เรียง + ปุ่มลงขาย (prototype บรรทัด 6369–6375) */}",
])
B = NL.join([
    "            </button>",
    "            {renderGridCtl(true)}{/* GRID-2: มือถือ — ปุ่มปรับตารางข้างปุ่มตัวกรอง */}",
    "            {/* desktop: dropdown เรียง + ปุ่มลงขาย (prototype บรรทัด 6369–6375) */}",
])
src = rep(A, B, "แทรกปุ่มมือถือ")

# ── 4) แถวพบรายการ: ก้อนปุ่มเดิม (GRID-1) → เรียก render function เวอร์ชัน desktop ──
A = NL.join([
    "            {/* GRID: ปุ่มปรับจำนวนคอลัมน์ + กล่องสนทนาแนะนำครั้งแรก */}",
    '            <div style={{ position: "relative", flex: "none" }}>',
    '              <button onClick={() => { dismissGridHint(); setGridOpen(o => !o); }} aria-label="ปรับขนาดตารางสินค้า" style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${gridOpen || gridHint ? C.brand : C.line}`, background: gridOpen || gridHint ? C.brandTint : "#fff", color: C.brand, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>',
    "                <LayoutGrid size={16} />",
    "              </button>",
    "              {gridHint && (",
    '                <div style={{ position: "absolute", right: -4, top: 42, width: 226, background: C.brand, color: "#fff", borderRadius: 14, padding: "13px 14px 12px", zIndex: 45, boxShadow: "0 10px 28px rgba(14,126,140,.35)" }}>',
    '                  <div style={{ position: "absolute", top: -8, right: 14, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: `9px solid ${C.brand}` }} />',
    '                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>🆕 ปรับตารางสินค้าได้แล้วน้า</div>',
    '                  <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "#CDEDE4", marginBottom: 10 }}>แตะปุ่มนี้เพื่อเลือกจำนวนคอลัมน์ที่สบายตาสุด — เลือกครั้งเดียว ระบบจำให้ตลอด</div>',
    '                  <button onClick={dismissGridHint} style={{ width: "100%", height: 34, border: "none", borderRadius: 8, background: "#fff", color: C.brand, fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>เข้าใจแล้ว 👍</button>',
    "                </div>",
    "              )}",
    "              {gridOpen && (<>",
    '                <div onClick={() => setGridOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 44 }} />',
    '                <div style={{ position: "absolute", right: 0, top: 38, width: 180, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 26px rgba(16,19,20,.14)", padding: "11px 12px", zIndex: 45 }}>',
    '                  <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 8 }}>จำนวนคอลัมน์</div>',
    '                  <div style={{ display: "flex", gap: 6 }}>',
    "                    {(smallScr ? [2, 3] : [3, 4, 5]).map(n => (",
    '                      <button key={n} onClick={() => pickCols(n)} style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${n === nCols ? C.brand : C.line}`, background: n === nCols ? C.brandTint : "#fff", cursor: "pointer", fontFamily: "inherit", color: C.ink, padding: 0 }}>',
    '                        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{n}</div>',
    '                        <div style={{ fontSize: 9, color: C.muted }}>คอลัมน์</div>',
    "                      </button>",
    "                    ))}",
    "                  </div>",
    "                </div>",
    "              </>)}",
    "            </div>",
])
B = "            {renderGridCtl(false)}{/* GRID-2: จอกว้าง — ปุ่มปรับตารางที่แถวพบรายการ (ตำแหน่งเดิม) */}"
src = rep(A, B, "ก้อนปุ่มเดิม → renderGridCtl(false)")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-2 แก้ล้นขวา + ปุ่มมือถือย้ายข้างตัวกรอง · CRLF=" + str(crlf))

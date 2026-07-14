# patch-grid-setting.py — GRID-1: ปุ่มปรับจำนวนคอลัมน์ตารางสินค้า (หน้า /market)
# - ปุ่ม ⊞ แถวเดียวกับ "พบ N รายการ" → popover เลือกคอลัมน์ (จอเล็ก 2/3 · จอใหญ่ 3/4/5)
# - ค่าเริ่มต้น = อัตโนมัติตามจอแบบเดิม · เลือกแล้วจำใน localStorage (ca_grid_cols)
# - เปิดครั้งแรก: กล่องสนทนาหางชี้ที่ไอคอน + ปุ่ม "เข้าใจแล้ว" (จำใน ca_grid_hint_done)
# วางไฟล์นี้ที่รากโปรเจกต์ แล้วรัน: python patch-grid-setting.py

import io, sys

PATH = "app/market/MarketClient.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()

# ── กันรันซ้ำ ──
if "ca_grid_cols" in src:
    print("SKIP: แพตช์นี้ลงไปแล้ว — ไม่ทำอะไร")
    sys.exit(0)

crlf = "\r\n" in src
NL = "\r\n" if crlf else "\n"

def rep(old, new, what):
    n = src.count(old)
    assert n == 1, f"ANCHOR FAIL ({what}): พบ {n} ที่ (ต้องพบ 1) — หยุด ไม่แตะไฟล์"
    return src.replace(old, new)

# ── 1) import เพิ่ม LayoutGrid ──
A = 'import { Search, X, ShieldCheck, Fish, Filter, ChevronRight, ChevronLeft, Plus } from "lucide-react";'
B = 'import { Search, X, ShieldCheck, Fish, Filter, ChevronRight, ChevronLeft, Plus, LayoutGrid } from "lucide-react";'
src = rep(A, B, "import LayoutGrid")

# ── 2) state: nCols เดิม → ชุด GRID ──
A = "  const [nCols, setNCols] = useState(2);"
B = NL.join([
    "  const [autoCols, setAutoCols] = useState(2);    // GRID: คอลัมน์อัตโนมัติตามจอ (พฤติกรรมเดิม)",
    "  const [smallScr, setSmallScr] = useState(false); // GRID: จอเล็ก <640 → ชุดตัวเลือก 2/3",
    "  const [userCols, setUserCols] = useState(null);  // GRID: ค่าที่ผู้ใช้เลือกเอง (null = อัตโนมัติ)",
    "  const [gridOpen, setGridOpen] = useState(false); // GRID: popover เลือกคอลัมน์",
    "  const [gridHint, setGridHint] = useState(false); // GRID: กล่องสนทนาแนะนำครั้งแรก",
])
src = rep(A, B, "state GRID")

# ── 3) effect resize เดิม → resize + โหลดค่า + derive nCols + handlers ──
A = NL.join([
    "  // responsive: <640→2 / <1024→3 / กว้าง→4 คอลัมน์",
    "  useEffect(() => {",
    "    const f = () => setNCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);",
    '    f(); window.addEventListener("resize", f);',
    '    return () => window.removeEventListener("resize", f);',
    "  }, []);",
])
B = NL.join([
    "  // GRID: responsive อัตโนมัติ (<640→2 / <1024→3 / กว้าง→4) + จำว่าจอเล็กไหมไว้เลือกชุดตัวเลือก",
    "  useEffect(() => {",
    "    const f = () => {",
    "      setSmallScr(window.innerWidth < 640);",
    "      setAutoCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);",
    "    };",
    '    f(); window.addEventListener("resize", f);',
    '    return () => window.removeEventListener("resize", f);',
    "  }, []);",
    "  // GRID: โหลดค่าที่เคยเลือก + สถานะเคยเห็นคำแนะนำ (อ่าน localStorage หลัง mount กัน hydration เพี้ยน)",
    "  useEffect(() => {",
    "    try {",
    '      const v = parseInt(localStorage.getItem("ca_grid_cols") ?? "", 10);',
    "      if (Number.isFinite(v)) setUserCols(v);",
    '      if (!localStorage.getItem("ca_grid_hint_done")) setGridHint(true);',
    "    } catch {}",
    "  }, []);",
    "  // GRID: จำนวนคอลัมน์จริง — ค่าผู้ใช้ (บีบให้อยู่ในช่วงของจอ: เล็ก 2-3 / ใหญ่ 3-5) หรืออัตโนมัติ",
    "  const nCols = useMemo(() => {",
    "    if (!userCols) return autoCols;",
    "    const lo = smallScr ? 2 : 3, hi = smallScr ? 3 : 5;",
    "    return Math.min(hi, Math.max(lo, userCols));",
    "  }, [userCols, autoCols, smallScr]);",
    "  const pickCols = (n) => {",
    "    setUserCols(n); setGridOpen(false);",
    '    try { localStorage.setItem("ca_grid_cols", String(n)); } catch {}',
    "  };",
    "  const dismissGridHint = () => {",
    "    setGridHint(false);",
    '    try { localStorage.setItem("ca_grid_hint_done", "1"); } catch {}',
    "  };",
])
src = rep(A, B, "effect resize → GRID engine")

# ── 4) แถว "พบ N รายการ" → เพิ่มปุ่ม ⊞ + bubble + popover ──
A = NL.join([
    '          <div style={{ padding: "8px 14px 6px" }}>',
    '            <span style={{ fontSize: 11.5, color: C.muted }}>',
    '              {catPath.length > 0 && <span style={{ color: C.brand, fontWeight: 700 }}>{catPath.join(" › ")} · </span>}',
    '              {srBusy ? "กำลังค้นหา... · " : ""}พบ {list.length} รายการ',
    "            </span>",
    "          </div>",
])
B = NL.join([
    '          <div style={{ padding: "8px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>',
    '            <span style={{ fontSize: 11.5, color: C.muted }}>',
    '              {catPath.length > 0 && <span style={{ color: C.brand, fontWeight: 700 }}>{catPath.join(" › ")} · </span>}',
    '              {srBusy ? "กำลังค้นหา... · " : ""}พบ {list.length} รายการ',
    "            </span>",
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
    "          </div>",
])
src = rep(A, B, "แถวพบรายการ + ปุ่มกริด")

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)

# ── sanity check วงเล็บ ──
for a, b in [("{", "}"), ("(", ")"), ("[", "]")]:
    ca, cb = src.count(a), src.count(b)
    assert ca == cb, f"BRACKET FAIL: {a}={ca} vs {b}={cb}"

print("OK: MarketClient.js → GRID-1 ปุ่มปรับคอลัมน์ + จำค่า + bubble แนะนำ · CRLF=" + str(crlf))

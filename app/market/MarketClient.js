"use client";
// app/market/MarketClient.js — ตลาดสกินเต็ม (A4 ก้าว 2)
// derive จาก prototype:
//   - MarketScreen (บรรทัด 903–1028): ค้นหา + ชิปหมวดหลัก/ย่อย 2 ชั้น + "พบ N รายการ" + Masonry 2 คอลัมน์
//   - MasonryCard (บรรทัด 693–771): ราคา dark pill + ป้ายส่งฟรี + ป้ายของใหม่/มือสอง + แถวผู้ขาย (กดเข้าร้าน)
//   - สินค้าขายแล้วจมท้ายรายการเสมอ (บรรทัด 944)
// ปรับจากมือถือ 2 คอลัมน์ → responsive 2/3/4 คอลัมน์ตามความกว้างจอ (แจกการ์ดแบบ index % n เหมือน prototype)
// หมายเหตุ: ฟิลเตอร์ชีต (ราคา/สภาพ/แบรนด์/เรียง) มาในก้าว 3
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, ShieldCheck, Fish, Filter, ChevronRight } from "lucide-react";
import { CAT_MAINS, CATEGORY_TREE, catChildren, ALL_BRANDS, COND_GRADES } from "@/lib/catalog";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", bg2: "#F1F3F4" };
const RATIOS = ["1/1", "3/4", "4/3", "1/1", "3/4", "1/1", "4/3", "3/4"]; // ความสูงแปรผันแบบ prototype (MASONRY_RATIOS)

function MasonryCard({ p, idx, router }) {
  const ratio = RATIOS[idx % RATIOS.length];
  const s = p.seller;
  const sold = p.status === "sold";
  return (
    <div onClick={() => router.push(`/product/${p.id}`)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
      {/* รูปสินค้า — ความสูงแปรผัน */}
      <div style={{ aspectRatio: ratio, background: "#F0F0F0", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: C.brand }}>
        {p.images?.[0]
          ? <img src={p.images[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: sold ? "grayscale(.4)" : "none" }} />
          : <Fish size={24} strokeWidth={1.5} />}
        {sold && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center" }}>
            <span style={{ border: "2px solid #fff", color: "#fff", fontWeight: 800, fontSize: 13, padding: "4px 14px", borderRadius: 999, transform: "rotate(-8deg)", letterSpacing: 1 }}>ขายแล้ว</span>
          </div>
        )}
        {/* ราคา — dark pill มุมซ้ายล่าง (prototype บรรทัด 716–732) */}
        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,.30)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 12px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>THB {Number(p.price || 0).toLocaleString()}</span>
        </div>
        {p.shipping?.mode === "free" && (
          <span style={{ position: "absolute", top: 6, left: 6, background: C.brand, color: "#fff", fontSize: 7.5, fontWeight: 800, padding: "2px 6px", borderRadius: 999 }}>ส่งฟรี</span>
        )}
      </div>
      {/* ข้อมูล */}
      <div style={{ padding: "7px 9px 9px" }}>
        <div style={{ fontSize: 11.5, color: "#111", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 5 }}>{p.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {p.cond && p.cond !== "ของใหม่"
            ? <span style={{ fontSize: 9.5, color: C.muted, background: C.bg2, padding: "2px 7px", borderRadius: 999 }}>มือสอง{p.cond_label ? ` · ${p.cond_label}` : ""}</span>
            : <span style={{ fontSize: 9.5, color: C.brand, background: C.brandTint, padding: "2px 7px", borderRadius: 999, fontWeight: 600 }}>ของใหม่</span>}
        </div>
        {/* ผู้ขาย — กดเข้าหน้าร้าน (prototype บรรทัด 753–767) */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: s?.is_shop ? "#FBEEDD" : C.brandTint, color: s?.is_shop ? "#B8790A" : C.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, flex: "none" }}>
            {(s?.name || "?").charAt(0).toUpperCase()}
          </div>
          <span onClick={(e) => { e.stopPropagation(); router.push(`/seller/${p.seller_id}`); }}
            style={{ fontSize: 9.5, color: C.brand, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {s?.name || "ผู้ขาย"}
          </span>
          {s?.kyc_status === "verified" ? <ShieldCheck size={9} color={C.brand} /> : null}
          {p.location ? <span style={{ fontSize: 9, color: C.muted, flex: "none" }}>{p.location}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function MarketClient({ products, loggedIn }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mainCat, setMainCat] = useState("ทั้งหมด");
  const [subCat, setSubCat] = useState("ทั้งหมด");
  const [nCols, setNCols] = useState(2);
  // ฟิลเตอร์ชีต (prototype MarketScreen บรรทัด 912–925, 1030–1090)
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [cond, setCond] = useState("ทั้งหมด");
  const [brand, setBrand] = useState("ทั้งหมด");
  const [brandQ, setBrandQ] = useState("");
  const [sortBy, setSortBy] = useState("ล่าสุด");
  const activeFilterCount =
    (priceMin || priceMax ? 1 : 0) + (cond !== "ทั้งหมด" ? 1 : 0) + (brand !== "ทั้งหมด" ? 1 : 0) + (sortBy !== "ล่าสุด" ? 1 : 0);
  const resetFilters = () => { setPriceMin(""); setPriceMax(""); setCond("ทั้งหมด"); setBrand("ทั้งหมด"); setBrandQ(""); setSortBy("ล่าสุด"); };

  // responsive: <640→2 / <1024→3 / กว้าง→4 คอลัมน์
  useEffect(() => {
    const f = () => setNCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const mains = ["ทั้งหมด", ...CAT_MAINS];
  const subs = mainCat === "ทั้งหมด" ? [] : ["ทั้งหมด", ...catChildren(CATEGORY_TREE[mainCat]).map(c => c.name)];
  const selectMain = m => { setMainCat(m); setSubCat("ทั้งหมด"); };

  const list = useMemo(() => {
    let l = products;
    if (mainCat !== "ทั้งหมด") l = l.filter(p => p.cat_main === mainCat);
    if (subCat !== "ทั้งหมด") l = l.filter(p => p.cat_sub === subCat);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter(p => `${p.name} ${p.brand || ""} ${p.location || ""} ${p.seller?.name || ""}`.toLowerCase().includes(s));
    // ฟิลเตอร์ชีต (prototype บรรทัด 934–942)
    if (priceMin) l = l.filter(p => Number(p.price) >= Number(priceMin));
    if (priceMax) l = l.filter(p => Number(p.price) <= Number(priceMax));
    if (cond === "ของใหม่") l = l.filter(p => (p.cond || "").includes("ของใหม่"));
    else if (cond === "มือสอง") l = l.filter(p => (p.cond || "").includes("มือสอง"));
    else if (cond !== "ทั้งหมด") l = l.filter(p => (p.cond_label || "") === cond);
    if (brand !== "ทั้งหมด") l = l.filter(p => (p.brand || "") === brand);
    if (sortBy === "priceAsc") l = [...l].sort((a, b) => a.price - b.price);
    if (sortBy === "priceDesc") l = [...l].sort((a, b) => b.price - a.price);
    if (sortBy === "views") l = [...l].sort((a, b) => (b.views || 0) - (a.views || 0));
    // ขายแล้วจมท้ายเสมอ (stable sort — prototype บรรทัด 944)
    return [...l].sort((a, b) => (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0));
  }, [products, q, mainCat, subCat, priceMin, priceMax, cond, brand, sortBy]);

  // แจกการ์ดเข้าคอลัมน์แบบ index % n (prototype บรรทัด 1015–1026)
  const cols = useMemo(() => {
    const c = Array.from({ length: nCols }, () => []);
    list.forEach((p, i) => c[i % nCols].push({ p, i }));
    return c;
  }, [list, nCols]);

  const chip = (on, small) => ({
    flex: "none", padding: small ? "6px 12px" : "7px 14px", borderRadius: 999, fontSize: small ? 11.5 : 12.5, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
    background: on ? (small ? C.brandTint : C.brand) : (small ? "transparent" : "#fff"),
    color: on ? (small ? C.brand : "#fff") : (small ? C.muted : C.ink),
    border: `1px solid ${on ? C.brand : C.line}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, sans-serif", paddingBottom: 90 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ padding: "16px 14px 10px" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>ตลาดอุปกรณ์ตกปลา</div>
        </div>

        {/* ค้นหา (ปุ่มฟิลเตอร์มาในก้าวถัดไป) */}
        <div style={{ padding: "0 14px 10px", display: "flex", gap: 8 }}>
          <div style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, background: "#fff" }}>
            <Search size={16} color={C.muted} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า หรือชื่อร้านค้า..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", color: C.ink, background: "transparent" }} />
            {q ? <span onClick={() => setQ("")} style={{ cursor: "pointer", color: C.muted, display: "flex" }}><X size={14} /></span> : null}
          </div>
          <button onClick={() => setFilterOpen(true)} style={{
            width: 42, height: 42, borderRadius: 12, border: `1px solid ${activeFilterCount ? C.brand : C.line}`,
            background: activeFilterCount ? C.brandTint : "#fff", color: C.brand, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", flex: "none", position: "relative",
          }}>
            <Filter size={17} />
            {activeFilterCount ? (
              <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 3px", borderRadius: 999, background: "#C0392B", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{activeFilterCount}</span>
            ) : null}
          </button>
        </div>

        {/* ชิปหมวดหลัก */}
        <div style={{ padding: "0 14px", display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {mains.map(t => <div key={t} onClick={() => selectMain(t)} style={chip(mainCat === t, false)}>{t}</div>)}
        </div>

        {/* ชิปหมวดย่อยชั้นสอง */}
        {mainCat !== "ทั้งหมด" && (
          <div style={{ padding: "8px 14px 0", display: "flex", gap: 8, overflowX: "auto" }}>
            {subs.map(t => <div key={t} onClick={() => setSubCat(t)} style={chip(subCat === t, true)}>{t}</div>)}
          </div>
        )}

        <div style={{ padding: "8px 14px 6px" }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>พบ {list.length} รายการ</span>
        </div>

        {/* Masonry — คอลัมน์สูงไม่เท่ากัน คอลัมน์คู่เยื้องลง (prototype บรรทัด 1014–1027) */}
        {list.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 12.5, padding: "40px 0" }}>
            ไม่พบสินค้า — <Link href="/sell" style={{ color: C.brand, fontWeight: 800 }}>เป็นคนแรกที่ลงขายเลย</Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, padding: "6px 10px 14px", alignItems: "flex-start" }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: ci % 2 === 1 ? 24 : 0 }}>
                {col.map(({ p, i }) => <MasonryCard key={p.id} p={p} idx={i} router={router} />)}
              </div>
            ))}
          </div>
        )}

        {/* ฟิลเตอร์ชีต (prototype บรรทัด 1030–1090) */}
        {filterOpen && (
          <div onClick={() => setFilterOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, margin: "0 auto", background: "#fff", borderRadius: "20px 20px 0 0", padding: "10px 18px 26px", maxHeight: "82%", overflowY: "auto", boxSizing: "border-box" }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: C.line, margin: "6px auto 16px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>ตัวกรองสินค้า</span>
                <span onClick={resetFilters} style={{ fontSize: 12, color: C.brand, fontWeight: 700, cursor: "pointer" }}>ล้างตัวกรอง</span>
              </div>

              {/* หมวดหมู่ที่เลือก (เลือก/เปลี่ยนจากชิปด้านนอก) */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>หมวดหมู่</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 42, border: `1px solid ${mainCat !== "ทั้งหมด" ? C.brand : C.line}`, borderRadius: 10, padding: "8px 12px", marginBottom: 20, background: mainCat !== "ทั้งหมด" ? C.brandTint : "#fff" }}>
                <span style={{ fontSize: 12.5, color: mainCat !== "ทั้งหมด" ? C.brand : C.muted, fontWeight: mainCat !== "ทั้งหมด" ? 700 : 400 }}>
                  {mainCat !== "ทั้งหมด" ? (mainCat + (subCat !== "ทั้งหมด" ? " › " + subCat : "")) : "ทุกหมวดหมู่ — เลือกจากแถบหมวดด้านบน"}
                </span>
                {mainCat !== "ทั้งหมด"
                  ? <span onClick={() => { setMainCat("ทั้งหมด"); setSubCat("ทั้งหมด"); }} style={{ fontSize: 11.5, color: C.brand, textDecoration: "underline", cursor: "pointer" }}>ล้าง</span>
                  : <ChevronRight size={17} color={C.muted} />}
              </div>

              {/* ช่วงราคา */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>ช่วงราคา (บาท)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <input value={priceMin} onChange={e => setPriceMin(e.target.value.replace(/[^0-9]/g, ""))} placeholder="ต่ำสุด"
                  style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px", fontSize: 13, fontFamily: "inherit", outline: "none", color: C.ink, minWidth: 0 }} />
                <span style={{ color: C.muted, fontSize: 12 }}>—</span>
                <input value={priceMax} onChange={e => setPriceMax(e.target.value.replace(/[^0-9]/g, ""))} placeholder="สูงสุด"
                  style={{ flex: 1, height: 42, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px", fontSize: 13, fontFamily: "inherit", outline: "none", color: C.ink, minWidth: 0 }} />
              </div>

              {/* สภาพสินค้า: ทั้งหมด/ของใหม่/มือสอง + 5 เกรด (CondFilter) */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>สภาพสินค้า</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
                {["ทั้งหมด", "ของใหม่", "มือสอง", ...COND_GRADES.map(g => g.key)].map(k => (
                  <div key={k} onClick={() => setCond(k)} style={{
                    padding: "7px 13px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: cond === k ? C.brand : "#fff", color: cond === k ? "#fff" : C.ink, border: `1px solid ${cond === k ? C.brand : C.line}`,
                  }}>{k}</div>
                ))}
              </div>

              {/* แบรนด์ — มีช่องค้นหา (BrandPicker) */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>แบรนด์</div>
              <input value={brandQ} onChange={e => setBrandQ(e.target.value)} placeholder="ค้นหาแบรนด์..."
                style={{ width: "100%", height: 40, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px", fontSize: 12.5, fontFamily: "inherit", outline: "none", color: C.ink, boxSizing: "border-box", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20, maxHeight: 130, overflowY: "auto" }}>
                {["ทั้งหมด", ...ALL_BRANDS.filter(b => !brandQ || b.toLowerCase().includes(brandQ.toLowerCase()))].map(b => (
                  <div key={b} onClick={() => setBrand(b)} style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                    background: brand === b ? C.brandTint : "#fff", color: brand === b ? C.brand : C.muted, border: `1px solid ${brand === b ? C.brand : C.line}`,
                  }}>{b}</div>
                ))}
              </div>

              {/* เรียงลำดับ */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>เรียงลำดับ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {[["ล่าสุด", "ล่าสุด"], ["priceAsc", "ราคา: ต่ำไปสูง"], ["priceDesc", "ราคา: สูงไปต่ำ"], ["views", "ยอดเข้าชมสูงสุด"]].map(([k, l]) => (
                  <div key={k} onClick={() => setSortBy(k)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${sortBy === k ? C.brand : C.line}`, background: sortBy === k ? C.brand : "transparent", flex: "none", boxShadow: sortBy === k ? "inset 0 0 0 2.5px #fff" : "none" }} />
                    <span style={{ fontSize: 13, color: C.ink }}>{l}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setFilterOpen(false)} style={{ width: "100%", height: 48, border: "none", borderRadius: 12, background: C.brand, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                แสดงผลลัพธ์ ({list.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

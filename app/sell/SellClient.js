"use client";
// app/sell/SellClient.js — ลงขายสินค้า + แก้ไขประกาศ (W5.8: ยกเครื่องตาม prototype WSell บรรทัด 6925)
// ลำดับฟิลด์ตาม prototype: ชื่อ → หมวดหมู่(modal) → แบรนด์(แผงจัดกลุ่มตัวอักษร) → รายละเอียด → รูปภาพ(tile ✕) →
//   สัดส่วนรูปในตลาด(1:1/3:4/4:3 → products.image_ratio) → ราคา+กล่องค่าธรรมเนียม → สภาพ(เกรด radio card) →
//   จุดที่ควรรู้(preset+พิมพ์เอง) → จังหวัด/สต็อก → การจัดส่ง
// กติกาที่คงไว้: แบรนด์ใหม่ **หรือ** หมวดย่อยใหม่ (ขอเพิ่มใน modal) → สินค้า status "review" ซ่อนจากตลาดจนแอดมินอนุมัติ
//   · โหมดแก้ไข (?edit=) เติมค่าเดิมครบ + คงสถานะเดิม
// S4 (เคาะแล้ว = แบบ B): ฐานค่าธรรมเนียม = ราคาขาย + ค่าส่งที่ผู้ซื้อจ่าย · คำนวณผ่าน feeFor เท่านั้น
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, ChevronLeft, X, Search, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CAT_MAINS, catNodeAt, catChildren, COND_GRADES, ISSUE_PRESETS, ALL_BRANDS } from "@/lib/catalog";
import AiFillCard from "@/components/AiFillCard";
import { feeFor, feeTierRange } from "@/lib/fees";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const RATIOS = [["1/1", "จัตุรัส"], ["3/4", "แนวตั้ง"], ["4/3", "แนวนอน"]];
const PROVINCES = ["กรุงเทพฯ", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"];

export default function SellClient({ userId, tiers, editProduct = null }) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!editProduct;
  const ep = editProduct || {};

  const [f, setF] = useState({
    name: ep.name || "", description: ep.description || "", price: ep.price != null ? String(ep.price) : "",
    brand: ep.brand || "", isNew: isEdit ? ep.cond === "ของใหม่" : true, grade: ep.cond_label || "",
    issues: ep.issues || [], condNote: ep.cond_note || "", location: ep.location || "",
    shipMode: ep.shipping?.mode === "paid" ? "paid" : "free", shipFee: ep.shipping?.fee != null ? String(ep.shipping.fee) : "",
    stock: ep.stock ?? 1,  // ?? ไม่ใช่ || — สต๊อค 0 ต้องโชว์ 0 (|| จะเหมาว่า 0 = ไม่มีค่า แล้วเด้งเป็น 1) ratio: ep.image_ratio || "1/1",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [catPath, setCatPath] = useState(isEdit && ep.cat_main ? [ep.cat_main, ...(ep.cat_sub ? ep.cat_sub.split(" › ") : [])] : []);
  // ระบบรูปแบบลิสต์เดียว (จัดเรียง+ตั้งปกได้ ทั้งรูปเดิมและรูปใหม่ปนกัน) — ลำดับในลิสต์ = ลำดับที่บันทึกจริง รูปแรก = ปก
  const [imgs, setImgs] = useState(isEdit ? (ep.images || []).map(url => ({ k: "old", url })) : []);
  const [issueInput, setIssueInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const price = Number(f.price) || 0;
  // S4 (เคาะแล้ว = แบบ B): ฐานค่าธรรมเนียม = ราคาขาย + ค่าส่งที่ผู้ซื้อจ่าย — คำนวณผ่าน feeFor เท่านั้น (กติกาเหล็กข้อ 1)
  const shipFeeNum = f.shipMode === "paid" ? (Number(f.shipFee) || 0) : 0;
  const feeBase = price + shipFeeNum;
  const fee = useMemo(() => feeFor(feeBase, tiers, "seller"), [feeBase, tiers]);
  const net = feeBase - fee; // คุณจะได้รับ = (ราคา+ค่าส่ง) − ค่าธรรมเนียม
  const range = useMemo(() => feeTierRange(feeBase, tiers), [feeBase, tiers]);

  /* ── รูปภาพ: เพิ่มหลายรอบ ≤10 · ลบรายรูป · ตั้งปก (ย้ายขึ้นหน้า) · เลื่อนซ้าย/ขวา ── */
  const pickFiles = e => {
    const add = Array.from(e.target.files || []).slice(0, Math.max(0, 10 - imgs.length));
    if (add.length) setImgs(l => [...l, ...add.map(f => ({ k: "new", file: f, prev: URL.createObjectURL(f) }))]);
    e.target.value = "";
  };
  const removeImg = i => setImgs(l => { if (l[i].k === "new") URL.revokeObjectURL(l[i].prev); return l.filter((_, x) => x !== i); });
  const setCover = i => setImgs(l => [l[i], ...l.filter((_, x) => x !== i)]);
  const moveImg = (i, d) => setImgs(l => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const totalImgs = imgs.length;

  /* ── AI1: รับ draft จาก AiFillCard — เติมเฉพาะช่องที่ยังว่าง ไม่ทับของที่ผู้ใช้พิมพ์เอง ──
     กติกา: AI ไม่แตะ สภาพ/เกรด/ตำหนิ/ราคา เด็ดขาด (ผู้ขายกำหนดเอง) */
  const applyDraft = (d) => {
    const filled = [], skipped = [];
    if (!f.name.trim() && d.title) { set("name", d.title); filled.push("ชื่อสินค้า"); }
    else skipped.push("ชื่อสินค้า");
    if (!catPath.length && Array.isArray(d.catPath) && d.catPath.length) { setCatPath(d.catPath); filled.push("หมวดหมู่"); }
    else skipped.push("หมวดหมู่");
    if (!f.brand.trim() && d.brand) { set("brand", d.brand); filled.push("แบรนด์"); }
    else skipped.push("แบรนด์");
    if (!f.description.trim()) {
      const lines = [];
      if (d.description) lines.push(d.description);
      const extra = [];
      if (d.model) extra.push(`รุ่น: ${d.model}`);
      if (d.brandCountry) extra.push(`ประเทศแบรนด์: ${d.brandCountry}`);
      for (const [k, v] of Object.entries(d.specs || {})) extra.push(`${k}: ${v}`);
      if (extra.length) lines.push("", "สเปก:", ...extra.map(s => "• " + s));
      if (lines.length) { set("description", lines.join("\n")); filled.push("รายละเอียด+สเปก"); }
      else skipped.push("รายละเอียด");
    } else skipped.push("รายละเอียด");
    return { filled, skipped: skipped.filter(s => !filled.includes(s)) };
  };

  /* ── แบรนด์: แผงจัดกลุ่มตามตัวอักษร + แบรนด์ใหม่ → รอตรวจ ── */
  const isNewBrand = !!f.brand.trim() && !ALL_BRANDS.some(b => b.toLowerCase() === f.brand.trim().toLowerCase());
  const [brandOpen, setBrandOpen] = useState(false);
  const [provOpen, setProvOpen] = useState(false); // แผงเลือกจังหวัด (พิมพ์ค้นหาได้แบบช่องแบรนด์)
  const brandGroups = useMemo(() => {
    const q = f.brand.trim().toLowerCase();
    const list = ALL_BRANDS.filter(b => !q || b.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
    const g = {};
    list.forEach(b => { const k = b.charAt(0).toUpperCase(); (g[k] = g[k] || []).push(b); });
    return Object.entries(g);
  }, [f.brand]);

  /* ── หมวดหมู่แบบ modal (prototype 6-4/6-5): ไล่ชั้น + ค้นหา + ขอเพิ่มหมวดย่อย ── */
  const [catOpen, setCatOpen] = useState(false);
  const [mPath, setMPath] = useState([]);       // เส้นทางที่กำลังไล่ดูใน modal
  const [catQ, setCatQ] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const levelOptions = useMemo(() => {
    const opts = mPath.length === 0 ? CAT_MAINS : catChildren(catNodeAt(mPath)).map(k => k.name);
    const q = catQ.trim().toLowerCase();
    return q ? opts.filter(o => o.toLowerCase().includes(q)) : opts;
  }, [mPath, catQ]);
  const hasKids = name => catChildren(catNodeAt([...mPath, name])).length > 0;
  const openCat = () => { setMPath(catPath.length ? catPath.slice(0, -1) : []); setCatQ(""); setReqOpen(false); setReqName(""); setCatOpen(true); };
  const chooseLeaf = name => { setCatPath([...mPath, name]); setCatOpen(false); };
  const chooseHere = () => { if (mPath.length) { setCatPath([...mPath]); setCatOpen(false); } };
  const requestNewCat = () => {
    const nm = reqName.trim();
    if (!nm || !mPath.length) return;
    setCatPath([...mPath, nm]);   // หมวดย่อยใหม่ต่อท้ายเส้นทางปัจจุบัน
    setCatOpen(false);
  };
  // หมวดใหม่ = เส้นทางที่ resolve ในต้นไม้จริงไม่ได้ (มีชิ้นที่ผู้ใช้ขอเพิ่มเอง)
  const isNewCat = catPath.length > 0 && !catNodeAt(catPath);
  const needsReview = isNewBrand || isNewCat;

  const submit = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("กรอกชื่อสินค้า");
    if (!price || price <= 0) return setErr("กรอกราคาให้ถูกต้อง");
    if (!catPath.length) return setErr("เลือกหมวดหมู่สินค้า");
    if (!f.isNew && !f.grade) return setErr("สินค้ามือสองต้องเลือกเกรดสภาพ");
    if (totalImgs === 0) return setErr("ใส่รูปสินค้าอย่างน้อย 1 รูป");
    const stockNum = Math.round(Number(f.stock));
    if (!Number.isFinite(stockNum) || stockNum < 1 || stockNum > 999)
      return setErr('จำนวนสต็อกต้องเป็น 1–999 — ต้องการปิดการขาย ใช้ปุ่ม "ทำเครื่องหมายขายแล้ว" ในหน้าสินค้าที่ลงขาย');
    if (f.shipMode === "paid" && !(Number(f.shipFee) >= 0)) return setErr("กรอกค่าส่ง");
    setBusy(true);
    try {
      // อัปโหลดรูปใหม่ตามตำแหน่งจริงในลิสต์ — ลำดับที่ผู้ขายจัด = ลำดับที่บันทึก (รูปแรกคือปก)
      const allImgs = [];
      for (const it of imgs) {
        if (it.k === "old") { allImgs.push(it.url); continue; }
        const ext = (it.file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, it.file, { cacheControl: "3600" });
        if (error) throw error;
        allImgs.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      // SELL-API: บันทึกผ่าน API — server ตรวจตัวกรอง/แบน/สิทธิ์/status เองทั้งหมด
      // (RLS ฝั่ง client ถูกถอนแล้ว — insert/update ตรงจากหน้านี้ทำไม่ได้อีก)
      const res = await fetch("/api/products/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editId: isEdit ? editProduct.id : null,
          name: f.name, description: f.description, price,
          catPath, brand: f.brand,
          isNew: f.isNew, grade: f.grade, condNote: f.condNote,
          issues: f.isNew ? [] : f.issues,
          location: f.location, stock: f.stock,
          shipMode: f.shipMode, shipFee: f.shipFee,
          images: allImgs, ratio: f.ratio,
        }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out.error || "บันทึกไม่สำเร็จ");
      router.push(isEdit || out.needsReview ? "/my-products" : "/market");
      router.refresh();
    } catch (e) {
      setErr("บันทึกไม่สำเร็จ: " + (e.message || e));
      setBusy(false);
    }
  };

  const input = { width: "100%", height: 42, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none", background: "#fff", color: C.ink, fontFamily: "inherit" };
  const label = { fontSize: 12.5, fontWeight: 800, color: C.ink, margin: "16px 0 8px" };
  const chip = on => ({ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brandTint : "#fff", color: on ? C.brand : C.muted });
  const warnBox = { marginTop: 6, fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", lineHeight: 1.6 };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={() => router.back()} aria-label="กลับ" style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, cursor: "pointer" }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{isEdit ? "แก้ไขประกาศ" : "ลงขายสินค้า"}</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "8px 22px 22px", boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>

          {/* ── ชื่อสินค้า ── */}
          <div style={label}>ชื่อสินค้า <span style={{ color: C.danger }}>*</span></div>
          <input style={input} value={f.name} onChange={e => set("name", e.target.value)} placeholder="เช่น คันเบ็ด Shimano 7ft" />

          {/* ── หมวดหมู่ (modal — prototype ภาพ 4-6) ── */}
          <div style={label}>หมวดหมู่ <span style={{ color: C.danger }}>*</span></div>
          <div onClick={openCat} style={{ ...input, height: "auto", minHeight: 42, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", cursor: "pointer", borderColor: catPath.length ? C.brand : C.line, background: catPath.length ? C.brandTint : "#fff" }}>
            <span style={{ fontSize: 13.5, color: catPath.length ? C.brand : C.muted, fontWeight: catPath.length ? 700 : 400 }}>
              {catPath.length ? catPath.join(" › ") : "เลือกหมวดหมู่สินค้า"}
            </span>
            <ChevronRight size={17} color={C.muted} style={{ flex: "none" }} />
          </div>
          {isNewCat && (
            <div style={warnBox}>＋ หมวดย่อยใหม่ "{catPath[catPath.length - 1]}" — ลงขายได้เลย แต่สินค้าจะอยู่สถานะ <b>รอตรวจ</b> จนกว่าทีมงานอนุมัติหมวดหมู่</div>
          )}

          {/* ── แบรนด์ (แผงค้นหา + จัดกลุ่มตัวอักษร — prototype ภาพ 7) ── */}
          <div style={label}>แบรนด์</div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, display: "flex" }}><Search size={15} /></div>
            <input style={{ ...input, padding: "0 36px" }} value={f.brand}
              onChange={e => { set("brand", e.target.value); setBrandOpen(true); }}
              onFocus={() => setBrandOpen(true)}
              placeholder="พิมพ์ค้นหาแบรนด์ เช่น Shimano" />
            {f.brand && <span onClick={() => set("brand", "")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, cursor: "pointer", display: "flex" }}><X size={15} /></span>}
            {brandOpen && (
              <>
                <div onClick={() => setBrandOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 21, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 260, overflowY: "auto" }}>
                  <div onClick={() => { set("brand", ""); setBrandOpen(false); }}
                    style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, color: C.brand, cursor: "pointer", borderBottom: `1px solid ${C.line}` }}>ทุกแบรนด์</div>
                  {brandGroups.map(([letter, list]) => (
                    <div key={letter}>
                      <div style={{ padding: "5px 14px", fontSize: 11, fontWeight: 800, color: C.muted, background: C.bg }}>{letter}</div>
                      {list.map(b => (
                        <div key={b} onClick={() => { set("brand", b); setBrandOpen(false); }}
                          style={{ padding: "9px 14px", fontSize: 12.5, color: C.ink, cursor: "pointer" }}>{b}</div>
                      ))}
                    </div>
                  ))}
                  {brandGroups.length === 0 && (
                    <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.muted, textAlign: "center" }}>ไม่พบแบรนด์ "{f.brand.trim()}"</div>
                  )}
                  {isNewBrand && (
                    <div onClick={() => setBrandOpen(false)}
                      style={{ padding: "11px 14px", fontSize: 12.5, fontWeight: 800, color: C.brand, cursor: "pointer", borderTop: `1px dashed ${C.line}` }}>＋ เพิ่มแบรนด์ "{f.brand.trim()}" · รอตรวจสอบ</div>
                  )}
                </div>
              </>
            )}
          </div>
          {isNewBrand && (
            <div style={warnBox}>＋ แบรนด์ใหม่ "{f.brand.trim()}" — ลงขายได้เลย แต่สินค้าจะอยู่สถานะ <b>รอตรวจ</b> (ยังไม่ขึ้นตลาด) จนกว่าทีมงานอนุมัติแบรนด์</div>
          )}

          {/* ── รายละเอียด ── */}
          <div style={label}>รายละเอียดสินค้า</div>
          <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={4} placeholder="อธิบายสภาพ สเปก ตำหนิ (ถ้ามี) และเหตุผลที่ควรซื้อ..."
            style={{ ...input, height: "auto", padding: 12, resize: "vertical" }} />

          {/* ── รูปภาพ: ช่อง tile ทันสมัย (prototype ภาพ 2) ── */}
          <div style={label}>รูปภาพสินค้า ({totalImgs}/10) <span style={{ color: C.danger }}>*</span> <span style={{ fontWeight: 500, color: C.muted }}>— รูปแรกคือรูปปกในตลาด</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 92px)", gap: 12, rowGap: 26 }}>
            {imgs.map((it, i) => (
              <div key={it.k === "old" ? it.url : it.prev} style={{ position: "relative", width: 92 }}>
                <img src={it.k === "old" ? it.url : it.prev} alt=""
                  style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 12, border: `2px solid ${i === 0 ? C.brand : C.line}`, display: "block", boxSizing: "border-box" }} />
                {i === 0 && <span style={{ position: "absolute", left: 5, top: 5, background: C.brand, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999 }}>ปก</span>}
                <button type="button" onClick={() => removeImg(i)} aria-label="ลบรูปนี้"
                  style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", border: "2px solid #fff", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                {/* แถวจัดเรียง: ◀ ตั้งปก ▶ */}
                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 4 }}>
                  <button type="button" onClick={() => moveImg(i, -1)} disabled={i === 0} aria-label="เลื่อนซ้าย"
                    style={{ width: 22, height: 20, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", color: i === 0 ? C.line : C.muted, fontSize: 10, cursor: i === 0 ? "default" : "pointer", lineHeight: 1 }}>◀</button>
                  {i > 0 && (
                    <button type="button" onClick={() => setCover(i)}
                      style={{ height: 20, padding: "0 8px", border: `1px solid ${C.brand}`, borderRadius: 6, background: C.brandTint, color: C.brand, fontSize: 9.5, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>ตั้งปก</button>
                  )}
                  <button type="button" onClick={() => moveImg(i, 1)} disabled={i === imgs.length - 1} aria-label="เลื่อนขวา"
                    style={{ width: 22, height: 20, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", color: i === imgs.length - 1 ? C.line : C.muted, fontSize: 10, cursor: i === imgs.length - 1 ? "default" : "pointer", lineHeight: 1 }}>▶</button>
                </div>
              </div>
            ))}
            {totalImgs < 10 && (
              <label style={{ width: 92, height: 92, border: `1.5px dashed ${C.line}`, borderRadius: 12, display: "grid", placeItems: "center", cursor: "pointer", color: C.muted, background: "#FAFBFB", boxSizing: "border-box" }}>
                <span style={{ display: "grid", justifyItems: "center", gap: 4 }}>
                  <Camera size={20} />
                  <span style={{ fontSize: 10.5, fontWeight: 700 }}>เพิ่มรูป</span>
                </span>
                <input type="file" accept="image/*" multiple hidden onChange={pickFiles} />
              </label>
            )}
          </div>

          {/* ── AI1: ปุ่ม AI ช่วยกรอกจากรูป (ใช้รูปใหม่ ≤5 รูปแรก) ── */}
          <AiFillCard imgs={imgs} onDraft={applyDraft} />

          {/* ── สัดส่วนรูปภาพในตลาด (prototype ภาพ 2) ── */}
          <div style={label}>สัดส่วนรูปภาพในตลาด</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: -4, marginBottom: 8 }}>เลือกให้เหมาะกับรูปสินค้า — มีผลกับการ์ดในตลาด</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {RATIOS.map(([r, name]) => {
              const on = f.ratio === r;
              return (
                <div key={r} onClick={() => set("ratio", r)}
                  style={{ border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brandTint : "#fff", borderRadius: 14, padding: "14px 10px", cursor: "pointer", display: "grid", justifyItems: "center", gap: 8 }}>
                  <div style={{ width: r === "4/3" ? 52 : 40, aspectRatio: r, borderRadius: 8, background: on ? C.brand : "#E3E6E7" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{r.replace("/", ":")}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{name}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── สภาพสินค้า + เกรดแบบ radio card (prototype ภาพ 3) ── */}
          <div style={label}>สภาพสินค้า <span style={{ color: C.danger }}>*</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={chip(f.isNew)} onClick={() => set("isNew", true)}>ของใหม่</div>
            <div style={chip(!f.isNew)} onClick={() => set("isNew", false)}>มือสอง</div>
          </div>
          {!f.isNew && (
            <>
              <div style={{ ...label, marginBottom: 2 }}>เกรดสภาพ</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>เลือกได้ 1 · ไล่ระดับชัดเจน ไม่ทับกัน</div>
              <div style={{ display: "grid", gap: 8 }}>
                {COND_GRADES.map(g => {
                  const on = f.grade === g.key;
                  return (
                    <div key={g.key} onClick={() => set("grade", g.key)}
                      style={{ display: "flex", gap: 12, alignItems: "flex-start", border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brandTint : "#fff", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff", flex: "none", marginTop: 1, boxShadow: on ? "inset 0 0 0 3px #fff" : "none" }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: on ? C.brand : C.ink }}>{g.key}</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{g.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ ...label, marginBottom: 2 }}>จุดที่ควรรู้ / ตำหนิ</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>เลือกได้หลายข้อ · แยกจากเกรด (เกรดดีก็มีตำหนิเล็กน้อยได้)</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {[...new Set([...ISSUE_PRESETS, ...f.issues])].map(x => {
                  const on = f.issues.includes(x);
                  return (
                    <div key={x} style={chip(on)} onClick={() => set("issues", on ? f.issues.filter(i => i !== x) : [...f.issues, x])}>
                      {on ? "✓ " : "＋ "}{x}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input style={{ ...input, flex: 1 }} value={issueInput} onChange={e => setIssueInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && issueInput.trim()) { set("issues", [...new Set([...f.issues, issueInput.trim()])]); setIssueInput(""); } }}
                  placeholder="พิมพ์หัวข้อที่ผู้ซื้อควรรู้..." />
                <button type="button" onClick={() => { if (issueInput.trim()) { set("issues", [...new Set([...f.issues, issueInput.trim()])]); setIssueInput(""); } }}
                  style={{ height: 42, padding: "0 18px", border: "none", borderRadius: 12, background: C.brandTint, color: C.brand, fontWeight: 800, fontSize: 13, cursor: "pointer", flex: "none" }}>เพิ่ม</button>
              </div>
              <div style={label}>หมายเหตุสภาพ</div>
              <input style={input} value={f.condNote} onChange={e => set("condNote", e.target.value)} placeholder="เช่น มีรอยที่ฝาข้าง ใช้งานปกติ" />
            </>
          )}

          {/* ── จังหวัด / สต็อก ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={label}>จังหวัดที่ส่งของ</div>
              <div style={{ position: "relative" }}>
                <input style={input} value={f.location}
                  onChange={e => { set("location", e.target.value); setProvOpen(true); }}
                  onFocus={() => setProvOpen(true)}
                  placeholder="พิมพ์ค้นหาจังหวัด..." />
                {provOpen && (
                  <>
                    <div onClick={() => setProvOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 21, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 220, overflowY: "auto" }}>
                      {PROVINCES.filter(p => !f.location.trim() || p.includes(f.location.trim())).map(p => (
                        <div key={p} onClick={() => { set("location", p); setProvOpen(false); }}
                          style={{ padding: "9px 14px", fontSize: 12.5, color: C.ink, cursor: "pointer" }}>{p}</div>
                      ))}
                      {PROVINCES.filter(p => !f.location.trim() || p.includes(f.location.trim())).length === 0 && (
                        <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.muted, textAlign: "center" }}>ไม่พบจังหวัด</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <div style={label}>จำนวนสต็อก</div>
              <input style={input} type="number" min={1} value={f.stock} onChange={e => set("stock", e.target.value)} />
            </div>
          </div>

          {/* ── การจัดส่ง ── */}
          <div style={label}>การจัดส่ง <span style={{ color: C.danger }}>*</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={chip(f.shipMode === "free")} onClick={() => set("shipMode", "free")}>ส่งฟรี</div>
            <div style={chip(f.shipMode === "paid")} onClick={() => set("shipMode", "paid")}>ผู้ซื้อจ่ายค่าส่ง</div>
            {f.shipMode === "paid" && (
              <input style={{ ...input, width: 120 }} type="number" min={0} value={f.shipFee} onChange={e => set("shipFee", e.target.value)} placeholder="ค่าส่ง ฿" />
            )}
          </div>

          {/* ── ราคาขาย (ล่างสุด) + กล่องค่าธรรมเนียม — ฐานคำนวณ = ราคา + ค่าส่งที่ผู้ซื้อจ่าย (S4 แบบ B) ── */}
          <div style={label}>ราคาขาย (บาท) <span style={{ color: C.danger }}>*</span></div>
          <input style={input} type="number" min={0} value={f.price} onChange={e => set("price", e.target.value)} placeholder="0" />
          {price > 0 && (
            <div style={{ marginTop: 10, background: C.brandTint, borderRadius: 12, padding: "12px 14px" }}>
              {shipFeeNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.muted }}>ราคาขาย + ค่าส่งที่ผู้ซื้อจ่าย</span><b style={{ color: C.ink }}>{baht(feeBase)}</b>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: shipFeeNum > 0 ? 4 : 0 }}>
                <span style={{ color: C.muted }}>ค่าธรรมเนียมผู้ขาย{shipFeeNum > 0 ? " (คิดจากราคา+ค่าส่ง)" : ""}</span><b style={{ color: C.ink }}>−{baht(fee)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginTop: 4 }}>
                <span style={{ fontWeight: 800, color: C.ink }}>คุณจะได้รับ</span>
                <b style={{ color: C.ok, fontSize: 17 }}>{baht(net)}</b>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>ⓘ ช่วงราคา {range.label} — โอนให้หลังผู้ซื้อยืนยันรับสินค้า</div>
            </div>
          )}

          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

          <button onClick={submit} disabled={busy}
            style={{ marginTop: 16, width: "100%", height: 50, border: "none", borderRadius: 12, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
            {busy ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "ลงขายสินค้า"}
          </button>
          {isEdit && (
            <button type="button" onClick={() => router.back()} disabled={busy}
              style={{ marginTop: 10, width: "100%", height: 44, borderRadius: 12, border: `1.5px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              ยกเลิกการเปลี่ยนแปลง — กลับโดยไม่บันทึก
            </button>
          )}
        </div>
      </div>

      {/* ── Modal เลือกหมวดหมู่ (prototype ภาพ 4-6) ── */}
      {catOpen && (
        <div onClick={() => setCatOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "86vh", background: "#fff", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
              {mPath.length > 0 && (
                <button onClick={() => { setMPath(p => p.slice(0, -1)); setCatQ(""); setReqOpen(false); }} aria-label="ย้อนกลับ"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: C.ink, display: "flex", padding: 0 }}><ChevronLeft size={20} /></button>
              )}
              <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: C.ink }}>{mPath.length ? mPath[mPath.length - 1] : "เลือกหมวดหมู่สินค้า"}</div>
              <button onClick={() => setCatOpen(false)} aria-label="ปิด" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.muted, display: "flex", padding: 0 }}><X size={20} /></button>
            </div>
            <div style={{ padding: "12px 18px 0" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, display: "flex" }}><Search size={15} /></div>
                <input value={catQ} onChange={e => setCatQ(e.target.value)} placeholder="ค้นหาหมวดหมู่..."
                  style={{ ...input, padding: "0 12px 0 36px", background: C.bg, border: "none" }} />
              </div>
            </div>
            {mPath.length > 0 && (
              <div style={{ padding: "10px 18px", fontSize: 12, color: C.muted, background: "#FAFAF8", marginTop: 12 }}>{mPath.join(" › ")}</div>
            )}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {levelOptions.map(name => (
                <div key={name} onClick={() => (hasKids(name) ? (setMPath(p => [...p, name]), setCatQ("")) : chooseLeaf(name))}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: `1px solid ${C.line}`, fontSize: 14, color: C.ink, cursor: "pointer" }}>
                  <span>{name}</span>
                  {hasKids(name) ? <ChevronRight size={17} color={C.muted} /> : <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${C.line}` }} />}
                </div>
              ))}
              {levelOptions.length === 0 && <div style={{ padding: 24, fontSize: 12.5, color: C.muted, textAlign: "center" }}>ไม่พบหมวดหมู่</div>}
            </div>
            <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${C.line}`, display: "grid", gap: 10 }}>
              {mPath.length > 0 && (reqOpen ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input autoFocus value={reqName} onChange={e => setReqName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && requestNewCat()}
                    placeholder={`ชื่อหมวดย่อยใหม่ใต้ "${mPath[mPath.length - 1]}"...`} style={{ ...input, flex: 1 }} />
                  <button onClick={requestNewCat} disabled={!reqName.trim()}
                    style={{ height: 42, padding: "0 18px", border: "none", borderRadius: 12, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", flex: "none", opacity: reqName.trim() ? 1 : .5 }}>ขอเพิ่ม</button>
                </div>
              ) : (
                <button onClick={() => setReqOpen(true)}
                  style={{ height: 44, border: `1.5px dashed ${C.brand}`, borderRadius: 12, background: "#fff", color: C.brand, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  <Plus size={13} style={{ verticalAlign: -2 }} /> ขอเพิ่มหมวดหมู่ในนี้ · รอตรวจสอบ
                </button>
              ))}
              {mPath.length > 0 && (
                <button onClick={chooseHere}
                  style={{ height: 46, border: `1px solid ${C.brand}`, borderRadius: 12, background: C.brandTint, color: C.brand, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  เลือกเป็น “{mPath.join(" › ")}”
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

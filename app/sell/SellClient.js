"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CAT_MAINS, catNodeAt, catChildren, COND_GRADES, ISSUE_PRESETS, ALL_BRANDS } from "@/lib/catalog";
import { feeFor, feeTierRange, netPayout } from "@/lib/fees";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

export default function SellClient({ userId, tiers }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({ name: "", description: "", price: "", brand: "", isNew: true, grade: "", issues: [], condNote: "", location: "", shipMode: "free", shipFee: "", stock: 1 });
  const [catPath, setCatPath] = useState([]);       // เส้นทางหมวด เช่น ["คันเบ็ด","คันสปินนิ่ง","ไลท์เกม"]
  const [files, setFiles] = useState([]);            // File[] สูงสุด 5
  const [previews, setPreviews] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const price = Number(f.price) || 0;
  const fee = useMemo(() => feeFor(price, tiers, "seller"), [price, tiers]);
  const net = useMemo(() => netPayout(price, tiers), [price, tiers]);
  const range = useMemo(() => feeTierRange(price, tiers), [price, tiers]);

  // หมวดหมู่แบบไล่ชั้น: โชว์ dropdown ทีละชั้นตามต้นไม้จริง
  const catLevels = useMemo(() => {
    const levels = [{ options: CAT_MAINS, value: catPath[0] || "" }];
    for (let i = 0; i < catPath.length; i++) {
      const node = catNodeAt(catPath.slice(0, i + 1));
      const kids = catChildren(node);
      if (kids.length) levels.push({ options: kids.map(k => k.name), value: catPath[i + 1] || "" });
    }
    return levels;
  }, [catPath]);
  const pickCat = (level, val) => setCatPath(p => val ? [...p.slice(0, level), val] : p.slice(0, level));

  // W5.6: เลือกเพิ่มต่อท้ายได้หลายรอบ สูงสุด 10 รูป + ลบรายรูป (รูปแรก = รูปปกในตลาด)
  const pickFiles = e => {
    const add = Array.from(e.target.files || []);
    const list = [...files, ...add].slice(0, 10);
    setFiles(list);
    setPreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return list.map(x => URL.createObjectURL(x)); });
    e.target.value = "";
  };
  const removeFile = i => {
    const list = files.filter((_, x) => x !== i);
    setFiles(list);
    setPreviews(p => { p.forEach(u => URL.revokeObjectURL(u)); return list.map(x => URL.createObjectURL(x)); });
  };

  // W5.6: แบรนด์นอกรายชื่อ = แบรนด์ใหม่ → สินค้าเข้าสถานะ "รอตรวจ" จนแอดมินอนุมัติ (ซ่อนจากตลาดระหว่างนั้น)
  const isNewBrand = !!f.brand.trim() && !ALL_BRANDS.some(b => b.toLowerCase() === f.brand.trim().toLowerCase());
  const [brandOpen, setBrandOpen] = useState(false); // แผงเลือกแบรนด์ (W5.6 — แบบ prototype BrandPicker)

  const submit = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("กรอกชื่อสินค้า");
    if (!price || price <= 0) return setErr("กรอกราคาให้ถูกต้อง");
    if (!catPath.length) return setErr("เลือกหมวดหมู่สินค้า");
    if (!f.isNew && !f.grade) return setErr("สินค้ามือสองต้องเลือกเกรดสภาพ");
    if (!files.length) return setErr("ใส่รูปสินค้าอย่างน้อย 1 รูป");
    if (f.shipMode === "paid" && !(Number(f.shipFee) >= 0)) return setErr("กรอกค่าส่ง");
    setBusy(true);
    try {
      // 1) อัปโหลดรูปเข้า bucket products ใต้โฟลเดอร์ {uid}/
      const urls = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, file, { cacheControl: "3600" });
        if (error) throw error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      // 2) บันทึกสินค้า
      const cond = f.isNew ? "ของใหม่" : `มือสอง · ${f.grade}`;
      const { error } = await supabase.from("products").insert({
        seller_id: userId,
        name: f.name.trim(),
        description: f.description.trim(),
        price,
        cat_main: catPath[0],
        cat_sub: catPath.slice(1).join(" › ") || null,
        brand: f.brand.trim() || null,
        cond, cond_label: f.isNew ? null : f.grade,
        cond_note: f.condNote.trim() || null,
        issues: f.isNew ? [] : f.issues,
        location: f.location.trim() || null,
        stock: Number(f.stock) || 1,
        shipping: f.shipMode === "free" ? { mode: "free", label: "ส่งฟรี" } : { mode: "paid", fee: Number(f.shipFee) || 0, label: `ค่าส่ง ${baht(f.shipFee)}` },
        images: urls,
        status: isNewBrand ? "review" : "active", // แบรนด์ใหม่ → รอแอดมินตรวจก่อนขึ้นตลาด
      });
      if (error) throw error;
      router.push(isNewBrand ? "/my-products" : "/market");
      router.refresh();
    } catch (e) {
      setErr("บันทึกไม่สำเร็จ: " + (e.message || e));
      setBusy(false);
    }
  };

  const input = { width: "100%", height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box", outline: "none", background: "#fff", color: C.ink };
  const label = { fontSize: 12, fontWeight: 800, color: C.muted, margin: "10px 0 6px" };
  const chip = on => ({ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brandTint : "#fff", color: on ? C.brand : C.muted });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Link href="/" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ กลับหน้าแรก</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>🎣 ลงขายสินค้า</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
          <div style={label}>รูปสินค้า ({files.length}/10) * <span style={{ fontWeight: 500 }}>— รูปแรกคือรูปปกในตลาด</span></div>
          <input type="file" accept="image/*" multiple onChange={pickFiles} disabled={files.length >= 10} style={{ fontSize: 12.5 }} />
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {previews.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={src} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: `1px solid ${i === 0 ? C.brand : C.line}`, display: "block" }} />
                  {i === 0 && <span style={{ position: "absolute", left: 4, bottom: 4, background: C.brand, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999 }}>ปก</span>}
                  <button type="button" onClick={() => removeFile(i)} aria-label="ลบรูปนี้"
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={label}>ชื่อสินค้า *</div>
          <input style={input} value={f.name} onChange={e => set("name", e.target.value)} placeholder="เช่น Shimano Stradic C3000HG" />

          <div style={label}>รายละเอียด</div>
          <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="สเปก อายุการใช้งาน อุปกรณ์ที่มีให้..."
            style={{ ...input, height: "auto", padding: 12, resize: "vertical", fontFamily: "inherit" }} />

          <div style={label}>หมวดหมู่ *</div>
          <div style={{ display: "grid", gap: 8 }}>
            {catLevels.map((lv, i) => (
              <select key={i} value={lv.value} onChange={e => pickCat(i, e.target.value)} style={{ ...input, height: 42 }}>
                <option value="">{i === 0 ? "— เลือกหมวดหลัก —" : "— เลือกหมวดย่อย (ถ้ามี) —"}</option>
                {lv.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>

          <div style={label}>แบรนด์</div>
          <div style={{ position: "relative" }}>
            <input style={input} value={f.brand}
              onChange={e => { set("brand", e.target.value); setBrandOpen(true); }}
              onFocus={() => setBrandOpen(true)}
              placeholder="พิมพ์ค้นหาแบรนด์ เช่น Shimano" />
            {brandOpen && (
              <>
                <div onClick={() => setBrandOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 21, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 240, overflowY: "auto" }}>
                  <div onClick={() => { set("brand", ""); setBrandOpen(false); }}
                    style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, color: C.brand, cursor: "pointer", borderBottom: `1px solid ${C.line}` }}>ทุกแบรนด์ (ไม่ระบุ)</div>
                  {ALL_BRANDS.filter(b => !f.brand.trim() || b.toLowerCase().includes(f.brand.trim().toLowerCase())).map(b => (
                    <div key={b} onClick={() => { set("brand", b); setBrandOpen(false); }}
                      style={{ padding: "9px 14px", fontSize: 12.5, color: C.ink, cursor: "pointer" }}>{b}</div>
                  ))}
                  {ALL_BRANDS.filter(b => !f.brand.trim() || b.toLowerCase().includes(f.brand.trim().toLowerCase())).length === 0 && (
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
            <div style={{ marginTop: 6, fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", lineHeight: 1.6 }}>
              ＋ แบรนด์ใหม่ "{f.brand.trim()}" — ลงขายได้เลย แต่สินค้าจะอยู่สถานะ <b>รอตรวจ</b> (ยังไม่ขึ้นตลาด) จนกว่าทีมงานอนุมัติแบรนด์
            </div>
          )}

          <div style={label}>สภาพสินค้า *</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={chip(f.isNew)} onClick={() => set("isNew", true)}>ของใหม่</div>
            <div style={chip(!f.isNew)} onClick={() => set("isNew", false)}>มือสอง</div>
          </div>
          {!f.isNew && (
            <>
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {COND_GRADES.map(g => (
                  <div key={g.key} onClick={() => set("grade", g.key)}
                    style={{ border: `1.5px solid ${f.grade === g.key ? C.brand : C.line}`, background: f.grade === g.key ? C.brandTint : "#fff", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: f.grade === g.key ? C.brand : C.ink }}>{g.key}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{g.desc}</div>
                  </div>
                ))}
              </div>
              <div style={label}>ตำหนิ (เลือกได้หลายข้อ)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ISSUE_PRESETS.map(x => {
                  const on = f.issues.includes(x);
                  return <div key={x} style={chip(on)} onClick={() => set("issues", on ? f.issues.filter(i => i !== x) : [...f.issues, x])}>{x}</div>;
                })}
              </div>
              <div style={label}>หมายเหตุสภาพ</div>
              <input style={input} value={f.condNote} onChange={e => set("condNote", e.target.value)} placeholder="เช่น มีรอยที่ฝาข้าง ใช้งานปกติ" />
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={label}>จังหวัดที่ส่งของ</div>
              <input style={input} value={f.location} onChange={e => set("location", e.target.value)} placeholder="เช่น กรุงเทพฯ" />
            </div>
            <div>
              <div style={label}>จำนวนสต็อก</div>
              <input style={input} type="number" min={1} value={f.stock} onChange={e => set("stock", e.target.value)} />
            </div>
          </div>

          <div style={label}>การจัดส่ง *</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={chip(f.shipMode === "free")} onClick={() => set("shipMode", "free")}>ส่งฟรี</div>
            <div style={chip(f.shipMode === "paid")} onClick={() => set("shipMode", "paid")}>ผู้ซื้อจ่ายค่าส่ง</div>
            {f.shipMode === "paid" && (
              <input style={{ ...input, width: 120 }} type="number" min={0} value={f.shipFee} onChange={e => set("shipFee", e.target.value)} placeholder="ค่าส่ง ฿" />
            )}
          </div>

          <div style={label}>ราคาขาย (บาท) *</div>
          <input style={input} type="number" min={0} value={f.price} onChange={e => set("price", e.target.value)} placeholder="0" />

          {price > 0 && (
            <div style={{ marginTop: 10, background: C.brandTint, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.muted }}>ค่าธรรมเนียมผู้ขาย</span><b style={{ color: C.ink }}>−{baht(fee)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginTop: 4 }}>
                <span style={{ fontWeight: 800, color: C.ink }}>คุณจะได้รับ</span>
                <b style={{ color: C.ok, fontSize: 17 }}>{baht(net)}</b>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>ⓘ ช่วงราคา {range.label} — โอนให้หลังผู้ซื้อยืนยันรับสินค้า</div>
            </div>
          )}

          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

          <button onClick={submit} disabled={busy}
            style={{ marginTop: 14, width: "100%", height: 48, border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
            {busy ? "กำลังอัปโหลด..." : "ลงขายสินค้า"}
          </button>
        </div>
      </div>
    </div>
  );
}

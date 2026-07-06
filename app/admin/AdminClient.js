"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReturnSteps from "@/components/ReturnSteps";
import { BarChart3, Package, ShoppingBag, Wallet, Percent, Settings, LayoutGrid, ChevronRight, CheckCircle, RotateCcw, AlertTriangle, Truck, Users, ShieldCheck, ReceiptText, Search } from "lucide-react";
import { feeFor, netPayout } from "@/lib/fees";

/* ค่าธรรมเนียม — ตารางเรทตามช่วงราคา ค้นหา/แบ่งหน้า 50 แถว/ปรับทั้งตาราง ±2% (prototype AdminFees 5437–5565) */
function FeesSettings({ tiers: saved0, onError }) {
  const router = useRouter();
  const PAGE = 50;
  const saved = useMemo(() => [...(saved0 || [])].sort((a, b) => a.min - b.min), [saved0]);
  const [tiers, setTiers] = useState(saved);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(null);
  const [adj, setAdj] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(tiers) !== JSON.stringify(saved);
  const sorted = useMemo(() => [...tiers].sort((a, b) => a.min - b.min), [tiers]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const shown = sorted.slice(page * PAGE, (page + 1) * PAGE);
  const upd = (id, patch) => setTiers(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
  const setMaxOf = (t, next, val) => { if (!next) return; const v = Math.max(Number(t.min), Number(val) || 0); upd(next.id, { min: v + 1 }); };

  // ค้นหา: พิมพ์ราคา → กระโดดไปหน้า/ไฮไลต์ช่วงนั้น
  const search = val => {
    setQ(val);
    const price = Number(String(val).replace(/[^0-9]/g, ""));
    if (!val.trim()) { setHl(null); return; }
    const idx = sorted.reduce((acc, x, j) => (price >= Number(x.min) ? j : acc), 0);
    setPage(Math.floor(idx / PAGE));
    setHl(sorted[idx]?.id ?? null);
  };

  // ปรับทุกช่วงพร้อมกันทีละ 2% (แตะเฉพาะค่าที่ไม่ใช่ null — prototype 5463–5475)
  const bump = dir => {
    const f = 1 + dir * 0.02;
    const money = v => v != null ? Math.max(0, Math.round(Number(v) * f)) : v;
    const pct = v => v != null ? Math.max(0, Math.round(Number(v) * f * 10) / 10) : v;
    setTiers(ts => ts.map(t => ({
      ...t,
      seller: money(t.seller), buyer: money(t.buyer),
      seller_base: money(t.seller_base), buyer_base: money(t.buyer_base),
      seller_excess_pct: pct(t.seller_excess_pct), buyer_excess_pct: pct(t.buyer_excess_pct),
      seller_pct: pct(t.seller_pct), buyer_pct: pct(t.buyer_pct),
    })));
    setAdj(a => Math.round((a + dir * 2) * 10) / 10);
  };

  const save = async () => {
    onError(""); setMsg("");
    const mins = sorted.map(t => Number(t.min));
    if (new Set(mins).size !== mins.length) { onError("ช่วงราคาเริ่มต้นซ้ำกัน — กรุณาแก้ก่อนบันทึก"); return; }
    if (mins[0] !== 0) { onError("ช่วงแรกต้องเริ่มที่ 0 เพื่อครอบคลุมทุกราคา"); return; }
    // ส่งเฉพาะแถวที่เปลี่ยน
    const before = Object.fromEntries(saved.map(t => [String(t.id), JSON.stringify(t)]));
    const changed = sorted.filter(t => before[String(t.id)] !== JSON.stringify(t));
    if (!changed.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fee-tiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: changed }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setAdj(0);
      setMsg(`✓ บันทึกแล้ว ${data.saved} ช่วง — มีผลกับหน้าลงขาย/ชำระเงินทันที`);
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  const numIn = { height: 32, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "0 9px", fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", textAlign: "right", outline: "none", color: C.ink };
  const pctOf = (t, next) => {
    if (t.seller_base != null) return "ฐาน+%";
    const mid = next ? (Number(t.min) + Number(next.min) - 1) / 2 : Number(t.min) * 1.2;
    const s = Number(t.seller) || 0;
    return mid > 0 && s > 0 ? `≈${(s / mid * 100).toFixed(1)}%` : "—";
  };
  const demo = p => `หัก ฿${feeFor(p, sorted, "seller").toLocaleString()} · ได้รับ ฿${netPayout(p, sorted).toLocaleString()}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>ค่าธรรมเนียม</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>เรทตามช่วงราคา {sorted.length} ช่วง — ผู้ขายเห็นยอดสุทธิตั้งแต่หน้าลงขาย · แก้บนร่างแล้วกด "บันทึก"</div>
      </div>

      {/* เครื่องมือ: ค้นหา + ปรับทั้งตาราง */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: 11, color: C.muted }} />
          <input value={q} onChange={e => search(e.target.value)} placeholder="ค้นหาจากราคา เช่น 17500 — กระโดดไปช่วงนั้น"
            style={{ height: 36, width: "100%", border: `1px solid ${C.line}`, borderRadius: 9, padding: "0 12px 0 32px", fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", outline: "none", color: C.ink }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "5px 10px" }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>ปรับทุกช่วงพร้อมกัน</span>
          <button onClick={() => bump(-1)} style={{ width: 30, height: 26, border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 800, color: C.ink }}>−</button>
          <span style={{ fontSize: 12.5, fontWeight: 800, minWidth: 52, textAlign: "center", color: adj === 0 ? C.muted : adj > 0 ? "#C2410C" : "#15803D" }}>{adj > 0 ? `+${adj}` : adj}%</span>
          <button onClick={() => bump(1)} style={{ width: 30, height: 26, border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 800, color: C.ink }}>+</button>
          <span style={{ fontSize: 10.5, color: C.muted }}>ทีละ 2%</span>
        </div>
      </div>

      {/* ตาราง */}
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.2fr 1fr 64px", gap: 8, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C.line}`, fontSize: 11, fontWeight: 700, color: C.muted }}>
          <span>ช่วงราคา (฿)</span><span style={{ textAlign: "right" }}>หักผู้ขาย (฿)</span><span style={{ textAlign: "right" }}>หักผู้ซื้อ (฿)</span><span style={{ textAlign: "right" }}>≈ %</span>
        </div>
        {shown.map(t => {
          const gi = sorted.indexOf(t);
          const next = sorted[gi + 1];
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.7fr 1.2fr 1fr 64px", gap: 8, alignItems: "center", padding: "5px 14px", borderBottom: `1px solid ${C.line}`, background: hl === t.id ? C.brandTint : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" value={t.min} onChange={e => upd(t.id, { min: Math.max(0, Number(e.target.value) || 0) })} style={{ ...numIn, width: 84 }} />
                <span style={{ fontSize: 12, color: C.muted, flex: "none" }}>–</span>
                {next
                  ? <input type="number" value={Number(next.min) - 1} onChange={e => setMaxOf(t, next, e.target.value)} style={{ ...numIn, width: 84 }} />
                  : <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>ขึ้นไป</span>}
              </div>
              {t.seller_base != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <input type="number" value={t.seller_base} onChange={e => upd(t.id, { seller_base: Math.max(0, Number(e.target.value) || 0) })} style={{ ...numIn, width: 70 }} />
                  <span style={{ fontSize: 10.5, color: C.muted, flex: "none" }}>+</span>
                  <input type="number" step="0.1" value={t.seller_excess_pct ?? 0} onChange={e => upd(t.id, { seller_excess_pct: Math.max(0, Number(e.target.value) || 0) })} style={{ ...numIn, width: 50 }} />
                  <span style={{ fontSize: 10.5, color: C.muted, flex: "none" }}>%เกิน</span>
                </div>
              ) : (
                <input type="number" value={t.seller ?? 0} onChange={e => upd(t.id, { seller: Math.max(0, Number(e.target.value) || 0) })} style={numIn} />
              )}
              {t.buyer_base != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <input type="number" value={t.buyer_base} onChange={e => upd(t.id, { buyer_base: Math.max(0, Number(e.target.value) || 0) })} style={{ ...numIn, width: 70 }} />
                  <span style={{ fontSize: 10.5, color: C.muted, flex: "none" }}>+</span>
                  <input type="number" step="0.1" value={t.buyer_excess_pct ?? 0} onChange={e => upd(t.id, { buyer_excess_pct: Math.max(0, Number(e.target.value) || 0) })} style={{ ...numIn, width: 50 }} />
                  <span style={{ fontSize: 10.5, color: C.muted, flex: "none" }}>%เกิน</span>
                </div>
              ) : (
                <input type="number" value={t.buyer ?? 0} onChange={e => upd(t.id, { buyer: Math.max(0, Number(e.target.value) || 0) })} style={numIn} />
              )}
              <span style={{ fontSize: 11.5, color: C.muted, textAlign: "right" }}>{pctOf(t, next)}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px" }}>
          <button onClick={() => setPage(p2 => Math.max(0, p2 - 1))} disabled={page === 0} style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: page === 0 ? .4 : 1 }}>← ก่อนหน้า</button>
          <span style={{ fontSize: 11.5, color: C.muted, flex: 1, textAlign: "center" }}>หน้า {page + 1} / {pages} · ช่วง {Number(sorted[page * PAGE]?.min || 0).toLocaleString()} – {Number(sorted[Math.min(sorted.length, (page + 1) * PAGE) - 1]?.min || 0).toLocaleString()}+</span>
          <button onClick={() => setPage(p2 => Math.min(pages - 1, p2 + 1))} disabled={page >= pages - 1} style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: page >= pages - 1 ? .4 : 1 }}>ถัดไป →</button>
        </div>
      </div>

      {/* ตัวอย่างสดจากร่าง — คำนวณผ่าน feeFor/netPayout เท่านั้น (กติกาเหล็กข้อ 1) */}
      <div style={{ fontSize: 11.5, color: C.muted, margin: "0 2px" }}>
        ตัวอย่างสด: ฿17,500 → {demo(17500)} · ฿150,000 → {demo(150000)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: dirty ? "#FFFBEB" : "#fff", border: `1px solid ${dirty ? "#FDE68A" : C.line}`, borderRadius: 12, padding: "12px 14px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: dirty ? "#92400E" : C.muted, flex: 1, minWidth: 180 }}>
          {dirty ? `⚠ มีการแก้ไขที่ยังไม่ได้บันทึก${adj !== 0 ? ` (ปรับทั้งตาราง ${adj > 0 ? "+" : ""}${adj}%)` : ""} — ระบบยังใช้เรทเดิม` : (msg || "✓ เรทตรงกับที่ระบบใช้อยู่")}
        </span>
        {dirty ? <button onClick={() => { setTiers(saved); setAdj(0); }} style={{ height: 40, padding: "0 18px", border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิกการแก้ไข</button> : null}
        <button onClick={save} disabled={!dirty || busy} style={{ height: 40, padding: "0 26px", border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: dirty && !busy ? 1 : .45, fontFamily: "inherit" }}>
          {busy ? "กำลังบันทึก..." : "💾 บันทึก"}
        </button>
      </div>
    </div>
  );
}

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E", warn: "#B7791F" };
const baht = n => "฿" + Number(n || 0).toLocaleString();

/* ReasonModal — กล่องกรอกเหตุผลในหน้า (กติกา: ห้าม window.prompt / ปฏิเสธต้องมีเหตุผล) */
function ReasonModal({ title, onCancel, onSubmit }) {
  const [txt, setTxt] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 400 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>{title}</div>
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={3} autoFocus placeholder="เหตุผล (ผู้ใช้จะเห็นข้อความนี้) *"
          style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: 12, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 40, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={() => txt.trim() && onSubmit(txt.trim())} disabled={!txt.trim()}
            style={{ flex: 2, height: 40, borderRadius: 9, border: "none", background: txt.trim() ? C.danger : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: txt.trim() ? "pointer" : "not-allowed" }}>
            ยืนยันปฏิเสธ
          </button>
        </div>
      </div>
    </div>
  );
}

/* PayeeInfo — บัญชีผู้รับเงินจริงจาก profiles + badge KYC + เตือนถ้าไม่มีบัญชี */
function PayeeInfo({ seller }) {
  if (!seller) return null;
  const kycBadge = { verified: ["✓ KYC ผ่าน", C.ok], pending: ["KYC รอตรวจ", C.warn], rejected: ["KYC ไม่ผ่าน", C.danger], none: ["ยังไม่ทำ KYC", C.muted] }[seller.kyc_status || "none"];
  const noAccount = !seller.promptpay && !seller.bank?.no;
  return (
    <div style={{ border: `1.5px solid ${noAccount ? C.danger : C.line}`, borderRadius: 10, padding: "10px 12px", background: noAccount ? "#FBEAE8" : "#FAFDFD" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>ผู้รับเงิน: {seller.name}</div>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: kycBadge[1], background: `${kycBadge[1]}18`, padding: "2px 8px", borderRadius: 999 }}>{kycBadge[0]}</span>
      </div>
      {seller.bank?.no && (
        <div style={{ fontSize: 12.5, color: C.ink, marginTop: 4 }}>
          {seller.bank.bank} <b>{seller.bank.no}</b> ({seller.bank.name})
          <span onClick={() => navigator.clipboard?.writeText(seller.bank.no)} style={{ color: C.brand, fontWeight: 800, cursor: "pointer", marginLeft: 6 }}>⧉</span>
        </div>
      )}
      {seller.promptpay && (
        <div style={{ fontSize: 12.5, color: C.ink, marginTop: 2 }}>
          พร้อมเพย์ <b>{seller.promptpay}</b>
          <span onClick={() => navigator.clipboard?.writeText(seller.promptpay)} style={{ color: C.brand, fontWeight: 800, cursor: "pointer", marginLeft: 6 }}>⧉</span>
        </div>
      )}
      {noAccount && <div style={{ fontSize: 12, color: C.danger, fontWeight: 700, marginTop: 4 }}>⚠ ผู้ขายยังไม่ได้กรอกบัญชีรับเงิน — โอนไม่ได้ กด "โอนไม่สำเร็จ" เพื่อแจ้งให้ไปกรอก</div>}
    </div>
  );
}

/* Toggle สวิตช์ (prototype บรรทัด 5349–5353) */
function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{ width: 40, height: 22, borderRadius: 999, background: on ? C.brand : C.line, position: "relative", cursor: "pointer", flex: "none", transition: "background .15s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </div>
  );
}

/* ตั้งค่าการรับชำระเงิน — แก้บน "ร่าง" แล้วกดบันทึกถึงมีผลกับหน้าลูกค้า (prototype 5337–5431)
   หมายเหตุ: รูป QR พร้อมเพย์ยังไม่ทำ — หน้าจ่ายเงินจริงแสดงหมายเลขพร้อมเพย์อยู่แล้ว */
function PaymentSettings({ config, onError }) {
  const router = useRouter();
  const base = {
    promptpay_enabled: !!config?.promptpay_enabled,
    promptpay_id: config?.promptpay_id || "",
    promptpay_name: config?.promptpay_name || "",
    bank_enabled: !!config?.bank_enabled,
    banks: Array.isArray(config?.banks) ? config.banks : [],
  };
  const [draft, setDraft] = useState(base);
  const [nb, setNb] = useState({ bank: "", accountNo: "", accountName: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const set = patch => setDraft(d => ({ ...d, ...patch }));
  const inputS = { height: 38, border: `1px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", width: "100%", outline: "none", color: C.ink };
  const cardS = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };

  const addBank = () => {
    if (!nb.bank.trim() || !nb.accountNo.trim() || !nb.accountName.trim()) { onError("กรอกข้อมูลบัญชีให้ครบก่อนเพิ่ม"); return; }
    set({ banks: [...draft.banks, { id: Date.now(), bank: nb.bank.trim(), accountNo: nb.accountNo.trim(), accountName: nb.accountName.trim(), primary: draft.banks.length === 0 }] });
    setNb({ bank: "", accountNo: "", accountName: "" });
  };
  const removeBank = id => {
    const rest = draft.banks.filter(b => b.id !== id);
    if (rest.length && !rest.some(b => b.primary)) rest[0] = { ...rest[0], primary: true };
    set({ banks: rest });
  };
  const setPrimary = id => set({ banks: draft.banks.map(b => ({ ...b, primary: b.id === id })) });

  const save = async () => {
    onError(""); setMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/platform-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMsg("✓ บันทึกแล้ว — มีผลกับหน้าชำระเงินของลูกค้าทันที");
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>ตั้งค่าการรับชำระเงิน</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>บัญชีกลางแพลตฟอร์ม (escrow) ที่ลูกค้าโอนเข้า — แก้ไขแล้วกด "บันทึก" จึงจะมีผลกับหน้าลูกค้า</div>
      </div>

      {/* พร้อมเพย์ */}
      <div style={cardS}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>📱 QR PromptPay</span>
          <Toggle on={draft.promptpay_enabled} onClick={() => set({ promptpay_enabled: !draft.promptpay_enabled })} />
        </div>
        {draft.promptpay_enabled ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginBottom: 5 }}>หมายเลขพร้อมเพย์</div>
              <input value={draft.promptpay_id} onChange={e => set({ promptpay_id: e.target.value })} placeholder="เบอร์/เลขผู้เสียภาษี" style={inputS} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginBottom: 5 }}>ชื่อบัญชี</div>
              <input value={draft.promptpay_name} onChange={e => set({ promptpay_name: e.target.value })} placeholder="ชื่อที่ลูกค้าจะเห็น" style={inputS} />
            </div>
          </div>
        ) : <div style={{ fontSize: 12, color: C.muted }}>ปิดอยู่ — ลูกค้าจะไม่เห็นตัวเลือก "QR PromptPay"</div>}
      </div>

      {/* ธนาคาร */}
      <div style={cardS}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>🏦 โอนเงินผ่านบัญชีธนาคาร</span>
          <Toggle on={draft.bank_enabled} onClick={() => set({ bank_enabled: !draft.bank_enabled })} />
        </div>
        {draft.bank_enabled ? (<>
          {draft.banks.length === 0
            ? <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>⚠ ยังไม่มีบัญชี — ลูกค้าจะไม่เห็นตัวเลือกโอนธนาคาร</div>
            : draft.banks.map(b => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                    {b.bank} · {b.accountNo} {b.primary ? <span style={{ fontSize: 10, fontWeight: 800, color: C.brand, background: C.brandTint, padding: "2px 8px", borderRadius: 999, marginLeft: 4 }}>บัญชีหลัก</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{b.accountName}</div>
                </div>
                {!b.primary ? <button onClick={() => setPrimary(b.id)} style={{ fontSize: 11.5, border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", color: C.ink }}>ตั้งเป็นหลัก</button> : null}
                <button onClick={() => removeBank(b.id)} style={{ width: 28, height: 28, border: "1px solid #F1D6D3", background: "#FBEAE8", borderRadius: 8, cursor: "pointer", color: C.danger, fontWeight: 800 }}>✕</button>
              </div>
            ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr auto", gap: 8, marginTop: 12 }}>
            <input value={nb.bank} onChange={e => setNb(v => ({ ...v, bank: e.target.value }))} placeholder="ธนาคาร" style={inputS} />
            <input value={nb.accountNo} onChange={e => setNb(v => ({ ...v, accountNo: e.target.value }))} placeholder="เลขบัญชี" style={inputS} />
            <input value={nb.accountName} onChange={e => setNb(v => ({ ...v, accountName: e.target.value }))} placeholder="ชื่อบัญชี" style={inputS} />
            <button onClick={addBank} style={{ height: 38, padding: "0 16px", border: "none", borderRadius: 9, background: C.brand, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>+ เพิ่ม</button>
          </div>
        </>) : <div style={{ fontSize: 12, color: C.muted }}>ปิดอยู่ — ลูกค้าจะไม่เห็นตัวเลือก "โอนเงินผ่านบัญชีธนาคาร"</div>}
      </div>

      {/* แถบบันทึก (prototype 5423–5428) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: dirty ? "#FFFBEB" : "#fff", border: `1px solid ${dirty ? "#FDE68A" : C.line}`, borderRadius: 12, padding: "12px 14px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: dirty ? "#92400E" : C.muted, flex: 1, minWidth: 180 }}>
          {dirty ? "⚠ มีการแก้ไขที่ยังไม่ได้บันทึก — ลูกค้ายังเห็นค่าเดิม" : (msg || "✓ ข้อมูลตรงกับที่ลูกค้าเห็นอยู่")}
        </span>
        {dirty ? <button onClick={() => { setDraft(base); setNb({ bank: "", accountNo: "", accountName: "" }); }} style={{ height: 40, padding: "0 18px", border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิกการแก้ไข</button> : null}
        <button onClick={save} disabled={!dirty || busy} style={{ height: 40, padding: "0 26px", border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: dirty && !busy ? 1 : .45, fontFamily: "inherit" }}>
          {busy ? "กำลังบันทึก..." : "💾 บันทึก"}
        </button>
      </div>
    </div>
  );
}

/* ตั้งค่าระบบ — วันครบกำหนด + แบนเนอร์ตัววิ่ง (prototype AdminSettings 5566–5612) */
function SystemSettings({ config, onError }) {
  const router = useRouter();
  const base = {
    auto_confirm_days: Number(config?.auto_confirm_days) || 3,
    return_auto_confirm_days: Number(config?.return_auto_confirm_days) || 10,
    banner_enabled: !!config?.banner_enabled,
    banner_text: config?.banner_text || "",
  };
  const [draft, setDraft] = useState(base);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const set = patch => setDraft(d => ({ ...d, ...patch }));
  const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
  const inputS = { height: 38, width: 110, border: `1px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", textAlign: "right", outline: "none", color: C.ink };
  const Row = ({ label, hint, children }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "13px 14px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div> : null}
      </div>
      {children}
    </div>
  );

  const save = async () => {
    onError(""); setMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/platform-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMsg("✓ บันทึกแล้ว — มีผลทั่วระบบทันที");
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>ตั้งค่าระบบ</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>ค่าเหล่านี้มีผลกับการคำนวณและข้อความจริงทั่วระบบ — แก้แล้วกด "บันทึก"</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
        <div style={{ padding: "13px 14px", fontSize: 11.5, color: C.muted }}>💡 เรทค่าธรรมเนียมอยู่เมนู "ค่าธรรมเนียม"</div>
        <Row label="ยืนยันรับสินค้าอัตโนมัติ (วัน)" hint="ผู้ซื้อไม่กดยืนยัน → ระบบปล่อยเงินให้ผู้ขายเมื่อครบกำหนด">
          <input type="number" value={draft.auto_confirm_days} onChange={e => set({ auto_confirm_days: num(e.target.value, 1, 30) })} style={inputS} />
        </Row>
        <Row label="ยืนยันรับของคืนอัตโนมัติ (วัน)" hint="ผู้ขายไม่ยืนยันรับของคืนจากผู้ซื้อ → ระบบยืนยันแทนและเข้าคิวคืนเงิน">
          <input type="number" value={draft.return_auto_confirm_days} onChange={e => set({ return_auto_confirm_days: num(e.target.value, 1, 30) })} style={inputS} />
        </Row>
        <Row label="แบนเนอร์ประกาศ (ตัววิ่ง)" hint="แสดงบนหัวเว็บ/แอปทุกหน้า">
          <Toggle on={draft.banner_enabled} onClick={() => set({ banner_enabled: !draft.banner_enabled })} />
        </Row>
        {draft.banner_enabled ? (
          <div style={{ padding: "0 14px 13px" }}>
            <input value={draft.banner_text} onChange={e => set({ banner_text: e.target.value })} placeholder="ข้อความประกาศ"
              style={{ ...inputS, width: "100%", textAlign: "left" }} />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: dirty ? "#FFFBEB" : "#fff", border: `1px solid ${dirty ? "#FDE68A" : C.line}`, borderRadius: 12, padding: "12px 14px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: dirty ? "#92400E" : C.muted, flex: 1, minWidth: 180 }}>{dirty ? "⚠ มีการแก้ไขที่ยังไม่ได้บันทึก" : (msg || "✓ ค่าตรงกับที่ระบบใช้อยู่")}</span>
        {dirty ? <button onClick={() => setDraft(base)} style={{ height: 40, padding: "0 18px", border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิกการแก้ไข</button> : null}
        <button onClick={save} disabled={!dirty || busy} style={{ height: 40, padding: "0 26px", border: "none", borderRadius: 10, background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: dirty && !busy ? 1 : .45, fontFamily: "inherit" }}>
          {busy ? "กำลังบันทึก..." : "💾 บันทึก"}
        </button>
      </div>
    </div>
  );
}

export default function AdminClient({ orders, sellers, buyers, userId, kycQueue = [], products = [], stats = {}, config = null, tiers = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("overview");
  const [slipUrls, setSlipUrls] = useState({});
  const [reject, setReject] = useState(null);       // orderId ที่กำลังปฏิเสธ
  const [fail, setFail] = useState(null);           // orderId ที่โอนไม่สำเร็จ
  const [rejectReturn, setRejectReturn] = useState(null); // orderId เคสคืนที่กำลังปฏิเสธ
  const [payoutFile, setPayoutFile] = useState({}); // { [orderId]: File }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const verifyQ = useMemo(() => orders.filter(o => o.status === "pending_verification"), [orders]);
  // A3: จัดกลุ่มคิวสลิปตาม pay_group (โอนก้อนเดียวหลายรายการ — ตรวจครั้งเดียว) ตาม prototype บรรทัด 4905–4949
  const verifyGroups = useMemo(() => {
    const m = {};
    for (const o of verifyQ) if (o.pay_group) (m[o.pay_group] = m[o.pay_group] || []).push(o);
    return Object.values(m).filter(g => g.length > 1);
  }, [verifyQ]);
  const verifySingles = useMemo(() => {
    const grouped = new Set(verifyGroups.flat().map(o => o.id));
    return verifyQ.filter(o => !grouped.has(o.id));
  }, [verifyQ, verifyGroups]);
  const [rejectGroup, setRejectGroup] = useState(null);   // pay_group ที่กำลังปฏิเสธทั้งกลุ่ม
  const returnQ = useMemo(() => orders.filter(o => ["return_requested", "disputed", "return_shipped"].includes(o.status)), [orders]);
  const refundQ = useMemo(() => orders.filter(o => o.status === "return_received"), [orders]);
  const [kycUrls, setKycUrls] = useState({});
  const [rejectKyc, setRejectKyc] = useState(null);
  const [suspendP, setSuspendP] = useState(null);
  const [pq, setPq] = useState("");
  const payoutQ = useMemo(() => orders.filter(o => o.status === "delivered"), [orders]);
  const sellerOf = id => sellers.find(s => s.id === id);
  const buyerOf = id => buyers.find(b => b.id === id);

  // ดึง signed URL ของสลิป (bucket ลับ — แอดมินมีสิทธิ์อ่านตาม RLS)
  useEffect(() => {
    (async () => {
      const urls = {};
      for (const o of orders) if (o.slip_path && !slipUrls[o.id]) {
        const { data } = await supabase.storage.from("slips").createSignedUrl(o.slip_path, 3600);
        if (data?.signedUrl) urls[o.id] = data.signedUrl;
      }
      if (Object.keys(urls).length) setSlipUrls(p => ({ ...p, ...urls }));
      const kurls = {};
      for (const u of kycQueue) {
        if (u.id_card_path && !kycUrls[u.id + "-id"]) {
          const { data } = await supabase.storage.from("kyc").createSignedUrl(u.id_card_path, 3600);
          if (data?.signedUrl) kurls[u.id + "-id"] = data.signedUrl;
        }
        if (u.bank_book_path && !kycUrls[u.id + "-bank"]) {
          const { data } = await supabase.storage.from("kyc").createSignedUrl(u.bank_book_path, 3600);
          if (data?.signedUrl) kurls[u.id + "-bank"] = data.signedUrl;
        }
      }
      if (Object.keys(kurls).length) setKycUrls(p => ({ ...p, ...kurls }));
    })();
  }, [orders, kycQueue]);   // eslint-disable-line

  const call = async (url, body) => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สำเร็จ");
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const doPayout = async o => {
    const file = payoutFile[o.id];
    if (!file) { setErr(`ออเดอร์ ${o.order_no}: แนบสลิปโอนเงินก่อน (บังคับทุกครั้ง)`); return; }
    setErr(""); setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/payout-${o.order_no}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("slips").upload(path, file);
      if (upErr) throw upErr;
      const res = await fetch("/api/admin/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id, slipPath: path }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สำเร็จ");
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const doRefund = async o => {
    const file = payoutFile[o.id];
    if (!file) { setErr(`เคส ${o.order_no}: แนบสลิปคืนเงินก่อน (บังคับทุกครั้ง)`); return; }
    setErr(""); setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/refund-${o.order_no}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("slips").upload(path, file);
      if (upErr) throw upErr;
      const res = await fetch("/api/admin/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id, slipPath: path }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สำเร็จ");
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const card = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const matchTxt = o => {
    const expect = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
    const got = Number(o.transfer_amount || 0);
    if (!got) return ["— ไม่ระบุยอดโอน", C.muted];
    if (got === expect) return [`✓ ยอดตรง ${baht(got)}`, C.ok];
    return [`⚠ ยอดไม่ตรง (โอน ${baht(got)} / ต้อง ${baht(expect)})`, C.danger];
  };

  // A5: คิวย่อยสำหรับกล่องงานเข้าวันนี้ (prototype ADMIN_QUEUES บรรทัด 2370–2377)
  const qReturnReq = useMemo(() => orders.filter(o => o.status === "return_requested"), [orders]);
  const qDisputed = useMemo(() => orders.filter(o => o.status === "disputed"), [orders]);
  const qReturnFlow = useMemo(() => orders.filter(o => o.status === "return_shipped"), [orders]);
  const totalTasks = verifyQ.length + returnQ.length + payoutQ.length + refundQ.length + kycQueue.length;

  // เมนู sidebar (prototype AdminSidebar บรรทัด 4269–4327 — ตัดเมนูที่ยังไม่มีระบบ)
  const MENU = [
    { k: "overview", icon: BarChart3, label: "ภาพรวม" },
    { k: "verify", icon: ReceiptText, label: "ตรวจสลิป", n: verifyQ.length },
    { k: "returns", icon: RotateCcw, label: "คืนของ/พิพาท", n: returnQ.length },
    { k: "payout", icon: Wallet, label: "โอนเงิน/คืนเงิน", n: payoutQ.length + refundQ.length },
    { k: "kyc", icon: Users, label: "ยืนยันตัวตน (KYC)", n: kycQueue.length },
    { k: "products", icon: Package, label: "จัดการสินค้า" },
    { k: "payment", icon: ShoppingBag, label: "ตั้งค่าการรับชำระเงิน" },
    { k: "fees", icon: Percent, label: "ค่าธรรมเนียม" },
    { k: "settings", icon: Settings, label: "ตั้งค่าระบบ" },
  ];

  // การ์ดคิวหน้าภาพรวม: [label, รายการ, แท็บปลายทาง, SLA, สี bg, สี fg, ไอคอน]
  const QCARDS = [
    ["รอตรวจสลิป", verifyQ, "verify", "SLA 4 ชม.", "#FBEEDD", "#B45309", CheckCircle],
    ["รออนุมัติการคืน", qReturnReq, "returns", "SLA 24 ชม.", "#FFF1EA", "#C2410C", RotateCcw],
    ["ข้อพิพาท", qDisputed, "returns", "SLA 24 ชม.", "#FBEAE8", "#B91C1C", AlertTriangle],
    ["ของกำลังตีกลับ", qReturnFlow, "returns", "ติดตาม", "#F1EEFB", "#6D28D9", Truck],
    ["รอโอนเงินผู้ขาย", payoutQ, "payout", "SLA 48 ชม.", "#E5F4EE", "#0E7E5C", Wallet],
    ["รอคืนเงินผู้ซื้อ", refundQ, "payout", "SLA 24 ชม.", "#E5F4EE", "#0E7E5C", Wallet],
    ["ยืนยันตัวตนผู้ขาย (KYC)", kycQueue, "kyc", "SLA 24 ชม.", "#FBEEDD", "#B8790A", Users],
  ];

  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 860);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const SideItem = ({ it }) => {
    const active = tab === it.k;
    return (
      <div onClick={() => setTab(it.k)} style={{
        display: "flex", alignItems: "center", gap: 11, padding: narrow ? "8px 12px" : "10px 12px", borderRadius: 10,
        marginBottom: narrow ? 0 : 3, cursor: "pointer", flex: "none",
        background: active ? "rgba(14,126,140,.25)" : "transparent", color: active ? "#fff" : "#A6AAAE",
      }}>
        <it.icon size={17} strokeWidth={1.8} />
        {!narrow && <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: "nowrap" }}>{it.label}</span>}
        {it.n > 0 ? (
          <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#C24D42", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.n}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: narrow ? "column" : "row" }}>
      {/* ── Sidebar (prototype AdminSidebar) — จอแคบยุบเป็นแถบบนเลื่อนข้าง ── */}
      <div style={narrow
        ? { background: "#101314", color: "#fff", display: "flex", gap: 4, padding: "10px 10px", overflowX: "auto", position: "sticky", top: 0, zIndex: 40 }
        : { width: 232, flex: "none", background: "#101314", color: "#fff", display: "flex", flexDirection: "column", padding: "20px 14px", minHeight: "100vh", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
        {!narrow && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 22px" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.brand, display: "grid", placeItems: "center", fontSize: 15 }}>🎣</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>ClubAngler <span style={{ fontWeight: 500, color: "#8E9296" }}>Admin</span></div>
          </div>
        )}
        {MENU.map(it => <SideItem key={it.k} it={it} />)}
        {!narrow && (
          <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <Link href="/" style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "1px solid rgba(255,255,255,.18)", color: "#D8DADC", fontSize: 12.5, padding: "10px 12px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center", textDecoration: "none" }}>
              <LayoutGrid size={14} /> กลับไปแอปผู้ใช้
            </Link>
          </div>
        )}
      </div>

      {/* ── เนื้อหา ── */}
      <div style={{ flex: 1, minWidth: 0, padding: "20px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>

        {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

        {/* ── ภาพรวม: กล่องงานเข้าวันนี้ (prototype AdminOverview 4343–4431) ── */}
        {tab === "overview" && (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>กล่องงานเข้าวันนี้</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>ระบบสรุปงานค้างจากคำสั่งซื้อทั้งหมด — เรียงตามความเร่งด่วน กดการ์ดเพื่อเปิดคิว</div>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: totalTasks ? "#C24D42" : C.brand }}>{totalTasks ? `รวม ${totalTasks} งานค้าง` : "เคลียร์หมดแล้ว 🎉"}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {QCARDS.map(([label, list, target, sla, bg, fg, Icon]) => {
                const n = list.length;
                const first = list[0];
                return (
                  <div key={label} onClick={() => n && setTab(target)} style={{ ...card, padding: 14, cursor: n ? "pointer" : "default", opacity: n ? 1 : .55, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{label}</div>
                      <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {n ? `เก่าสุด: ${first?.order_no || first?.name || "-"}${first?.item ? ` · ${first.item}` : ""}` : "ไม่มีงานค้าง"} · {sla}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: n ? fg : C.muted, flex: "none" }}>{n}</div>
                    <ChevronRight size={15} color={C.muted} style={{ flex: "none" }} />
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink, margin: "12px 0 0" }}>ภาพรวมระบบ (นับจากข้อมูลจริง)</div>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
              {[
                ["สินค้ากำลังขาย", stats.activeProducts ?? 0],
                ["ขายแล้ว", stats.soldProducts ?? 0],
                ["ออเดอร์ทั้งหมด", stats.ordersTotal ?? 0],
                ["มูลค่าใน escrow", baht(stats.escrowSum ?? 0)],
              ].map(([l, v]) => (
                <div key={l} style={{ ...card, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ตั้งค่าการรับชำระเงิน (A5 ก้าว 2) ── */}
        {tab === "payment" && <PaymentSettings config={config} onError={setErr} />}

        {/* ── ตั้งค่าระบบ (A5 ก้าว 3) ── */}
        {tab === "settings" && <SystemSettings config={config} onError={setErr} />}

        {/* ── ค่าธรรมเนียม (A5 ก้าว 4) ── */}
        {tab === "fees" && <FeesSettings tiers={tiers} onError={setErr} />}

        {/* ── คิวตรวจสลิป ── */}
        {tab === "verify" && (verifyQ.length === 0
          ? <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ไม่มีสลิปรอตรวจ 🎉</div>
          : <>
            {/* กลุ่มโอนก้อนเดียวหลายรายการ — ตรวจครั้งเดียว อนุมัติ/ปฏิเสธทั้งชุด (prototype 4905–4949) */}
            {verifyGroups.map(g => {
              const gt = Number(g[0].group_total || g.reduce((s, x) => s + Number(x.price) + Number(x.buyer_fee || 0) + Number(x.ship_fee || 0), 0));
              const ta = Number(g[0].transfer_amount || 0);
              const [mt, mc] = !ta ? ["— ไม่ระบุยอดโอน", C.muted]
                : ta === gt ? [`✓ ยอดตรงทั้งกลุ่ม ${baht(ta)}`, C.ok]
                : [`⚠ ยอดไม่ตรง (โอน ${baht(ta)} / ต้องชำระทั้งกลุ่ม ${baht(gt)})`, C.danger];
              return (
                <div key={g[0].pay_group} style={{ ...card, border: `1.5px solid ${C.brand}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted }}>{g[0].pay_group}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>🧾 ชำระรวม {g.length} รายการ — สลิปเดียว ตรวจครั้งเดียว</div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>ผู้ซื้อ {buyerOf(g[0].buyer_id)?.name || "-"}</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <b style={{ color: C.brand, fontSize: 16 }}>{baht(gt)}</b>
                      <div style={{ fontSize: 9.5, color: C.muted }}>ยอดที่ต้องชำระทั้งกลุ่ม</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                    {g.map(x => (
                      <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: "#F6F9F9", borderRadius: 8, padding: "8px 11px", fontSize: 12 }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <b style={{ color: C.ink }}>{x.item}</b> <span style={{ color: C.muted }}>· {x.order_no} · ผู้ขาย {sellerOf(x.seller_id)?.name || "-"}</span>
                        </span>
                        <b style={{ color: C.ink, flex: "none" }}>{baht(Number(x.price) + Number(x.buyer_fee || 0) + Number(x.ship_fee || 0))}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: mc, marginBottom: 8 }}>{mt}</div>
                  {slipUrls[g[0].id]
                    ? <a href={slipUrls[g[0].id]} target="_blank" rel="noreferrer">
                        <img src={slipUrls[g[0].id]} alt="สลิป" style={{ width: 140, borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                        <span style={{ fontSize: 11, color: C.brand }}>คลิกเพื่อซูม ↗</span>
                      </a>
                    : <div style={{ fontSize: 12, color: C.muted }}>กำลังโหลดสลิป...</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setRejectGroup(g[0].pay_group)} disabled={busy}
                      style={{ flex: 1, height: 42, borderRadius: 9, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                      ✕ ปฏิเสธทั้งหมด
                    </button>
                    <button onClick={() => call("/api/admin/verify", { payGroup: g[0].pay_group, approve: true })} disabled={busy}
                      style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: C.ok, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                      ✓ อนุมัติทั้งหมด ({g.length} รายการ)
                    </button>
                  </div>
                </div>
              );
            })}
            {verifySingles.map(o => {
            const [mt, mc] = matchTxt(o);
            return (
              <div key={o.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.item}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · ผู้ซื้อ {buyerOf(o.buyer_id)?.name || "-"}</div>
                  </div>
                  <b style={{ color: C.brand }}>{baht(Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0))}</b>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: mc, marginBottom: 8 }}>{mt}</div>
                {slipUrls[o.id]
                  ? <a href={slipUrls[o.id]} target="_blank" rel="noreferrer">
                      <img src={slipUrls[o.id]} alt="สลิป" style={{ width: 140, borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                      <span style={{ fontSize: 11, color: C.brand }}>คลิกเพื่อซูม ↗</span>
                    </a>
                  : <div style={{ fontSize: 12, color: C.muted }}>กำลังโหลดสลิป...</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setReject(o.id)} disabled={busy}
                    style={{ flex: 1, height: 42, borderRadius: 9, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    ✕ ปฏิเสธ
                  </button>
                  <button onClick={() => call("/api/admin/verify", { orderId: o.id, approve: true })} disabled={busy}
                    style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: C.ok, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    ✓ อนุมัติ — เงินเข้าระบบฝาก
                  </button>
                </div>
              </div>
            );
          })}
          </>)}

        {/* ── คิวคืนของ/พิพาท ── */}
        {tab === "returns" && (returnQ.length === 0
          ? <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ไม่มีเคสคืน/พิพาท 🎉</div>
          : returnQ.map(o => (
            <div key={o.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.item}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · ผู้ซื้อ {buyerOf(o.buyer_id)?.name || "-"} · ผู้ขาย {sellerOf(o.seller_id)?.name || "-"}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#C2410C", background: "#C2410C18", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", alignSelf: "start" }}>
                  {o.status === "disputed" ? "พิพาท · ไกล่เกลี่ย" : o.status === "return_requested" ? "ขอคืน · รอพิจารณา" : "ส่งคืนแล้ว · รอผู้ขายรับ"}
                </span>
              </div>
              <ReturnSteps status={o.status} />
              <div style={{ background: "#FFF7ED", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#C2410C" }}>{o.dispute_reason} {o.require_return ? "· ต้องการคืนของรับเงิน" : "· ขอไกล่เกลี่ย"}</div>
                <div style={{ fontSize: 12.5, color: C.ink, marginTop: 2 }}>{o.dispute_detail}</div>
                {(o.evidence_paths || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {o.evidence_paths.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>
                    ))}
                  </div>
                )}
              </div>
              {["return_requested", "disputed"].includes(o.status) && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setRejectReturn(o.id)} disabled={busy}
                    style={{ flex: 1, height: 42, borderRadius: 9, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    ✕ ปฏิเสธ
                  </button>
                  <button onClick={() => call("/api/admin/return-decide", { orderId: o.id, approve: true })} disabled={busy}
                    style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: "#C2410C", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    ✓ อนุมัติการคืน
                  </button>
                </div>
              )}
              {o.status === "return_shipped" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: C.muted }}>เลขคืน: <b>{o.return_carrier} · {o.return_tracking_no}</b>{o.return_deadline ? ` · เดดไลน์ ${new Date(o.return_deadline).toLocaleDateString("th-TH")}` : ""}</div>
                  <button onClick={() => call("/api/admin/simulate-return", { orderId: o.id })} disabled={busy}
                    style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 9, border: `1.5px dashed ${C.warn}`, background: "#FEF6E7", color: C.warn, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                    ⏩ จำลองครบ 10 วัน — ระบบยืนยันรับของแทน (เดโม่แทน cron)
                  </button>
                </div>
              )}
            </div>
          )))}

        {/* ── คิวรอโอนเงิน (จ่ายผู้ขาย) ── */}
        {tab === "payout" && (payoutQ.length === 0
          ? <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ไม่มีรายการรอโอน 🎉</div>
          : payoutQ.map(o => {
            const net = Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0);
            return (
              <div key={o.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.item}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · ผู้ซื้อยืนยันรับแล้ว {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString("th-TH") : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>ยอดโอนสุทธิ (หักเรท {baht(o.seller_fee)})</div>
                    <b style={{ color: C.ok, fontSize: 17 }}>{baht(net)}</b>
                  </div>
                </div>
                <PayeeInfo seller={sellerOf(o.seller_id)} />
                {o.payout_failed_note && (
                  <div style={{ fontSize: 12, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
                    🔁 เคยโอนไม่สำเร็จ: {o.payout_failed_note}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>แนบสลิปโอนออก * (บังคับทุกครั้ง)</div>
                  <input type="file" accept="image/*" onChange={e => setPayoutFile({ ...payoutFile, [o.id]: e.target.files?.[0] })} style={{ fontSize: 12 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setFail(o.id)} disabled={busy}
                      style={{ flex: 1, height: 42, borderRadius: 9, border: `1.5px solid ${C.warn}`, background: "#fff", color: C.warn, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                      ⚠ โอนไม่สำเร็จ
                    </button>
                    <button onClick={() => doPayout(o)} disabled={busy}
                      style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: C.brand, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                      💸 โอนแล้ว — ปิดออเดอร์
                    </button>
                  </div>
                </div>
              </div>
            );
          }))}
      </div>


        {/* ── กลุ่มคืนเงินผู้ซื้อ ── */}
        {tab === "payout" && refundQ.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#C2410C", marginTop: 4 }}>↩️ คิวคืนเงินผู้ซื้อ ({refundQ.length})</div>
            {refundQ.map(o => {
              const refund = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
              const buyer = buyerOf(o.buyer_id);
              return (
                <div key={o.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.item}</div>
                      <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · รับของคืนแล้ว{o.auto_confirmed ? " (ระบบยืนยันแทน)" : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: C.muted }}>ยอดคืนผู้ซื้อ (เต็มจำนวน)</div>
                      <b style={{ color: "#C2410C", fontSize: 17 }}>{baht(refund)}</b>
                    </div>
                  </div>
                  <PayeeInfo seller={buyer} />
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>แนบสลิปคืนเงิน * (ผู้ซื้อจะเห็น)</div>
                    <input type="file" accept="image/*" onChange={e => setPayoutFile({ ...payoutFile, [o.id]: e.target.files?.[0] })} style={{ fontSize: 12 }} />
                    <button onClick={() => doRefund(o)} disabled={busy}
                      style={{ height: 42, borderRadius: 9, border: "none", background: "#C2410C", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                      💸 คืนเงินแล้ว — ปิดเคส
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}


        {/* ── คิว KYC — การ์ดเทียบเอกสารคู่ ── */}
        {tab === "kyc" && (kycQueue.length === 0
          ? <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ไม่มีเอกสารรอตรวจ 🎉</div>
          : kycQueue.map(u => (
            <div key={u.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{u.email} {u.phone ? `· ${u.phone}` : ""} · ยื่นเมื่อ {u.kyc_submitted_at ? new Date(u.kyc_submitted_at).toLocaleString("th-TH") : "-"}</div>
                </div>
              </div>
              <PayeeInfo seller={u} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                {[["id", "บัตรประชาชน"], ["bank", "หน้าสมุดบัญชี"]].map(([k, label]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, marginBottom: 4 }}>{label}</div>
                    {kycUrls[u.id + "-" + k]
                      ? <a href={kycUrls[u.id + "-" + k]} target="_blank" rel="noreferrer">
                          <img src={kycUrls[u.id + "-" + k]} alt={label} style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                          <span style={{ fontSize: 10.5, color: C.brand }}>คลิกซูม ↗</span>
                        </a>
                      : <div style={{ fontSize: 12, color: C.muted }}>กำลังโหลด...</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setRejectKyc(u.id)} disabled={busy}
                  style={{ flex: 1, height: 42, borderRadius: 9, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  ✕ ปฏิเสธ
                </button>
                <button onClick={() => call("/api/admin/kyc-decide", { userId: u.id, approve: true })} disabled={busy}
                  style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: C.ok, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  ✓ ผ่าน — เปิดสิทธิ์ผู้ขาย
                </button>
              </div>
            </div>
          )))}

        {/* ── จัดการสินค้า ── */}
        {tab === "products" && (
          <>
            <input value={pq} onChange={e => setPq(e.target.value)} placeholder="ค้นหาชื่อสินค้า / แบรนด์..."
              style={{ height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff" }} />
            {products.filter(p => !pq.trim() || `${p.name} ${p.brand || ""}`.toLowerCase().includes(pq.toLowerCase())).map(p => {
              const st = { active: ["ขายอยู่", C.ok], review: ["รอตรวจ", C.warn], suspended: ["ระงับ", C.danger], sold: ["ขายแล้ว", C.muted] }[p.status] || [p.status, C.muted];
              return (
                <div key={p.id} style={{ ...card, display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>
                    {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{baht(p.price)} · ผู้ขาย {sellerOf(p.seller_id)?.name || p.seller_name || "-"}</div>
                    {p.suspend_reason && <div style={{ fontSize: 11, color: C.danger }}>เหตุผลระงับ: {p.suspend_reason}</div>}
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st[1], background: `${st[1]}18`, padding: "3px 9px", borderRadius: 999 }}>{st[0]}</span>
                  {p.status === "suspended"
                    ? <button onClick={() => call("/api/admin/product-status", { productId: p.id, action: "restore" })} disabled={busy}
                        style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.ok}`, background: "#fff", color: C.ok, fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>เปิดขาย</button>
                    : <button onClick={() => setSuspendP(p.id)} disabled={busy}
                        style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.danger}`, background: "#fff", color: C.danger, fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>ระงับ</button>}
                </div>
              );
            })}
          </>
        )}

      </div>{/* /main */}

      {reject && <ReasonModal title="เหตุผลการปฏิเสธสลิป (ผู้ซื้อจะเห็น)" onCancel={() => setReject(null)}
        onSubmit={r => { setReject(null); call("/api/admin/verify", { orderId: reject, approve: false, reason: r }); }} />}
      {rejectGroup && <ReasonModal title="เหตุผลการปฏิเสธสลิปทั้งกลุ่ม (ผู้ซื้อจะเห็น + แนบใหม่ทั้งกลุ่ม)" onCancel={() => setRejectGroup(null)}
        onSubmit={r => { setRejectGroup(null); call("/api/admin/verify", { payGroup: rejectGroup, approve: false, reason: r }); }} />}
      {rejectReturn && <ReasonModal title="เหตุผลปฏิเสธการคืนสินค้า (ผู้ซื้อจะเห็น)" onCancel={() => setRejectReturn(null)}
        onSubmit={r => { setRejectReturn(null); call("/api/admin/return-decide", { orderId: rejectReturn, approve: false, reason: r }); }} />}
      {rejectKyc && <ReasonModal title="เหตุผลที่เอกสาร KYC ไม่ผ่าน (ผู้ใช้จะเห็น + ยื่นใหม่ได้)" onCancel={() => setRejectKyc(null)}
        onSubmit={r => { setRejectKyc(null); call("/api/admin/kyc-decide", { userId: rejectKyc, approve: false, reason: r }); }} />}
      {suspendP && <ReasonModal title="เหตุผลการระงับสินค้า (ผู้ขายจะเห็น)" onCancel={() => setSuspendP(null)}
        onSubmit={r => { setSuspendP(null); call("/api/admin/product-status", { productId: suspendP, action: "suspend", reason: r }); }} />}
      {fail && <ReasonModal title="หมายเหตุโอนไม่สำเร็จ (ผู้ขายจะเห็น + ถูกแจ้งให้แก้บัญชี)" onCancel={() => setFail(null)}
        onSubmit={r => { setFail(null); call("/api/admin/payout", { orderId: fail, failNote: r }); }} />}
    </div>
  );
}

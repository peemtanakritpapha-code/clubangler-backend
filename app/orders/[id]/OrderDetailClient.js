"use client";
// app/orders/[id]/OrderDetailClient.js — รายละเอียดออเดอร์ (spec §3–4 + prototype WOrderDetail 1296 / ฝั่งขาย 970)
// ตรรกะทั้งหมดย้ายมาจาก OrdersClient เดิม (call/upload/ส่งคืน/รับคืน/พิพาท) — API ชุดเดิม ไม่แตะฝั่ง server
// กติกาที่รักษา: ที่อยู่ผู้ซื้อเปิดหลังเงินเข้า escrow เท่านั้น · ปฏิเสธ/รายงานผ่าน modal มีเหตุผลเสมอ ·
//   ไม่มีจอหลอก (ยังไม่มี cron auto-confirm → ไม่อ้างว่าระบบจะยืนยันแทนอัตโนมัติ) · เงินฝั่งขาย = S4 แบบ B
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, MapPin, Package, Fish, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReturnSteps from "@/components/ReturnSteps";
import ShippingLabel from "@/components/ShippingLabel";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#1E8E3E", ret: "#C2410C" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const CARRIERS = ["Flash Express", "Kerry Express", "J&T Express", "ไปรษณีย์ไทย EMS", "Ninja Van", "อื่นๆ"];
const RETURN_FLOW = ["disputed", "return_requested", "return_approved", "return_shipped", "return_received", "refunded"];
const DISPUTE_REASONS = ["สินค้าไม่ตรงปก", "สินค้าชำรุด/เสียหาย", "ไม่ได้รับสินค้า", "อื่นๆ"];
const DANGER = "#C24D42"; // โทนแดงของฟอร์มพิพาทตาม reference (ไม่ใช่ส้มอิฐ)

// เลขพัสดุ = ลิงก์เปิดหน้า track ของขนส่งจริง (spec §7 ข้อ 5)
const trackUrl = (carrier, no) => {
  const c = carrier || "";
  if (c.includes("Flash")) return `https://www.flashexpress.com/fle/tracking?se=${no}`;
  if (c.includes("Kerry")) return `https://th.kerryexpress.com/th/track/?track=${no}`;
  if (c.includes("J&T")) return `https://www.jtexpress.co.th/service/track?billcode=${no}`;
  if (c.includes("ไปรษณีย์")) return `https://track.thailandpost.co.th/?trackNumber=${no}`;
  if (c.includes("Ninja")) return `https://www.ninjavan.co/th-th/tracking?id=${no}`;
  return null;
};
const TrackNo = ({ carrier, no }) => {
  if (!no) return null;
  const url = trackUrl(carrier, no);
  return url
    ? <a href={url} target="_blank" rel="noreferrer" style={{ color: C.brand, fontWeight: 800, textDecoration: "underline" }}>{no} ↗</a>
    : <b style={{ color: C.ink }}>{no}</b>;
};

// ป้ายสถานะ 12 ตัว — แยกมุมมองสองฝั่ง (spec §5 + SELLER_BADGE)
const BUYER_BADGE = {
  pending_payment: ["รอชำระเงิน", "#B7791F"], pending_verification: ["รอแอดมินตรวจสอบ", "#B7791F"],
  payment_verified: ["ชำระแล้ว · รอผู้ขายจัดส่ง", C.brand], shipped: ["จัดส่งแล้ว", C.brand],
  delivered: ["ยืนยันรับแล้ว · รอระบบปิดยอด", C.brand], completed: ["สำเร็จ", C.ok],
  disputed: ["อยู่ระหว่างข้อพิพาท", C.danger], return_requested: ["ขอคืน · รอแอดมินพิจารณา", "#B7791F"],
  return_approved: ["อนุมัติคืน · รอคุณส่งกลับ", "#B7791F"], return_shipped: ["ส่งคืนแล้ว · รอผู้ขายรับ", "#B7791F"],
  return_received: ["ผู้ขายรับคืนแล้ว · รอคืนเงิน", C.brand], refunded: ["คืนเงินแล้ว", C.muted],
};
const SELLER_BADGE = {
  pending_payment: ["รอผู้ซื้อชำระ", "#B7791F"], pending_verification: ["แอดมินตรวจสลิป", "#B7791F"],
  payment_verified: ["ต้องจัดส่ง!", C.danger], shipped: ["จัดส่งแล้ว · รอผู้ซื้อยืนยัน", C.brand],
  delivered: ["ผู้ซื้อรับแล้ว · รอรับเงิน", C.brand], completed: ["เสร็จสิ้น · ได้รับเงินแล้ว", C.ok],
  disputed: ["มีข้อพิพาท", C.danger], return_requested: ["ผู้ซื้อขอคืน · รอแอดมิน", "#B7791F"],
  return_approved: ["อนุมัติคืน · รอผู้ซื้อส่งกลับ", "#B7791F"], return_shipped: ["ของคืนกำลังมา · รอคุณรับ", C.danger],
  return_received: ["รับคืนแล้ว · รอระบบคืนเงินผู้ซื้อ", C.brand], refunded: ["คืนเงินผู้ซื้อแล้ว", C.muted],
};

// Timeline 6 ขั้นตามบทบาท (spec §3–4)
const BUY_STEPS = ["สั่งซื้อ", "ชำระเงิน", "ยืนยันการชำระ", "จัดส่งแล้ว", "ยืนยันรับ", "เสร็จสิ้น"];
const SELL_STEPS = ["รอผู้ซื้อชำระ", "ตรวจสลิป", "ต้องจัดส่ง", "จัดส่งแล้ว", "รอรับเงิน", "ได้รับเงิน"];
const STEP_IDX = { pending_payment: 1, pending_verification: 2, payment_verified: 3, shipped: 4, delivered: 5, completed: 5 };

function StepTimeline({ status, steps }) {
  // สายคืน (ตามภาพ prototype): โชว์ timeline ซื้อด้วย — ปักที่ขั้นล่าสุดก่อนเข้าเคส (เคสคืนเกิดได้หลังจัดส่งเท่านั้น)
  const idx = RETURN_FLOW.includes(status) ? STEP_IDX.shipped : (STEP_IDX[status] ?? 0);
  const done = status === "completed";
  return (
    <div style={{ display: "flex", marginBottom: 20 }}>
      {steps.map((s, i) => {
        const passed = i < idx || (i === idx && done);
        const current = i === idx && !done;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
            {i < steps.length - 1 && <div style={{ position: "absolute", top: 15, left: "50%", width: "100%", height: 3, background: passed ? C.brand : C.line, zIndex: 0 }} />}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: passed ? C.brand : current ? C.brandTint : "#fff", border: `2px solid ${passed || current ? C.brand : C.line}`, color: passed ? "#fff" : current ? C.brand : C.muted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", position: "relative", zIndex: 1, fontSize: 12.5, fontWeight: 700 }}>
              {passed ? <Check size={14} strokeWidth={3} /> : i + 1}
            </div>
            <div style={{ fontSize: 10.5, color: passed || current ? C.ink : C.muted, marginTop: 5, fontWeight: current ? 800 : 400 }}>{s}</div>
          </div>
        );
      })}
    </div>
  );
}

// ฟอร์มแจ้งปัญหา/ขอคืน — ดีไซน์+พฤติกรรมตาม ClubAngler_dispute_form.jsx (checklist 7 จุด)
// pill เหตุผล · photo grid 62×62 ลบรายรูป + กล่อง "+" เส้นประ · ปุ่มล็อกจนครบ 3 อย่างและบอกสิ่งที่ขาด
function DisputeModal({ order, userId, onClose, onDone }) {
  const supabase = createClient();
  const [dF, setDF] = useState({ reason: "", detail: "", returnWant: true, files: [], previews: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dOk = dF.reason && dF.detail.trim() && dF.files.length > 0;

  const addFiles = e => {
    const add = Array.from(e.target.files || []).slice(0, 5 - dF.files.length);
    if (!add.length) return;
    const files = [...dF.files, ...add];
    setDF(f => { f.previews.forEach(u => URL.revokeObjectURL(u)); return { ...f, files, previews: files.map(x => URL.createObjectURL(x)) }; });
    e.target.value = "";
  };
  const removePhoto = i => {
    const files = dF.files.filter((_, j) => j !== i);
    setDF(f => { f.previews.forEach(u => URL.revokeObjectURL(u)); return { ...f, files, previews: files.map(x => URL.createObjectURL(x)) }; });
  };

  const submit = async () => {
    if (!dOk || busy) return;
    setErr(""); setBusy(true);
    try {
      const urls = [];
      for (const f of dF.files) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/dispute-${order.order_no}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, f);
        if (error) throw error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      const res = await fetch(`/api/orders/${order.id}/dispute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: dF.reason, detail: dF.detail.trim(), requireReturn: dF.returnWant, evidencePaths: urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งเรื่องไม่สำเร็จ");
      // toast แยกข้อความสองโหมด (ข้อความตามจริง: SLA เป็นเป้าหมายทีมงาน)
      onDone(dF.returnWant ? "ส่งคำขอคืนสินค้าแล้ว — แอดมินกำลังพิจารณา" : "เปิดข้อพิพาทแล้ว — แอดมินกำลังตรวจสอบ");
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const label = { fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,19,20,.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 14, border: `1.5px solid ${DANGER}`, padding: 16, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>แจ้งปัญหาสินค้า</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{order.order_no} · {order.item} — ผู้ขายและแอดมินจะเห็นข้อมูลชุดนี้</div>
        </div>

        {/* 1. เหตุผล — pill 4 ตัวเลือก */}
        <div>
          <div style={label}>เหตุผล <span style={{ color: DANGER }}>*</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DISPUTE_REASONS.map(r => (
              <span key={r} onClick={() => setDF(f => ({ ...f, reason: r }))}
                style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 999, cursor: "pointer", border: `1.5px solid ${dF.reason === r ? DANGER : C.line}`, background: dF.reason === r ? "#FBEAE8" : "#fff", color: dF.reason === r ? DANGER : C.ink, fontWeight: dF.reason === r ? 700 : 500 }}>{r}</span>
            ))}
          </div>
        </div>

        {/* 2. รายละเอียด — บังคับ */}
        <div>
          <div style={label}>รายละเอียด <span style={{ color: DANGER }}>*</span></div>
          <textarea value={dF.detail} onChange={e => setDF(f => ({ ...f, detail: e.target.value }))} placeholder="อธิบายปัญหาที่พบ..." rows={3}
            style={{ width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* 3. รูปหลักฐาน — photo grid 62×62 + ✕ + กล่อง "+" เส้นประ (ซ่อนเมื่อครบ 5) */}
        <div>
          <div style={label}>รูปหลักฐาน <span style={{ color: DANGER }}>*</span> <span style={{ fontWeight: 400, color: C.muted }}>(อย่างน้อย 1 สูงสุด 5 — แอดมินใช้เทียบกับรูปประกาศขาย)</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dF.previews.map((src, i) => (
              <div key={i} style={{ position: "relative", width: 62, height: 62 }}>
                <img src={src} alt="" style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                <span onClick={() => removePhoto(i)}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: DANGER, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</span>
              </div>
            ))}
            {dF.files.length < 5 && (
              <label style={{ width: 62, height: 62, border: `1.5px dashed ${C.line}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, cursor: "pointer", fontSize: 22 }}>
                +
                <input type="file" accept="image/*" multiple onChange={addFiles} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>

        {/* 4. โหมด: คืนของ (default) vs พิพาทไกล่เกลี่ย */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.ink, cursor: "pointer" }}>
          <input type="checkbox" checked={dF.returnWant} onChange={e => setDF(f => ({ ...f, returnWant: e.target.checked }))} style={{ accentColor: C.brand }} />
          ต้องการคืนสินค้าและรับเงินคืน (ไม่ติ๊ก = เปิดข้อพิพาทให้แอดมินไกล่เกลี่ย)
        </label>

        {err && <div style={{ fontSize: 12.5, color: DANGER, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

        {/* 5. ปุ่มส่ง — ล็อกจนครบ + บอกสิ่งที่ขาด */}
        <button onClick={submit} disabled={!dOk || busy}
          style={{ height: 44, border: "none", borderRadius: 10, background: DANGER, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: dOk ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: dOk && !busy ? 1 : .4 }}>
          {busy ? "กำลังส่ง..." : dOk ? (dF.returnWant ? "ส่งคำขอคืนสินค้า" : "ยืนยันเปิดข้อพิพาท") : "เลือกเหตุผล + กรอกรายละเอียด + แนบรูปอย่างน้อย 1"}
        </button>
        <button onClick={onClose} style={{ height: 38, border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
      </div>
    </div>
  );
}

export default function OrderDetailClient({ order: o, role, counterpart, sender, config, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const isSeller = role === "sell";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dispute, setDispute] = useState(false);
  const [toast, setToast] = useState("");
  const [labelOpen, setLabelOpen] = useState(false);
  const [ship, setShip] = useState({ carrier: CARRIERS[0], no: "" });
  const [ret, setRet] = useState({ carrier: CARRIERS[0], no: "", files: [] });
  const [recvFiles, setRecvFiles] = useState([]);

  const badge = (isSeller ? SELLER_BADGE : BUYER_BADGE)[o.status] || [o.status, C.muted];
  const escrowIn = ["payment_verified", "shipped", "delivered", "completed"].includes(o.status);
  const inReturn = RETURN_FLOW.includes(o.status);
  const total = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
  const sellerNet = Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0); // S4 แบบ B

  const call = async (url, body, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const uploadImgs = async (files, prefix) => {
    const urls = [];
    for (const f of files.slice(0, 5)) {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(path, f);
      if (error) throw error;
      urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };
  const doReturnShip = async () => {
    if (!ret.no.trim()) return setErr("กรอกเลขพัสดุคืน");
    setErr(""); setBusy(true);
    try {
      const proof = ret.files.length ? await uploadImgs(ret.files, `return-${o.order_no}`) : [];
      const res = await fetch(`/api/orders/${o.id}/return-ship`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrier: ret.carrier, trackingNo: ret.no, proofPaths: proof }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const doReturnReceive = async () => {
    if (!recvFiles.length) return setErr("ถ่ายรูปสภาพของคืนอย่างน้อย 1 รูปก่อนยืนยัน");
    setErr(""); setBusy(true);
    try {
      const urls = await uploadImgs(recvFiles, `recv-${o.order_no}`);
      const res = await fetch(`/api/orders/${o.id}/return-receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditionPaths: urls }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const copyAddr = () => {
    const st = o.ship_to || {};
    navigator.clipboard?.writeText(`${st.name || ""} ${st.phone || ""}\n${st.full || ""}`.trim());
  };

  const card = { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const box = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 };
  const cpName = counterpart?.name || "บัญชีที่ถูกลบ";
  const roleQ = isSeller ? "sell" : "buy";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/orders?role=${roleQ}`} aria-label="กลับ" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none" }}>
            <ChevronLeft size={18} />
          </Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{isSeller ? "ออเดอร์ขาย" : "รายละเอียดคำสั่งซื้อ"}</div>
        </div>

        <div style={card}>
          {/* หัว: เลขออเดอร์ + badge สถานะตามบทบาท */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>คำสั่งซื้อ <span style={{ color: C.muted, fontWeight: 400 }}>{o.order_no}</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 999, background: `${badge[1]}1a`, color: badge[1], whiteSpace: "nowrap" }}>{badge[0]}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>สั่งเมื่อ {new Date(o.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>

          <StepTimeline status={o.status} steps={isSeller ? SELL_STEPS : BUY_STEPS} />

          {/* กล่อง escrow (spec §3 ข้อ 2) — ข้อความตามจริง ไม่อ้าง auto-confirm ที่ยังไม่มี */}
          {inReturn && o.status !== "refunded" && (
            <div style={{ background: C.brandTint, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
              <ShieldCheck size={18} color={C.brand} style={{ flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: C.brand, lineHeight: 1.6 }}>
                เงิน {baht(total)} ยังถูกพักไว้กับ ClubAngler ระหว่างเคสคืน/พิพาท — จะไม่ปล่อยให้ฝ่ายใดจนกว่าเคสจะได้ข้อสรุป
              </div>
            </div>
          )}
          {!inReturn && (
            <div style={{ background: C.brandTint, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
              <ShieldCheck size={18} color={C.brand} style={{ flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: C.brand, lineHeight: 1.6 }}>
                {isSeller
                  ? <>เงิน {baht(total)} ของผู้ซื้อ{escrowIn ? "อยู่ในระบบคุ้มครองแล้ว" : "จะพักกับ ClubAngler เมื่อชำระ"} — คุณจะได้รับ <b>{baht(sellerNet)}</b> หลังผู้ซื้อยืนยันรับสินค้าและทีมงานโอนในเวลาทำการ</>
                  : <>เงิน {baht(total)} ของคุณ{escrowIn ? "ถูกพักไว้กับ ClubAngler อย่างปลอดภัย" : "จะถูกพักกับ ClubAngler เมื่อชำระ"} — จะปล่อยให้ผู้ขายเมื่อคุณกด "ยืนยันได้รับสินค้า"</>}
              </div>
            </div>
          )}

          {/* ที่อยู่ | การจัดส่ง (spec §3 ข้อ 4 / §4 กติกาเปิดที่อยู่) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={box}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={14} color={C.brand} /> ที่อยู่จัดส่ง</div>
              {isSeller && !escrowIn && !inReturn ? (
                <div style={{ fontSize: 12.5, color: C.muted }}>🔒 เปิดเผยเมื่อการชำระเงินผ่านการตรวจสอบ</div>
              ) : o.ship_to ? (
                <>
                  <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.7 }}><b>{o.ship_to.name}</b> · {o.ship_to.phone}<br />{o.ship_to.full}</div>
                  {isSeller && (
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                      <span onClick={copyAddr} style={{ fontSize: 11.5, color: C.brand, fontWeight: 800, cursor: "pointer" }}>⧉ คัดลอกที่อยู่</span>
                      <span onClick={() => setLabelOpen(true)} style={{ fontSize: 11.5, color: C.brand, fontWeight: 800, cursor: "pointer" }}>🖨 พิมพ์ใบปะหน้า</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: C.muted }}>— (ออเดอร์นี้ไม่มีข้อมูลที่อยู่)</div>
              )}
            </div>
            <div style={box}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}><Package size={14} color={C.brand} /> การจัดส่ง</div>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.8 }}>
                {o.tracking_no
                  ? <>{o.carrier || "ขนส่ง"} · <TrackNo carrier={o.carrier} no={o.tracking_no} /></>
                  : (isSeller ? "ยังไม่ได้แจ้งจัดส่ง" : "ผู้ขายยังไม่ได้จัดส่ง")}
                {o.return_tracking_no && <><br />พัสดุคืน: {o.return_carrier || "ขนส่ง"} · <TrackNo carrier={o.return_carrier} no={o.return_tracking_no} /></>}
              </div>
            </div>
          </div>

          {/* คู่ค้า + รายการสินค้า (spec §3 ข้อ 5) */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            <Link href={counterpart ? `/seller/${counterpart.id}` : "#"} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, textDecoration: "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: counterpart?.is_shop ? "#F0A500" : C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, overflow: "hidden", flex: "none" }}>
                {counterpart?.avatar_path ? <img src={counterpart.avatar_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : cpName.charAt(0).toUpperCase()}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{isSeller ? `ผู้ซื้อ: ${cpName}` : cpName}</span>
              {counterpart?.kyc_status === "verified" && <ShieldCheck size={13} color={C.brand} />}
            </Link>
            <div style={{ display: "flex", gap: 12, padding: 14, alignItems: "center" }}>
              <Link href={o.products?.id ? `/product/${o.products.id}` : "#"} style={{ width: 56, height: 56, borderRadius: 8, background: C.brandTint, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {o.products?.images?.[0] ? <img src={o.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Fish size={24} color={C.brand} strokeWidth={1.2} />}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{o.item}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>× 1</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{baht(o.price)}</div>
            </div>
          </div>

          {/* สรุปเงิน — ผู้ซื้อเห็นยอดจ่าย / ผู้ขายเห็นยอดรับ (S4 แบบ B) */}
          <div style={{ ...box, background: isSeller ? C.brandTint : "#fff", border: isSeller ? "none" : box.border, marginBottom: 14 }}>
            {isSeller ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 6 }}><span>ราคาขาย</span><span style={{ color: C.ink }}>{baht(o.price)}</span></div>
                {Number(o.ship_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 6 }}><span>ค่าส่งที่ผู้ซื้อจ่าย</span><span style={{ color: C.ink }}>+{baht(o.ship_fee)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 8 }}><span>ค่าธรรมเนียมการขาย</span><span style={{ color: C.ink }}>−{baht(o.seller_fee)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 9, borderTop: "1px solid rgba(14,126,140,.25)" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>{o.status === "completed" ? "ได้รับแล้ว" : "คุณจะได้รับ"}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>{baht(sellerNet)}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 6 }}><span>ราคาสินค้า</span><span style={{ color: C.ink }}>{baht(o.price)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 6 }}><span>ค่าจัดส่ง</span><span style={{ color: C.ink }}>{Number(o.ship_fee) > 0 ? baht(o.ship_fee) : "ฟรี"}</span></div>
                {Number(o.buyer_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 6 }}><span>ค่าธรรมเนียมผู้ซื้อ</span><span style={{ color: C.ink }}>{baht(o.buyer_fee)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.ink, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 2 }}><span>รวมชำระ</span><span style={{ color: C.brand }}>{baht(total)}</span></div>
              </>
            )}
          </div>

          {/* ── โซนสายคืน/พิพาท — สองฝั่งเห็นหลักฐานชุดเดียวกัน ── */}
          {inReturn && (
            <div style={{ background: o.status === "refunded" ? "#F1F3F4" : o.status === "disputed" ? "#FFF5F5" : "#FFF7ED", border: `1px solid ${o.status === "disputed" ? "#FCA5A5" : "#FED7AA"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <ReturnSteps status={o.status} />
              {/* หัวเรื่องบอก "ใครต้องทำอะไรต่อ" ตามภาพ prototype */}
              <div style={{ fontSize: 13, fontWeight: 800, color: o.status === "disputed" ? C.danger : C.ret, margin: "10px 0 4px" }}>
                {{
                  disputed: "⚠ อยู่ระหว่างข้อพิพาท — แอดมินตรวจหลักฐานสองฝั่ง",
                  return_requested: "🕐 ส่งคำขอคืนสินค้าแล้ว — แอดมินกำลังพิจารณา",
                  return_approved: isSeller ? "📦 อนุมัติการคืนแล้ว — รอผู้ซื้อส่งของกลับ" : "📦 อนุมัติการคืนแล้ว — ส่งของกลับและกรอกเลขพัสดุด้านล่าง",
                  return_shipped: isSeller ? "🔄 ผู้ซื้อส่งคืนแล้ว — รอคุณยืนยันรับของ" : "🔄 ส่งคืนแล้ว — รอผู้ขายยืนยันรับของ",
                  return_received: "✅ ผู้ขายรับของคืนแล้ว — รอทีมงานคืนเงิน",
                  refunded: "↩️ คืนเงินเรียบร้อยแล้ว",
                }[o.status]}
              </div>
              <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.8 }}>
                เหตุผลที่แจ้ง: <b>{o.dispute_reason || "-"}</b>
                {o.dispute_detail && <><br />คำอธิบายของ{isSeller ? "ผู้ซื้อ" : "คุณ"}: "{o.dispute_detail}"</>}
              </div>
              {(o.evidence_paths || []).length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>หลักฐานที่{isSeller ? "ผู้ซื้อ" : "คุณ"}แนบ ({o.evidence_paths.length}) — กดเพื่อขยาย</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {o.evidence_paths.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>
                    ))}
                  </div>
                </>
              )}
              {(o.return_condition_paths || []).length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>รูปสภาพของคืนที่ผู้ขายถ่ายตอนรับ:</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {o.return_condition_paths.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>
                    ))}
                  </div>
                </>
              )}
              {!isSeller && o.status === "return_shipped" && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", borderRadius: 8, padding: "8px 11px", marginTop: 10 }}>
                  ⏱ หากผู้ขายไม่ยืนยันรับของภายในเวลาอันควร ทีมงานสามารถยืนยันแทนและส่งเรื่องเข้าคิวคืนเงินได้ — คุณไม่ต้องทำอะไรเพิ่ม
                </div>
              )}
              {o.auto_confirmed && <div style={{ fontSize: 11, color: C.ret, marginTop: 6 }}>⏰ ทีมงานยืนยันรับของคืนแทนผู้ขาย (ครบกำหนด)</div>}
            </div>
          )}
          {o.return_reject_reason && o.status === "delivered" && (
            <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
              ❌ คำขอคืนไม่ได้รับอนุมัติ — เหตุผล: {o.return_reject_reason}
            </div>
          )}

          {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{err}</div>}

          {/* ══ ปุ่ม/ฟอร์มตามสถานะ — ฝั่งผู้ซื้อ ══ */}
          {!isSeller && o.status === "pending_payment" && (
            <Link href={`/pay/${o.id}`} style={{ display: "block", textAlign: "center", background: C.brand, color: "#fff", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              💳 ชำระเงิน / แนบสลิป
            </Link>
          )}
          {!isSeller && o.status === "pending_verification" && (
            <div style={{ ...box, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12.5, color: "#92400E" }}>🕐 แนบสลิปแล้ว — ทีมงานกำลังตรวจสอบ สถานะจะอัปเดตที่นี่</div>
          )}
          {!isSeller && o.status === "shipped" && (
            <button disabled={busy} onClick={() => call(`/api/orders/${o.id}/confirm`, {}, "ยืนยันว่าได้รับสินค้าและตรวจสอบแล้ว?\n\nหลังยืนยัน แอดมินจะโอนเงินให้ผู้ขาย")}
              style={{ width: "100%", height: 48, border: "none", borderRadius: 10, background: "#22C55E", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>
              ✅ ยืนยันได้รับสินค้า
            </button>
          )}
          {!isSeller && ["shipped", "delivered"].includes(o.status) && (
            <button onClick={() => setDispute(true)}
              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 10, border: `1.5px solid ${C.ret}`, background: "#fff", color: C.ret, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
              ⚠ แจ้งปัญหา / ขอคืนสินค้า
            </button>
          )}
          {!isSeller && o.status === "return_approved" && (
            <div style={{ display: "grid", gap: 8, background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ret }}>ส่งสินค้าคืนผู้ขาย + กรอกเลขพัสดุ</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={ret.carrier} onChange={e => setRet({ ...ret, carrier: e.target.value })}
                  style={{ height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 12.5, background: "#fff" }}>
                  {CARRIERS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={ret.no} placeholder="เลขพัสดุคืน *" onChange={e => setRet({ ...ret, no: e.target.value })}
                  style={{ flex: 1, height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, outline: "none" }} />
              </div>
              <input type="file" accept="image/*" multiple style={{ fontSize: 11.5 }} onChange={e => setRet({ ...ret, files: Array.from(e.target.files || []) })} />
              <button disabled={busy || !ret.no.trim()} onClick={doReturnShip}
                style={{ height: 44, border: "none", borderRadius: 9, background: ret.no.trim() ? C.ret : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                ↩️ ยืนยันส่งคืนแล้ว
              </button>
            </div>
          )}

          {/* ══ ฝั่งผู้ขาย ══ */}
          {isSeller && ["pending_payment", "pending_verification"].includes(o.status) && (
            <div style={{ ...box, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12.5, color: "#92400E" }}>
              🕐 {o.status === "pending_payment" ? "รอผู้ซื้อโอนเงินเข้าระบบ escrow — ยังไม่ต้องส่งของ" : "ผู้ซื้อแนบสลิปแล้ว — แอดมินกำลังตรวจ ยังไม่ต้องส่งของ"}
            </div>
          )}
          {isSeller && o.status === "payment_verified" && (
            <div style={{ border: `1.5px solid ${C.brand}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>🚚 ถึงตาคุณแล้ว — แจ้งจัดส่ง</div>
              <div style={{ fontSize: 11.5, color: C.muted, margin: "3px 0 12px" }}>เงินเข้าระบบคุ้มครองแล้ว ส่งของแล้วกรอกเลขพัสดุด้านล่าง</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <select value={ship.carrier} onChange={e => setShip({ ...ship, carrier: e.target.value })}
                  style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 12.5, background: "#fff" }}>
                  {CARRIERS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={ship.no} placeholder="เลขพัสดุ (Tracking No.) *" onChange={e => setShip({ ...ship, no: e.target.value })}
                  style={{ flex: 1, height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, outline: "none" }} />
              </div>
              <button disabled={busy || !ship.no.trim()} onClick={() => call(`/api/orders/${o.id}/ship`, { carrier: ship.carrier, trackingNo: ship.no })}
                style={{ width: "100%", height: 46, border: "none", borderRadius: 10, background: ship.no.trim() ? C.brand : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                🚚 ยืนยันแจ้งจัดส่ง
              </button>
            </div>
          )}
          {isSeller && o.status === "shipped" && (
            <div style={{ ...box, background: "#F1F3F4", border: "none", fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
              📦 จัดส่งแล้ว — รอผู้ซื้อกดยืนยันรับของ เงินจะเข้าคิวโอนให้คุณทันทีหลังยืนยัน
            </div>
          )}
          {isSeller && o.status === "return_shipped" && (
            <div style={{ display: "grid", gap: 8, background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ret }}>ได้รับของคืนแล้ว? ถ่ายรูปสภาพของอย่างน้อย 1 รูปก่อนยืนยัน (หลักฐานคุ้มครองคุณ)</div>
              <input type="file" accept="image/*" multiple style={{ fontSize: 11.5 }} onChange={e => setRecvFiles(Array.from(e.target.files || []))} />
              <button disabled={busy || !recvFiles.length} onClick={doReturnReceive}
                style={{ height: 44, border: "none", borderRadius: 9, background: recvFiles.length ? C.ret : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                📥 ยืนยันรับของคืนแล้ว
              </button>
            </div>
          )}
        </div>
      </div>

      {dispute && <DisputeModal order={o} userId={userId} onClose={() => setDispute(false)}
        onDone={msg => { setDispute(false); setToast(msg); setTimeout(() => setToast(""), 4000); router.refresh(); }} />}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", background: C.ink, color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 200, whiteSpace: "nowrap" }}>
          ✓ {toast}
        </div>
      )}
      {labelOpen && <ShippingLabel order={o} sender={sender} onClose={() => setLabelOpen(false)} />}
    </div>
  );
}

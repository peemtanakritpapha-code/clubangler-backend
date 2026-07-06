"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, ORDER_STEPS, CARRIERS, DISPUTE_REASONS, trackUrl, fmtAddr } from "@/lib/orderMeta";
import ReturnSteps from "@/components/ReturnSteps";

const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B", ok: "#22C55E", ret: "#C2410C" };
const baht = n => "฿" + Number(n || 0).toLocaleString();
const STEP_LABELS = ["สั่งซื้อ", "ตรวจสลิป", "เข้าระบบฝาก", "จัดส่ง", "รับของ", "เสร็จสิ้น"];

function Timeline({ status }) {
  const idx = ORDER_STEPS[status] ?? 0;
  if (idx < 0) return <ReturnSteps status={status} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, margin: "8px 0" }}>
      {STEP_LABELS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= idx ? C.brand : C.line }} />}
            <div style={{ width: 10, height: 10, borderRadius: 99, background: i <= idx ? C.brand : "#fff", border: `2px solid ${i <= idx ? C.brand : C.line}`, flexShrink: 0 }} />
            {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? C.brand : C.line }} />}
          </div>
          <div style={{ fontSize: 9, color: i <= idx ? C.brand : C.muted, marginTop: 3, fontWeight: i === idx ? 800 : 400 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function TrackNo({ carrier, no }) {
  if (!no) return null;
  return (
    <span onClick={() => window.open(trackUrl(carrier, no), "_blank")} title="เปิดหน้าติดตามพัสดุ"
      style={{ color: "#3B82F6", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
      {carrier} · {no} ↗
    </span>
  );
}

/* ฟอร์มเปิดเคสพิพาท/ขอคืน — เหตุผล + คำอธิบายบังคับ + รูป 1–5 บังคับ + เลือกประเภท */
function DisputeModal({ order, userId, onClose, onDone }) {
  const supabase = createClient();
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [requireReturn, setRequireReturn] = useState(true);
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!reason) return setErr("เลือกเหตุผล");
    if (!detail.trim()) return setErr("กรอกคำอธิบายปัญหา");
    if (!files.length) return setErr("แนบรูปหลักฐานอย่างน้อย 1 รูป (สูงสุด 5)");
    setBusy(true);
    try {
      const urls = [];
      for (const f of files.slice(0, 5)) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/dispute-${order.order_no}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, f);
        if (error) throw error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      const res = await fetch(`/api/orders/${order.id}/dispute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail, requireReturn, evidencePaths: urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งเคสไม่สำเร็จ");
      onDone();
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };

  const chip = on => ({ padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.ret : C.line}`, background: on ? "#FFF7ED" : "#fff", color: on ? C.ret : C.muted });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 440 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: C.ret }}>⚠ แจ้งปัญหา / ขอคืนสินค้า</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "2px 0 12px" }}>{order.item} · {order.order_no}</div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 6 }}>เหตุผล *</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {DISPUTE_REASONS.map(r => <div key={r} style={chip(reason === r)} onClick={() => setReason(r)}>{r}</div>)}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 6 }}>อธิบายปัญหา *</div>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3} placeholder="เล่ารายละเอียด เช่น จุดที่ชำรุด สิ่งที่ไม่ตรงประกาศ..."
          style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />

        <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, margin: "10px 0 6px" }}>รูปหลักฐาน 1–5 รูป *</div>
        <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 5))} style={{ fontSize: 12 }} />
        {files.length > 0 && <div style={{ fontSize: 11.5, color: C.brand, marginTop: 4 }}>เลือกแล้ว {files.length} รูป</div>}

        <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, margin: "12px 0 6px" }}>ต้องการอะไร *</div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={chip(requireReturn)} onClick={() => setRequireReturn(true)}>↩️ คืนสินค้า — รับเงินคืนเต็มจำนวน</div>
          <div style={chip(!requireReturn)} onClick={() => setRequireReturn(false)}>⚖️ เปิดข้อพิพาท — ให้แอดมินไกล่เกลี่ย</div>
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={submit} disabled={busy}
            style={{ flex: 2, height: 42, borderRadius: 9, border: "none", background: C.ret, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? .6 : 1 }}>
            {busy ? "กำลังส่ง..." : "ส่งเคสให้แอดมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// W5.1: หน้าโหมดเว็บตาม prototype WOrders — หัวเปลี่ยนตามบทบาท + ชิปกรองสถานะพร้อมตัวนับ + แถบ "ต้องทำอะไรต่อ"
export default function OrdersClient({ orders, userId, initialRole = "buy" }) {
  const router = useRouter();
  const supabase = createClient();
  const tab = initialRole === "sell" ? "sell" : "buy"; // บทบาทล็อกจากเมนูที่กดมา (?role=) — ไม่มีปุ่มสลับ (feedback W5.1)
  const [statusF, setStatusF] = useState("ทั้งหมด"); // ชิปกรองสถานะ (W5.1)
  const [shipForm, setShipForm] = useState({});
  const [retForm, setRetForm] = useState({});      // ส่งคืน: { [id]: {carrier, no, files} }
  const [recvFiles, setRecvFiles] = useState({});  // ผู้ขายรับของคืน: { [id]: File[] }
  const [dispute, setDispute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // กลุ่มสถานะสำหรับชิปกรอง (มุมมองผู้ซื้อ/ผู้ขาย — ตาม prototype WOrders)
  const RETURN_FLOW = ["disputed", "return_requested", "return_approved", "return_shipped", "return_received", "refunded"];
  const GROUPS = {
    buy: [
      ["รอชำระเงิน", ["pending_payment"]],
      ["รอตรวจสอบ", ["pending_verification"]],
      ["ที่ต้องได้รับ", ["payment_verified", "shipped"]],
      ["สำเร็จ", ["delivered", "completed"]],
      ["ปัญหา/คืนเงิน", RETURN_FLOW],
    ],
    sell: [
      ["รอผู้ซื้อชำระ", ["pending_payment", "pending_verification"]],
      ["ต้องจัดส่ง", ["payment_verified"]],
      ["ส่งแล้ว", ["shipped", "delivered"]],
      ["สำเร็จ", ["completed"]],
      ["ปัญหา/คืนเงิน", RETURN_FLOW],
    ],
  };
  const groups = GROUPS[tab];
  const roleList = useMemo(() => orders.filter(o => tab === "buy" ? o.buyer_id === userId : o.seller_id === userId), [orders, tab, userId]);
  const list = useMemo(() => {
    if (statusF === "ทั้งหมด") return roleList;
    const g = groups.find(x => x[0] === statusF);
    return g ? roleList.filter(o => g[1].includes(o.status)) : roleList;
  }, [roleList, statusF, tab]);

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

  const doReturnShip = async o => {
    const f = retForm[o.id] || {};
    if (!f.no?.trim()) { setErr("กรอกเลขพัสดุคืน"); return; }
    setErr(""); setBusy(true);
    try {
      const proof = f.files?.length ? await uploadImgs(f.files, `return-${o.order_no}`) : [];
      const res = await fetch(`/api/orders/${o.id}/return-ship`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrier: f.carrier || CARRIERS[0], trackingNo: f.no, proofPaths: proof }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const doReturnReceive = async o => {
    const files = recvFiles[o.id] || [];
    if (!files.length) { setErr("ถ่ายรูปสภาพของคืนอย่างน้อย 1 รูปก่อนยืนยัน"); return; }
    setErr(""); setBusy(true);
    try {
      const urls = await uploadImgs(files, `recv-${o.order_no}`);
      const res = await fetch(`/api/orders/${o.id}/return-receive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditionPaths: urls }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const card = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const inReturnFlow = s => ["disputed", "return_requested", "return_approved", "return_shipped", "return_received", "refunded"].includes(s);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" aria-label="กลับหน้าแรก" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 18 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{tab === "buy" ? "การซื้อของฉัน" : "การขายของฉัน"}</div>
        </div>

        {/* ชิปกรองสถานะพร้อมตัวนับ (prototype WOrders / ภาพการซื้อของฉัน) */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {[...groups.map(g => g[0]), "ทั้งหมด"].map(k => {
            const g = groups.find(x => x[0] === k);
            const n = k === "ทั้งหมด" ? roleList.length : roleList.filter(o => g[1].includes(o.status)).length;
            const on = statusF === k;
            return (
              <div key={k} onClick={() => setStatusF(k)} style={{ flex: "none", padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: on ? C.brand : "#fff", color: on ? "#fff" : C.muted, border: `1px solid ${on ? C.brand : C.line}` }}>
                {k} ({n})
              </div>
            );
          })}
        </div>

        {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
        {list.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 0" }}>ยังไม่มีรายการในหมวดนี้</div>}

        {list.map(o => {
          const color = ORDER_STATUS_COLOR[o.status] || C.muted;
          const isSeller = tab === "sell";
          const escrowIn = ["payment_verified", "shipped", "delivered", "completed"].includes(o.status);
          const sf = shipForm[o.id] || { carrier: CARRIERS[0], no: "" };
          const rf = retForm[o.id] || { carrier: CARRIERS[0], no: "", files: [] };
          const total = Number(o.price) + Number(o.buyer_fee || 0) + Number(o.ship_fee || 0);
          return (
            <div key={o.id} style={card}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, background: "#EDF2F2", overflow: "hidden", flexShrink: 0 }}>
                  {o.products?.images?.[0] && <img src={o.products.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.item}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color, background: `${color}18`, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
                      {ORDER_STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{o.order_no} · {new Date(o.created_at).toLocaleDateString("th-TH")}</div>
                  {isSeller ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>{baht(Number(o.price) + Number(o.ship_fee || 0) - Number(o.seller_fee || 0))}</span>
                      <span style={{ fontSize: 10.5, color: C.muted }}>ยอดที่จะได้รับ (รวมค่าส่ง)</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>{baht(total)}</div>
                  )}
                </div>
              </div>

              {/* แถบ "ต้องทำอะไรต่อ" (prototype: บรรทัด ⚡ สีส้ม) — ข้อความตรงกับความจริงของระบบเท่านั้น */}
              {!isSeller && o.status === "pending_payment" && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", marginTop: 8 }}>⚡ รอคุณชำระเงิน — โอนแล้วแนบสลิปเพื่อเริ่มการคุ้มครอง escrow</div>
              )}
              {!isSeller && o.status === "shipped" && (
                <div style={{ fontSize: 12, color: "#1E5F8A", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, padding: "8px 12px", marginTop: 8 }}>ℹ️ ของกำลังมา — เมื่อได้รับ กดยืนยันเพื่อปล่อยเงินให้ผู้ขาย</div>
              )}
              {!isSeller && o.status === "return_approved" && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", marginTop: 8 }}>⚡ อนุมัติคืนแล้ว — ส่งของกลับและกรอกเลขพัสดุด้านล่าง</div>
              )}
              {isSeller && o.status === "payment_verified" && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", marginTop: 8 }}>⚡ ถึงตาคุณแล้ว — แจ้งจัดส่ง + กรอกเลขพัสดุด้านล่าง</div>
              )}
              {isSeller && o.status === "return_shipped" && (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "8px 12px", marginTop: 8 }}>⚡ ของคืนกำลังมา — รับแล้วถ่ายรูปสภาพและกดยืนยันด้านล่าง</div>
              )}

              <Timeline status={o.status} />
              {o.tracking_no && !inReturnFlow(o.status) && <div style={{ fontSize: 12 }}>เลขพัสดุ: <TrackNo carrier={o.carrier} no={o.tracking_no} /></div>}
              {o.return_tracking_no && <div style={{ fontSize: 12 }}>เลขพัสดุคืน: <TrackNo carrier={o.return_carrier} no={o.return_tracking_no} /></div>}

              {/* ข้อมูลเคส — สองฝั่งเห็นหลักฐานชุดเดียวกัน */}
              {inReturnFlow(o.status) && (
                <div style={{ background: "#FFF7ED", borderRadius: 10, padding: "10px 12px", marginTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.ret }}>{o.require_return ? "เคสขอคืนสินค้า" : "เคสพิพาท (ไกล่เกลี่ย)"} — {o.dispute_reason}</div>
                  <div style={{ fontSize: 12, color: C.ink, marginTop: 2 }}>{o.dispute_detail}</div>
                  {(o.evidence_paths || []).length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      {o.evidence_paths.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} /></a>
                      ))}
                    </div>
                  )}
                  {o.auto_confirmed && <div style={{ fontSize: 11, color: C.ret, marginTop: 4 }}>⏰ ระบบยืนยันรับของคืนแทนผู้ขาย (ครบกำหนด)</div>}
                </div>
              )}
              {o.return_reject_reason && o.status === "delivered" && (
                <div style={{ fontSize: 12, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginTop: 6 }}>
                  ❌ คำขอคืนไม่ได้รับอนุมัติ — เหตุผล: {o.return_reject_reason}
                </div>
              )}

              {/* ── ฝั่งผู้ซื้อ ── */}
              {!isSeller && o.status === "pending_payment" && (
                <Link href={`/pay/${o.id}`} style={{ display: "block", textAlign: "center", marginTop: 10, background: C.brand, color: "#fff", padding: "11px 0", borderRadius: 9, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
                  💳 ชำระเงิน / แนบสลิป
                </Link>
              )}
              {!isSeller && o.status === "shipped" && (
                <button disabled={busy}
                  onClick={() => call(`/api/orders/${o.id}/confirm`, {}, "ยืนยันว่าได้รับสินค้าและตรวจสอบแล้ว?\n\nหลังยืนยัน แอดมินจะโอนเงินให้ผู้ขาย")}
                  style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 9, background: C.ok, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                  ✅ ยืนยันรับสินค้า
                </button>
              )}
              {!isSeller && ["shipped", "delivered"].includes(o.status) && (
                <button onClick={() => setDispute(o)}
                  style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 9, border: `1.5px solid ${C.ret}`, background: "#fff", color: C.ret, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                  ⚠ มีปัญหา / ขอคืนสินค้า
                </button>
              )}
              {!isSeller && o.status === "return_approved" && (
                <div style={{ marginTop: 10, display: "grid", gap: 8, background: "#FFF7ED", border: `1.5px solid #FED7AA`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ret }}>ส่งสินค้าคืนผู้ขาย + กรอกเลขพัสดุ</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={rf.carrier} onChange={e => setRetForm({ ...retForm, [o.id]: { ...rf, carrier: e.target.value } })}
                      style={{ height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 12.5, background: "#fff" }}>
                      {CARRIERS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input value={rf.no} placeholder="เลขพัสดุคืน *" onChange={e => setRetForm({ ...retForm, [o.id]: { ...rf, no: e.target.value } })}
                      style={{ flex: 1, height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, outline: "none" }} />
                  </div>
                  <input type="file" accept="image/*" multiple style={{ fontSize: 11.5 }}
                    onChange={e => setRetForm({ ...retForm, [o.id]: { ...rf, files: Array.from(e.target.files || []) } })} />
                  <button disabled={busy || !rf.no?.trim()} onClick={() => doReturnShip(o)}
                    style={{ height: 42, border: "none", borderRadius: 9, background: rf.no?.trim() ? C.ret : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    ↩️ ยืนยันส่งคืนแล้ว
                  </button>
                </div>
              )}
              {!isSeller && o.status === "refunded" && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.ok, background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", fontWeight: 700 }}>
                  💸 คืนเงินเรียบร้อยแล้ว — ขอบคุณที่ใช้ ClubAngler
                </div>
              )}

              {/* ── ฝั่งผู้ขาย ── */}
              {isSeller && escrowIn && (
                <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, marginBottom: 4 }}>ที่อยู่จัดส่ง (เงินเข้าระบบฝากแล้ว)</div>
                  <div style={{ fontSize: 12.5, color: C.ink }}>{o.ship_to?.name} · {o.ship_to?.phone}</div>
                  <div style={{ fontSize: 12.5, color: C.muted }}>{fmtAddr(o.ship_to)}</div>
                  <span onClick={() => navigator.clipboard?.writeText(`${o.ship_to?.name} ${o.ship_to?.phone}\n${fmtAddr(o.ship_to)}`)}
                    style={{ fontSize: 11.5, color: C.brand, fontWeight: 800, cursor: "pointer" }}>⧉ คัดลอกที่อยู่</span>
                </div>
              )}
              {isSeller && !escrowIn && !inReturnFlow(o.status) && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>🔒 ที่อยู่ผู้ซื้อจะแสดงเมื่อเงินเข้าระบบฝากปลอดภัยแล้ว</div>
              )}
              {isSeller && o.status === "payment_verified" && (
                <div style={{ marginTop: 10, display: "grid", gap: 8, background: "#FAFDFD", border: `1.5px solid ${C.brandTint}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: C.brand }}>จัดส่งสินค้า + กรอกเลขพัสดุ</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={sf.carrier} onChange={e => setShipForm({ ...shipForm, [o.id]: { ...sf, carrier: e.target.value } })}
                      style={{ height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 12.5, background: "#fff" }}>
                      {CARRIERS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input value={sf.no} placeholder="เลขพัสดุ *" onChange={e => setShipForm({ ...shipForm, [o.id]: { ...sf, no: e.target.value } })}
                      style={{ flex: 1, height: 40, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13, outline: "none" }} />
                  </div>
                  <button disabled={busy || !sf.no.trim()} onClick={() => call(`/api/orders/${o.id}/ship`, { carrier: sf.carrier, trackingNo: sf.no })}
                    style={{ height: 42, border: "none", borderRadius: 9, background: sf.no.trim() ? C.brand : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: sf.no.trim() ? "pointer" : "not-allowed" }}>
                    🚚 ยืนยันจัดส่งแล้ว
                  </button>
                </div>
              )}
              {isSeller && o.status === "return_shipped" && (
                <div style={{ marginTop: 10, display: "grid", gap: 8, background: "#FFF7ED", border: `1.5px solid #FED7AA`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ret }}>รับของคืน — ถ่ายรูปสภาพก่อนยืนยัน (≥1 รูป) *</div>
                  {o.return_deadline && <div style={{ fontSize: 11, color: C.muted }}>เดดไลน์ยืนยัน: {new Date(o.return_deadline).toLocaleDateString("th-TH")} (เลยกำหนดระบบยืนยันแทน)</div>}
                  <input type="file" accept="image/*" multiple style={{ fontSize: 11.5 }}
                    onChange={e => setRecvFiles({ ...recvFiles, [o.id]: Array.from(e.target.files || []) })} />
                  <button disabled={busy || !(recvFiles[o.id] || []).length} onClick={() => doReturnReceive(o)}
                    style={{ height: 42, border: "none", borderRadius: 9, background: (recvFiles[o.id] || []).length ? C.ret : "#C9D6D8", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                    📦 ยืนยันรับของคืนแล้ว
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {dispute && <DisputeModal order={dispute} userId={userId} onClose={() => setDispute(null)} onDone={() => { setDispute(null); router.refresh(); }} />}
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReturnSteps from "@/components/ReturnSteps";

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

export default function AdminClient({ orders, sellers, buyers, userId, kycQueue = [], products = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("verify");
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ หน้าแรก</Link>
          <div style={{ fontWeight: 800, color: C.brand }}>🛠 หลังบ้านแอดมิน</div>
        </div>

        <div style={{ display: "flex", background: "#fff", borderRadius: 12, padding: 4, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
          {[["verify", `🧾 สลิป (${verifyQ.length})`], ["returns", `↩️ คืนของ (${returnQ.length})`], ["payout", `💸 โอน (${payoutQ.length + refundQ.length})`], ["kyc", `🪪 KYC (${kycQueue.length})`], ["products", `🎣 สินค้า`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex: 1, height: 38, border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 800, fontSize: 13,
                background: tab === k ? C.brandTint : "transparent", color: tab === k ? C.brand : C.muted }}>
              {label}
            </button>
          ))}
        </div>

        {err && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

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

"use client";
// app/kyc/KycClient.js — บัญชีรับเงิน & ยืนยันตัวตน (แยกจาก /profile ตาม spec §2 แถว 6)
// ตรรกะ savePayee/submitKyc ยกมาจาก ProfileClient เดิมทั้งชุด — API /api/kyc/submit เดิม ไม่แตะ
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต (ttb)", "ออมสิน", "อื่นๆ"];
const C = { brand: "#0E7E8C", brandTint: "#E3F1F3", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7", danger: "#C0392B" };

export default function KycClient({ initialProfile, userId }) {
  const supabase = createClient();
  const [profile, setProfile] = useState(initialProfile || {});
  const [busy, setBusy] = useState(false);
  const [payee, setPayee] = useState({ promptpay: initialProfile?.promptpay || "", bank: initialProfile?.bank?.bank || BANKS[0], accNo: initialProfile?.bank?.no || "", accName: initialProfile?.bank?.name || "" });
  const [payeeMsg, setPayeeMsg] = useState("");
  const [idCard, setIdCard] = useState(null);
  const [bankBook, setBankBook] = useState(null);
  const [kycErr, setKycErr] = useState("");
  const [kycBusy, setKycBusy] = useState(false);

  const savePayee = async () => {
    setBusy(true);
    const bank = payee.accNo.trim() ? { bank: payee.bank, no: payee.accNo.trim(), name: payee.accName.trim() } : null;
    // ADMIN-UX2: บันทึกผ่าน API — ฝั่ง server ปิดวงจรแจ้งเตือนแอดมินเมื่อมีธงโอนไม่สำเร็จค้าง
    const res = await fetch("/api/kyc/payee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptpay: payee.promptpay.trim(), bank }) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setPayeeMsg(j.error || "บันทึกไม่สำเร็จ ลองใหม่"); setTimeout(() => setPayeeMsg(""), 3000); return; }
    setProfile(p => ({ ...p, promptpay: payee.promptpay.trim() || null, bank }));
    setPayeeMsg("บันทึกบัญชีรับเงินแล้ว ✓");
    setTimeout(() => setPayeeMsg(""), 2500);
  };

  const submitKyc = async () => {
    setKycErr("");
    if (!payee.promptpay.trim() && !payee.accNo.trim()) return setKycErr("กรอกบัญชีรับเงินก่อน (พร้อมเพย์หรือบัญชีธนาคาร)");
    if (!idCard || !bankBook) return setKycErr("แนบเอกสารให้ครบทั้ง 2 รายการ");
    setKycBusy(true);
    try {
      await savePayee();
      const up = async (f, tag) => {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${tag}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("kyc").upload(path, f);
        if (error) throw error;
        return path;
      };
      const idCardPath = await up(idCard, "idcard");
      const bankBookPath = await up(bankBook, "bankbook");
      const res = await fetch("/api/kyc/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCardPath, bankBookPath }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยื่นไม่สำเร็จ");
      setProfile(p => ({ ...p, kyc_status: "pending" }));
    } catch (e) { setKycErr(e.message || String(e)); }
    setKycBusy(false);
  };

  const card = { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };
  const btn = (bg, fg, solid = true) => ({ height: 38, padding: "0 16px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
    background: solid ? bg : "#fff", color: solid ? fg : bg, border: solid ? "none" : `1px solid ${C.line}` });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/profile" aria-label="กลับ" style={{ width: 40, height: 40, borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "grid", placeItems: "center", color: C.ink, textDecoration: "none", flex: "none", fontSize: 18 }}>‹</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>บัญชีรับเงิน & ยืนยันตัวตน</div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>บัญชีรับเงิน & ยืนยันตัวตน</div>
            {{
              verified: <span style={{ background: "#F0FDF4", color: "#1E8E3E", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>✓ KYC ผ่านแล้ว</span>,
              pending: <span style={{ background: "#FEF6E7", color: "#B7791F", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>🕐 รอตรวจสอบ</span>,
              rejected: <span style={{ background: "#FBEAE8", color: C.danger, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>✕ ไม่ผ่าน</span>,
              none: <span style={{ background: "#F1F3F4", color: C.muted, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>ยังไม่ยืนยันตัวตน</span>,
            }[profile.kyc_status || "none"]}
          </div>

          {profile.payout_failed_note && (
            <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontWeight: 700 }}>
              🔁 โอนเงินให้คุณไม่สำเร็จ: {profile.payout_failed_note} — กรุณาตรวจสอบ/แก้ไขบัญชีด้านล่างแล้วบันทึก
            </div>
          )}
          {profile.kyc_status === "rejected" && profile.kyc_reject_reason && (
            <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
              เอกสารไม่ผ่าน — เหตุผล: {profile.kyc_reject_reason} · แก้ไขแล้วยื่นใหม่ได้ด้านล่าง
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <input value={payee.promptpay} placeholder="พร้อมเพย์ (เบอร์/เลขบัตร)" onChange={e => setPayee({ ...payee, promptpay: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
              <select value={payee.bank} onChange={e => setPayee({ ...payee, bank: e.target.value })}
                style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 8px", fontSize: 13, background: "#fff" }}>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
              <input value={payee.accNo} placeholder="เลขบัญชี" onChange={e => setPayee({ ...payee, accNo: e.target.value })}
                style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            </div>
            <input value={payee.accName} placeholder="ชื่อบัญชี" onChange={e => setPayee({ ...payee, accName: e.target.value })}
              style={{ height: 42, border: `1.5px solid ${C.line}`, borderRadius: 9, padding: "0 12px", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={savePayee} disabled={busy} style={btn(C.brand, "#fff")}>บันทึกบัญชีรับเงิน</button>
              {payeeMsg && <span style={{ fontSize: 12.5, color: C.brand, fontWeight: 700 }}>{payeeMsg}</span>}
            </div>
          </div>

          {(profile.kyc_status === "none" || !profile.kyc_status || profile.kyc_status === "rejected") && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>ยื่นยืนยันตัวตน (KYC) — จำเป็นสำหรับผู้ขาย</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>เอกสารเก็บในพื้นที่ปลอดภัย เห็นได้เฉพาะคุณและแอดมิน (ตาม PDPA)</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>1) รูปบัตรประชาชน *</div>
              <input type="file" accept="image/*" onChange={e => setIdCard(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>2) รูปหน้าสมุดบัญชี *</div>
              <input type="file" accept="image/*" onChange={e => setBankBook(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              {kycErr && <div style={{ fontSize: 12.5, color: C.danger, background: "#FBEAE8", borderRadius: 8, padding: "8px 12px" }}>{kycErr}</div>}
              <button onClick={submitKyc} disabled={kycBusy}
                style={{ height: 44, border: "none", borderRadius: 9, background: "#B7791F", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: kycBusy ? .6 : 1 }}>
                {kycBusy ? "กำลังส่งเอกสาร..." : "🪪 ส่งเอกสารให้แอดมินตรวจ"}
              </button>
            </div>
          )}
          {profile.kyc_status === "pending" && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "#B7791F", background: "#FEF6E7", borderRadius: 8, padding: "8px 12px" }}>
              🕐 เอกสารอยู่ระหว่างตรวจสอบ (ภายใน 24 ชม.)
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

"use client";
// app/admin/ReportsPanel.js — POST3.2: คิวรายงาน (แท็บ ?tab=reports — ลิงก์จากแจ้งเตือน 🚩 เด้งมาที่นี่)
// ปุ่ม 3 ทาง: ปิดเคส / ลบเนื้อหา (สินค้า = ระงับ) / แบนผู้ใช้ — ทุก action ผ่าน modal มีเหตุผล (Iron Rule 3)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, ExternalLink } from "lucide-react";
import { productPath } from "@/lib/slug";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", bg: "#F6F5F2", danger: "#C24D42", banDk: "#7F1D1D" };
const TYPE_TH = { post: "โพสต์", comment: "คอมเมนต์", product: "สินค้า" };
const TYPE_STYLE = {
  post: { background: C.brandTint, color: C.brand },
  comment: { background: "#EDE9FE", color: "#6D28D9" },
  product: { background: "#FFEDD5", color: "#C2410C" },
};
const ago = ts => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "เมื่อครู่"; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
};

export default function ReportsPanel({ reports, onError }) {
  const router = useRouter();
  const [sub, setSub] = useState("open");
  const [modal, setModal] = useState(null); // { kind: 'dismiss'|'remove'|'ban', rep }
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const open = reports.filter(r => r.status === "open");
  const done = reports.filter(r => r.status !== "open");
  const list = sub === "open" ? open : done;

  const act = async () => {
    const { kind, rep } = modal;
    if (kind !== "dismiss" && !reason.trim()) { onError("กรุณาระบุเหตุผล"); return; }
    onError(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, reportId: rep.id, reason: reason.trim(), ownerId: rep.owner?.id || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "ทำรายการไม่สำเร็จ");
      setModal(null); setReason("");
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  const chip = on => ({ padding: "7px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${on ? C.brand : C.line}`, background: on ? C.brand : "#fff", color: on ? "#fff" : C.muted });
  const btn = (bg, fg = "#fff") => ({ border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: bg, color: fg, fontFamily: "inherit" });
  const card = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 16px rgba(0,0,0,.05)" };

  const TargetBox = ({ rep }) => {
    const t = rep.target;
    if (!t) return <div style={{ background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", marginTop: 10, fontSize: 12, color: C.muted }}>เนื้อหาถูกลบไปแล้ว</div>;
    return (
      <div style={{ background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", marginTop: 10, fontSize: 12.5, color: C.ink }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
          เนื้อหาที่ถูกรายงาน — {TYPE_TH[rep.target_type]}ของ <b style={{ color: C.ink }}>{rep.owner?.name || "ผู้ใช้"}</b>
          {rep.owner?.banned && <span style={{ marginLeft: 6, background: "#FBEAE8", color: "#B91C1C", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>ถูกแบนแล้ว</span>}
          {rep.target_type === "post" && t.status === "removed" && <span style={{ marginLeft: 6, background: "#FBEAE8", color: "#B91C1C", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>ลบแล้ว</span>}
          {rep.target_type === "product" && t.status === "suspended" && <span style={{ marginLeft: 6, background: "#FBEAE8", color: "#B91C1C", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>ระงับแล้ว</span>}
        </div>
        {rep.target_type === "product" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {t.images?.[0] && <img src={t.images[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flex: "none" }} />}
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 12.5 }}>{t.name} · ฿{Number(t.price || 0).toLocaleString()}</b>
              <div>
                <a href={productPath(t)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.brand, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  เปิดหน้าสินค้า <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>"{(t.text || "").slice(0, 400) || "(ไม่มีข้อความ — โพสต์รูปล้วน)"}"</div>
            {rep.target_type === "post" && t.images?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {t.images.slice(0, 4).map((u, i) => <img key={i} src={u} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />)}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><Flag size={20} color={C.danger} /> รายงาน</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>เนื้อหาที่ผู้ใช้รายงานเข้ามา — ตรวจแล้วเลือก ปิดเคส / ลบเนื้อหา / แบนผู้ใช้</div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={chip(sub === "open")} onClick={() => setSub("open")}>ค้างตรวจ ({open.length})</div>
        <div style={chip(sub === "done")} onClick={() => setSub("done")}>จัดการแล้ว ({done.length})</div>
      </div>

      {list.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, fontSize: 13, padding: "34px 14px" }}>{sub === "open" ? "ไม่มีรายงานค้าง — เคลียร์หมดแล้ว 🎉" : "ยังไม่มีเคสที่จัดการแล้ว"}</div>}

      {list.map(rep => (
        <div key={rep.id} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...TYPE_STYLE[rep.target_type], fontSize: 10.5, fontWeight: 800, padding: "2px 10px", borderRadius: 999 }}>{TYPE_TH[rep.target_type]}</span>
            <span style={{ fontSize: 11.5, color: C.muted }}>รายงานโดย <b style={{ color: C.ink }}>{rep.reporter}</b> · {ago(rep.created_at)}</span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 8, color: C.ink }}><b>เหตุผล:</b> {rep.reason}</div>
          {rep.detail && <div style={{ fontSize: 12, color: C.muted }}><b>รายละเอียด:</b> {rep.detail}</div>}
          <TargetBox rep={rep} />
          {sub === "open" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button style={btn(C.bg, C.ink)} onClick={() => { setReason(""); setModal({ kind: "dismiss", rep }); }}>✓ ปิดเคส (ไม่ผิดกติกา)</button>
              {rep.target && (
                <button style={btn(C.danger)} onClick={() => { setReason(""); setModal({ kind: "remove", rep }); }}>
                  {rep.target_type === "product" ? "⛔ ระงับสินค้า" : "🗑 ลบเนื้อหา"}
                </button>
              )}
              {rep.owner && !rep.owner.banned && (
                <button style={btn(C.banDk)} onClick={() => { setReason(""); setModal({ kind: "ban", rep }); }}>⛔ แบนผู้ใช้</button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: rep.status === "resolved" ? C.brand : C.muted, background: "#FAFAF8", border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 11px" }}>
              {rep.status === "resolved" ? "✓ จัดการแล้ว" : "✓ ปิดเคส (ไม่ผิดกติกา)"}{rep.resolution_note ? ` — ${rep.resolution_note}` : ""}
            </div>
          )}
        </div>
      ))}

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
            {modal.kind === "dismiss" && (<>
              <b style={{ fontSize: 15, color: C.ink }}>✓ ปิดเคสรายงานนี้</b>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>เนื้อหาไม่ผิดกติกา — เคสย้ายไป "จัดการแล้ว" เนื้อหายังแสดงตามปกติ</div>
            </>)}
            {modal.kind === "remove" && (<>
              <b style={{ fontSize: 15, color: C.ink }}>{modal.rep.target_type === "product" ? "⛔ ระงับสินค้านี้" : "🗑 ลบเนื้อหานี้"}</b>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>
                {modal.rep.target_type === "product"
                  ? "สินค้าหายจากตลาด (สถานะ suspended) — ผู้ขายเห็นป้าย \"ถูกระงับโดยแอดมิน\" และได้รับแจ้งเตือนพร้อมเหตุผล"
                  : "เนื้อหาหายจากฟีดทันที ระบบเก็บหลักฐานไว้ — เจ้าของได้รับแจ้งเตือนพร้อมเหตุผล · เคสปิดอัตโนมัติ"}
              </div>
            </>)}
            {modal.kind === "ban" && (<>
              <b style={{ fontSize: 15, color: C.ink }}>⛔ แบนผู้ใช้ "{modal.rep.owner?.name}"</b>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.8 }}>
                • โพสต์ / คอมเมนต์ / รายงาน ไม่ได้ทั้งหมด<br />
                • ยังล็อกอินดูออเดอร์เดิมได้ (ของค้างส่ง-ค้างรับต้องจบให้ครบ)<br />
                • เคสรายงานนี้ยังเปิดอยู่ — ตัดสินตัวเนื้อหาแยกอีกที
              </div>
            </>)}
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
              placeholder={modal.kind === "dismiss" ? "บันทึกภายใน (ไม่บังคับ — ผู้ใช้ไม่เห็น)" : modal.kind === "ban" ? "เหตุผลการแบน (บังคับ — บันทึกในระบบ + แจ้งผู้ใช้)" : "เหตุผล (บังคับ — ส่งถึงเจ้าของเนื้อหา)"}
              style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", fontSize: 13, marginTop: 12, resize: "vertical", minHeight: 64, outline: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button disabled={busy} style={{ ...btn(C.bg, C.ink), flex: 1 }} onClick={() => setModal(null)}>ยกเลิก</button>
              <button disabled={busy} style={{ ...btn(modal.kind === "ban" ? C.banDk : modal.kind === "remove" ? C.danger : C.brand), flex: 1, opacity: busy ? 0.7 : 1 }} onClick={act}>
                {busy ? "กำลังทำรายการ..." : modal.kind === "dismiss" ? "ปิดเคส" : modal.kind === "ban" ? "แบนผู้ใช้" : modal.rep.target_type === "product" ? "ระงับสินค้า" : "ลบเนื้อหา"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

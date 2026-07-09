"use client";
// app/admin/PostsPanel.js — POST3.3: จัดการโพสต์ (แท็บ ?tab=posts)
// สไตล์เดียวกับหน้าจัดการสินค้า: ชิปสถานะ+ตัวเลข · ค้นหา+เรียง · แถวกระชับ กดกางดูโพสต์ฉบับเต็ม
// ปุ่มตามสถานะ: pending → อนุมัติ/ไม่อนุมัติ · visible → ลบ · removed → กู้คืน (soft delete — Iron Rule 25)
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", bg: "#F6F5F2", danger: "#C24D42", ok: "#0E7E5C", amber: "#B45309", amberBg: "#FEF3C7" };
const STATUS_TH = { pending: "⏳ รออนุมัติ", visible: "แสดงอยู่", removed: "ถูกลบ" };
const STATUS_STYLE = {
  pending: { background: C.amberBg, color: C.amber },
  visible: { background: C.brandTint, color: C.brand },
  removed: { background: "#FBEAE8", color: "#B91C1C" },
};
const ago = ts => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "เมื่อครู่"; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
};

export default function PostsPanel({ posts, onError }) {
  const router = useRouter();
  const [chip, setChip] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null); // { kind: 'reject'|'remove', post }
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => ({
    all: posts.length,
    pending: posts.filter(p => p.status === "pending").length,
    visible: posts.filter(p => p.status === "visible").length,
    removed: posts.filter(p => p.status === "removed").length,
  }), [posts]);

  const list = useMemo(() => {
    let l = posts;
    if (chip !== "all") l = l.filter(p => p.status === chip);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter(p => `${p.text || ""} ${p.authorName || ""}`.toLowerCase().includes(s));
    l = [...l].sort((a, b) => sort === "old"
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at));
    return l;
  }, [posts, chip, q, sort]);

  const act = async (action, post, r) => {
    onError(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId: post.id, reason: r || "" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "ทำรายการไม่สำเร็จ");
      setModal(null); setReason("");
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  const chipS = on => ({ padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${on ? C.ink : C.line}`, background: on ? C.ink : "#fff", color: on ? "#fff" : C.ink });
  const btnS = (bg, fg = "#fff", border = "transparent") => ({ borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flex: "none", border: `1.5px solid ${border}`, background: bg, color: fg, fontFamily: "inherit" });

  const CHIPS = [["all", "ทั้งหมด"], ["pending", "⏳ รออนุมัติ"], ["visible", "แสดงอยู่"], ["removed", "ถูกลบ"]];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><FileText size={20} color={C.brand} /> จัดการโพสต์</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>คิวอนุมัติ + ค้นหา/ลบโพสต์ทั้งระบบ — ลบ = เก็บหลักฐาน กู้คืนได้ · กดแถวเพื่อดูโพสต์ฉบับเต็ม</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CHIPS.map(([k, label]) => (
          <div key={k} style={chipS(chip === k)} onClick={() => setChip(k)}>{label} <span style={{ opacity: .7, fontWeight: 600 }}>({counts[k]})</span></div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาข้อความในโพสต์ / ชื่อผู้โพสต์..."
          style={{ flex: 1, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", minWidth: 0 }} />
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", fontSize: 12.5, fontFamily: "inherit", color: C.ink, background: "#fff" }}>
          <option value="new">ล่าสุด</option>
          <option value="old">เก่าสุด / รอนานสุด</option>
        </select>
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "36px 14px", border: `1px solid ${C.line}`, borderRadius: 13 }}>
          {chip === "pending" ? "ไม่มีโพสต์รออนุมัติ — เคลียร์หมดแล้ว 🎉" : "ไม่พบโพสต์"}
        </div>
      )}

      {list.map(p => {
        const expanded = openId === p.id;
        return (
          <div key={p.id}>
            <div onClick={() => setOpenId(expanded ? null : p.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${C.line}`,
                borderRadius: expanded ? "13px 13px 0 0" : 13, cursor: "pointer", background: expanded ? "#FAFAF8" : "#fff", opacity: p.status === "removed" ? .85 : 1 }}>
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flex: "none" }}>
                {(p.authorName || "?").charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13, color: C.ink }}>{p.authorName || "ผู้ใช้"}</b>
                <span style={{ fontSize: 11, color: C.muted }}> · {ago(p.created_at)}{p.is_announcement ? " · 📢 ประกาศ" : ""}{p.productName ? " · 🏷 แนบสินค้า" : ""}</span>
                <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: p.status === "removed" ? "line-through" : "none" }}>
                  {(p.text || "").slice(0, 120) || "(โพสต์รูปล้วน)"}
                </div>
              </div>
              <span style={{ ...STATUS_STYLE[p.status], fontSize: 10.5, fontWeight: 800, padding: "3px 11px", borderRadius: 999, flex: "none" }}>{STATUS_TH[p.status]}</span>
              {p.status === "pending" && (<>
                <button disabled={busy} style={btnS(C.ok)} onClick={e => { e.stopPropagation(); act("approve", p); }}>✅ อนุมัติ</button>
                <button disabled={busy} style={btnS("#fff", C.danger, C.danger)} onClick={e => { e.stopPropagation(); setReason(""); setModal({ kind: "reject", post: p }); }}>ไม่อนุมัติ</button>
              </>)}
              {p.status === "visible" && (
                <button disabled={busy} style={btnS("#fff", C.danger, C.danger)} onClick={e => { e.stopPropagation(); setReason(""); setModal({ kind: "remove", post: p }); }}>🗑 ลบ</button>
              )}
              {p.status === "removed" && (
                <button disabled={busy} style={btnS("#fff", C.brand, C.brand)} onClick={e => { e.stopPropagation(); act("restore", p); }}>↩️ กู้คืน</button>
              )}
            </div>
            {expanded && (
              <div style={{ border: `1px solid ${C.line}`, borderTop: "none", borderRadius: "0 0 13px 13px", padding: 14, background: "#FAFAF8" }}>
                <div style={{ fontSize: 13, color: p.status === "removed" ? C.muted : C.ink, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: p.status === "removed" ? "line-through" : "none" }}>
                  {p.text || "(ไม่มีข้อความ)"}
                </div>
                {(p.images?.length > 0) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {p.images.map((u, i) => <img key={i} src={u} alt="" style={{ width: 90, height: 90, borderRadius: 9, objectFit: "cover" }} />)}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>
                  {p.productName ? `แนบสินค้า: ${p.productName} · ` : ""}ประเภท: {p.is_announcement ? "ประกาศ" : "โพสต์ทั่วไป"} · โพสต์เมื่อ {new Date(p.created_at).toLocaleString("th-TH")}
                </div>
                {p.status === "removed" && (
                  <div style={{ fontSize: 11.5, color: C.danger, marginTop: 6 }}>
                    ลบโดย {p.removerName || "แอดมิน"} · {p.removed_at ? new Date(p.removed_at).toLocaleString("th-TH") : "-"} · เหตุผล: {p.removed_reason || "-"}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
            <b style={{ fontSize: 15, color: C.ink }}>
              {modal.kind === "reject" ? `❌ ไม่อนุมัติโพสต์ของ ${modal.post.authorName || "ผู้ใช้"}` : `🗑 ลบโพสต์ของ ${modal.post.authorName || "ผู้ใช้"}`}
            </b>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>
              {modal.kind === "reject"
                ? "โพสต์ย้ายไปสถานะ \"ถูกลบ\" (เก็บหลักฐาน กู้คืนได้) — เจ้าของได้รับแจ้งเตือนพร้อมเหตุผล"
                : "หายจากฟีดทันที เก็บหลักฐานไว้ (กู้คืนได้จากแท็บ \"ถูกลบ\") — เจ้าของได้รับแจ้งเตือนพร้อมเหตุผล"}
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
              placeholder="เหตุผล (บังคับ — ส่งถึงเจ้าของโพสต์)"
              style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 12px", fontSize: 13, marginTop: 12, resize: "vertical", minHeight: 64, outline: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button disabled={busy} style={{ ...btnS(C.bg, C.ink), flex: 1 }} onClick={() => setModal(null)}>ยกเลิก</button>
              <button disabled={busy} style={{ ...btnS(C.danger), flex: 1, opacity: busy ? .7 : 1 }}
                onClick={() => { if (!reason.trim()) { onError("กรุณาระบุเหตุผล"); return; } act(modal.kind, modal.post, reason.trim()); }}>
                {busy ? "กำลังทำรายการ..." : modal.kind === "reject" ? "ไม่อนุมัติ" : "ลบโพสต์"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
// components/NotiBell.js — ระฆัง + จุดแดงนับเลข + รายการแจ้งเตือน + mark read
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const C = { brand: "#0E7E8C", ink: "#101314", muted: "#6B7678", line: "#E5E9EA", danger: "#C0392B" };

export default function NotiBell({ userId }) {
  const supabase = createClient();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const unread = items.filter(n => !n.read).length;

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*")
      .eq("to_user", userId).order("created_at", { ascending: false }).limit(30);
    setItems(data || []);
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);   // eslint-disable-line
  useEffect(() => {
    const close = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("to_user", userId).eq("read", false);
    setItems(p => p.map(n => ({ ...n, read: true })));
  };

  const ago = t => {
    const s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 60) return "เมื่อครู่";
    if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
    return new Date(t).toLocaleDateString("th-TH");
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(o => !o); if (!open && unread) markAllRead(); }}
        style={{ position: "relative", width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 17 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999, background: C.danger, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 320, maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.15)", border: `1px solid ${C.line}`, zIndex: 40 }}>
          <div style={{ padding: "10px 14px", fontWeight: 800, fontSize: 13, color: C.ink, borderBottom: `1px solid ${C.line}` }}>การแจ้งเตือน</div>
          {items.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: C.muted, textAlign: "center" }}>ยังไม่มีการแจ้งเตือน</div>}
          {items.map(n => (
            <div key={n.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, background: n.read ? "#fff" : "#F0F9FA" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>{n.icon} {n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{n.body}</div>}
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{n.ref ? `${n.ref} · ` : ""}{ago(n.created_at)}</div>
            </div>
          ))}
          {/* W5.7d: ทางเข้าหน้ารวมการแจ้งเตือน */}
          <Link href="/notifications" onClick={() => setOpen(false)}
            style={{ display: "block", padding: "11px 14px", textAlign: "center", fontSize: 12.5, fontWeight: 800, color: C.brand, textDecoration: "none", background: "#fff" }}>
            ดูการแจ้งเตือนทั้งหมด →
          </Link>
        </div>
      )}
    </div>
  );
}

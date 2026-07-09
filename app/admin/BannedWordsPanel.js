"use client";
// app/admin/BannedWordsPanel.js — AUTO1: แผงคลังคำต้องห้าม (แท็บ ?tab=words)
// เพิ่ม/แก้ไข/ลบคำได้สด มีผลกับโพสต์-คอมเมนต์-ลงขายทันที ไม่ต้อง deploy
// หมายเหตุที่โชว์ในหัวแผง: กฎเบอร์โทร/ไลน์เป็น regex อยู่ในโค้ด (แก้ผ่าน Claude) — แผงนี้คุมเฉพาะ "คำ"
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const C = { brand: "#0E7E8C", brandTint: "#E7F2F3", ink: "#17181A", muted: "#80868D", line: "#E4E2DC", bg: "#F6F5F2", danger: "#C24D42", ok: "#0E7E5C" };

export default function BannedWordsPanel({ words, onError }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [newWord, setNewWord] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editId, setEditId] = useState(null);   // แถวที่กำลังแก้ไข inline
  const [editWord, setEditWord] = useState("");
  const [editNote, setEditNote] = useState("");
  const [delTarget, setDelTarget] = useState(null); // modal ยืนยันลบ
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? words.filter(w => `${w.word} ${w.note || ""}`.toLowerCase().includes(s)) : words;
  }, [words, q]);

  const call = async (payload, after) => {
    onError(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/banned-words", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "ทำรายการไม่สำเร็จ");
      after?.();
      router.refresh();
    } catch (e) { onError(e.message); }
    setBusy(false);
  };

  const inputS = { border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const btnS = (bg, fg = "#fff", border = "transparent") => ({ borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flex: "none", border: `1.5px solid ${border}`, background: bg, color: fg, fontFamily: "inherit" });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><ShieldAlert size={20} color={C.danger} /> คำต้องห้าม</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
          โพสต์/คอมเมนต์/ลงขายที่มีคำเหล่านี้จะถูกบล็อกทันที (จับแบบแทรกช่องว่าง-จุด-ดอกจันด้วย) · มีผลทันทีไม่ต้อง deploy<br />
          ส่วนกฎ<b>เบอร์โทร + LINE</b> เป็นกฎอัตโนมัติแยกต่างหากในระบบ — ทำงานอยู่ตลอดไม่ต้องเพิ่มในนี้
        </div>
      </div>

      {/* ฟอร์มเพิ่มคำใหม่ */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 16px rgba(0,0,0,.05)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="คำที่ต้องการแบน (2-50 ตัวอักษร)"
          style={{ ...inputS, flex: "1 1 180px" }} />
        <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ เช่น ทำไมแบน)"
          style={{ ...inputS, flex: "2 1 220px" }} />
        <button disabled={busy || !newWord.trim()}
          style={{ ...btnS(C.brand), opacity: busy || !newWord.trim() ? .6 : 1 }}
          onClick={() => call({ action: "add", word: newWord.trim(), note: newNote.trim() }, () => { setNewWord(""); setNewNote(""); })}>
          ＋ เพิ่มคำ
        </button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={`ค้นหาในคลัง (${words.length} คำ)...`}
        style={{ ...inputS, width: "100%" }} />

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 4px 16px rgba(0,0,0,.05)", overflow: "hidden" }}>
        {list.length === 0 && <div style={{ padding: 26, fontSize: 12.5, color: C.muted, textAlign: "center" }}>{words.length === 0 ? "ยังไม่มีคำในคลัง — เพิ่มคำแรกได้เลย" : "ไม่พบคำที่ค้นหา"}</div>}
        {list.map((w, i) => (
          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            {editId === w.id ? (
              <>
                <input value={editWord} onChange={e => setEditWord(e.target.value)} style={{ ...inputS, flex: "1 1 140px" }} />
                <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="หมายเหตุ" style={{ ...inputS, flex: "2 1 180px" }} />
                <button disabled={busy} style={btnS(C.ok)}
                  onClick={() => call({ action: "update", id: w.id, word: editWord.trim(), note: editNote.trim() }, () => setEditId(null))}>บันทึก</button>
                <button disabled={busy} style={btnS(C.bg, C.ink)} onClick={() => setEditId(null)}>ยกเลิก</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, color: C.ink }}>{w.word}</b>
                  <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.note || "—"} · เพิ่มเมื่อ {w.created_at ? new Date(w.created_at).toLocaleDateString("th-TH") : "-"}
                  </div>
                </div>
                <button disabled={busy} style={btnS("#fff", C.brand, C.brand)}
                  onClick={() => { setEditId(w.id); setEditWord(w.word); setEditNote(w.note || ""); }}>แก้ไข</button>
                <button disabled={busy} style={btnS("#fff", C.danger, C.danger)} onClick={() => setDelTarget(w)}>ลบ</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* modal ยืนยันลบ */}
      {delTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) setDelTarget(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 90 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380 }}>
            <b style={{ fontSize: 15, color: C.ink }}>ลบคำว่า "{delTarget.word}" ออกจากคลัง?</b>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>โพสต์ใหม่ที่มีคำนี้จะไม่ถูกบล็อกอีก (โพสต์เก่าไม่ได้รับผลกระทบ)</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button disabled={busy} style={{ ...btnS(C.bg, C.ink), flex: 1 }} onClick={() => setDelTarget(null)}>ยกเลิก</button>
              <button disabled={busy} style={{ ...btnS(C.danger), flex: 1 }}
                onClick={() => call({ action: "remove", id: delTarget.id }, () => setDelTarget(null))}>ลบคำนี้</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

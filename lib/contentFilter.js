// lib/contentFilter.js — AUTO1: ตัวกรองเนื้อหากลาง (ใช้ฝั่ง server เท่านั้น — ผ่าน API)
//
// ปรัชญาการออกแบบ (สรุปจากที่วิเคราะห์กับภีม 9 ก.ค. 69):
//   1. กฎแบบ "แพทเทิร์น" (เบอร์โทร/ไลน์) อยู่ในไฟล์นี้ — เป็น regex ที่ต้องมีชุดทดสอบประกบ
//      (scripts/testContentFilter.mjs) แก้ทีต้อง deploy แต่แทบไม่ต้องแก้เลย
//   2. กฎแบบ "คำ" (คำหยาบ/คำโกง) อยู่ในตาราง banned_words — แอดมินเพิ่ม/ลบ/แก้สดในหลังบ้าน
//   3. ตลาดตกปลาเลขเยอะมาก (42g, 140mm, PE 0.8, ราคา 500, รุ่น 4000) — ทุก regex
//      ต้องผ่านเทสว่า "ข้อความขายของปกติต้องรอด" ก่อนขึ้นจริงเสมอ
//
// การตัดสินใจสำคัญเรื่องคำว่า LINE (จดไว้กันงงในอนาคต):
//   - คำไทย "ไลน์" → บล็อกทุกกรณี เพราะคนไทยพูดถึงสายเอ็นว่า "สาย" ไม่ใช่ "ไลน์"
//     คำว่า ไลน์/แอดไลน์/ทักไลน์ ในตลาดซื้อขาย = ชวนคุยนอกระบบแทบ 100%
//   - คำอังกฤษ "line" เดี่ยวๆ → ปล่อยผ่าน เพราะเป็นศัพท์ตกปลา (PE line, main line,
//     fishing line) จะบล็อกก็ต่อเมื่อมีหลักฐานว่าเป็น ID เช่น "line: xxx", "line id xxx",
//     "id line", หรือลิงก์ line.me เท่านั้น

// ═══ การตัดสินใจ 9 ก.ค. 69 (ภีมเคาะ): ปิดกฎเบอร์โทร+LINE — เหลือเฉพาะคลังคำต้องห้าม ═══
// เหตุผลฝั่งธุรกิจ: ช่วงเปิดตัวให้ผู้ใช้คุยกันสะดวกก่อน
// สูตร regex + ชุดทดสอบเก็บไว้ครบ — อยากเปิดกลับ: เปลี่ยนเป็น true → รัน node scripts/testContentFilter.mjs → deploy
export const PATTERN_RULES_ENABLED = false;

// ── รูปแบบที่ 1: เบอร์มือถือไทย ─────────────────────────────────────────────
// โครงสร้าง: ขึ้นต้น 06 / 08 / 09 แล้วตามด้วยเลขอีก 8 ตัว (รวม 10 หลัก)
// ยอมให้มีตัวคั่น (ช่องว่าง จุด ขีด) แทรกระหว่างหลักได้ไม่เกิน 2 ตัวต่อจุด
//   → จับได้ทั้ง 0812345678 / 081-234-5678 / 081 234 5678 / 081.234.5678
// การ์ดสองข้าง (?<![0-9]) และ (?![0-9]) = ต้องไม่มีเลขติดหน้า-หลัง
//   → เลขที่ยาวกว่า 10 หลัก (เลขพัสดุ/บาร์โค้ด) หรือเลขที่ 06 ไปโผล่กลางตัวเลขอื่น จะไม่โดน
// ผลพลอยได้: เลขบัญชีธนาคาร 10 หลักที่บังเอิญขึ้นต้น 06/08/09 ก็โดนด้วย —
//   ถือเป็นเรื่องดี เพราะการแปะเลขบัญชีในโพสต์ = ชวนโอนตรงหนี escrow เหมือนกัน
const PHONE_RE = /(?<![0-9])0[689](?:[\s.\-]{0,2}[0-9]){8}(?![0-9])/;

// ── รูปแบบที่ 2: ช่องทาง LINE ──────────────────────────────────────────────
const LINE_PATTERNS = [
  // ลิงก์ line.me ทุกแบบ (line.me/ti/p/..., lin.ee ตัวย่อทางการ)
  { re: /(?:line\.me|lin\.ee)\/\S*/i, label: "ลิงก์ LINE" },
  // คำไทย "ไลน์" — บล็อกทุกกรณี (เหตุผลดูหัวไฟล์)
  { re: /ไลน์/, label: "คำว่า ไลน์" },
  // อังกฤษ: ต้องมีหลักฐานเป็น ID ชัดๆ — "line" ต้องไม่ใช่ส่วนของคำอื่น (online, deadline)
  // และต้องตามด้วย : = @ หรือคำว่า id แล้วมีรหัสต่อท้าย
  { re: /(?<![a-z0-9])line\s*(?:id)?\s*[:=@]\s*\S+/i, label: "LINE ID" },
  { re: /(?<![a-z0-9])line\s+id\s+\S+/i, label: "LINE ID" },
  { re: /(?<![a-z0-9])id\s*[:=]?\s*line(?![a-z])/i, label: "LINE ID" },
];

// เคสที่ regex ล้วนจับไม่ได้ (บั๊กที่เจอจริง 9 ก.ค.: "ขอLine ที" หลุด):
// คำอังกฤษ "line" ที่ปนอยู่ใน "ประโยคไทย" — ไม่มีทางหมายถึงสายเอ็น (คนไทยเรียก "สาย")
// กติกา: เจอคำ line (มีขอบเขตคำ ไม่ใช่ online/deadline) แล้วมีอักษรไทยภายใน 12 ตัวอักษรรอบๆ → บล็อก
// ประโยคอังกฤษล้วน "main line 30lb", "PE line 0.8" → ไม่มีไทยข้างๆ → รอดเหมือนเดิม
const THAI_CHAR_RE = /[\u0E00-\u0E7F]/;
// ข้อยกเว้นศัพท์ตกปลา: "line" ที่มีคำขยายสายนำหน้า = พูดถึงสายเอ็น ไม่ใช่แอปแชท
// (เคสจริงที่ต้องรอด: "main line 30lb ใช้ fishing line ของ Varivas" — ไทยปนอังกฤษแต่คุยเรื่องสาย)
const FISHING_QUALIFIER_RE = /(?:main|fishing|braided|pe|fly|leader|shock|casting|spinning|mono)\s*$/i;
function lineNearThai(text) {
  const re = /(?<![a-z0-9])line(?![a-z0-9])/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    const after = text.slice(m.index + 4, m.index + 4 + 12);
    if (FISHING_QUALIFIER_RE.test(before)) continue; // มีคำขยายสายนำหน้า = สายเอ็น ข้ามตัวนี้
    if (THAI_CHAR_RE.test(before) || THAI_CHAR_RE.test(after)) return m[0];
  }
  return null;
}

// ── ตัวช่วย normalize สำหรับเช็คคลังคำ ─────────────────────────────────────
// เป้าหมาย: จับการหลบเลี่ยงด้วยการแทรกอักขระ เช่น "เ หี้ ย", "ค.ว.ย", "ส*ั*ส"
// วิธี: แปลงพิมพ์เล็ก แล้ว "บีบ" อักขระคั่น (ช่องว่าง จุด ขีด ขีดล่าง ดอกจัน) ทิ้ง
// ข้อควรระวัง: การบีบทำให้คำสองคำที่อยู่ติดกันเชื่อมกันได้ — คำต้องห้ามที่สั้นมาก
// (1-2 ตัวอักษร) จึงเสี่ยง false positive สูง → API ฝั่งเพิ่มคำบังคับขั้นต่ำ 2 ตัวอักษร
// และแอดมินลบคำที่สร้างปัญหาออกจากหลังบ้านได้ทันที (จุดแข็งของการเก็บใน DB)
export function normalizeForWordCheck(text) {
  return String(text || "").toLowerCase().replace(/[\s.\-_*·]+/g, "");
}

// ── ฟังก์ชันหลัก ────────────────────────────────────────────────────────────
// checkContent(text, bannedWords) → { ok, hits: [{ type, label, match }] }
//   type: 'phone' | 'line' | 'word'
// เช็คทั้ง 3 ชั้นแล้วรวมผล — เจอหลายอย่างรายงานครบ ผู้ใช้จะได้แก้ทีเดียวจบ
export function checkContent(text, bannedWords = []) {
  const t = String(text || "");
  const hits = [];

  // ชั้น 1+2: เบอร์โทร / LINE — ปิดอยู่ตามการตัดสินใจ 9 ก.ค. 69 (ดู PATTERN_RULES_ENABLED หัวไฟล์)
  if (PATTERN_RULES_ENABLED) {
    const phone = t.match(PHONE_RE);
    if (phone) hits.push({ type: "phone", label: "เบอร์โทรศัพท์", match: phone[0].trim() });

    for (const p of LINE_PATTERNS) {
      const m = t.match(p.re);
      if (m) { hits.push({ type: "line", label: p.label, match: m[0].trim().slice(0, 40) }); break; }
    }
    if (!hits.some(h => h.type === "line")) {
      const nearThai = lineNearThai(t);
      if (nearThai) hits.push({ type: "line", label: "คำว่า Line ในประโยคไทย", match: nearThai });
    }
  }

  // ชั้น 3: คลังคำต้องห้าม (จาก DB) — เทียบบนข้อความที่ normalize แล้วทั้งสองฝั่ง
  const norm = normalizeForWordCheck(t);
  for (const w of bannedWords) {
    const nw = normalizeForWordCheck(w);
    if (nw && nw.length >= 2 && norm.includes(nw)) hits.push({ type: "word", label: "คำไม่เหมาะสม", match: w });
  }

  return { ok: hits.length === 0, hits };
}

// สร้างข้อความแจ้งผู้ใช้ — บอกชัดว่าติดอะไร (แนว Shopee) จะได้แก้ถูกจุด
// จงใจ "ไม่" โชว์คำต้องห้ามที่จับได้ครบทุกคำ (โชว์แค่ 3) กันคนไล่สแกนหาขอบเขตลิสต์
export function filterMessage(hits) {
  const parts = [];
  if (hits.some(h => h.type === "phone"))
    parts.push("พบเบอร์โทรศัพท์ — ห้ามระบุช่องทางติดต่อนอกระบบ");
  if (hits.some(h => h.type === "line"))
    parts.push("พบการอ้างถึง LINE — ห้ามชวนคุยนอกระบบ");
  const words = hits.filter(h => h.type === "word").map(h => `"${h.match}"`).slice(0, 3);
  if (words.length) parts.push(`พบคำไม่เหมาะสม: ${words.join(", ")}`);
  return `เนื้อหาไม่ผ่านการตรวจ: ${parts.join(" · ")} · กรุณาแก้ไขแล้วลองใหม่ — เพื่อความปลอดภัยของทั้งสองฝ่าย ซื้อขายผ่านระบบ ClubAngler เท่านั้น`;
}

// app/api/ai/draft-listing/route.js — AI1: AI ช่วยกรอกประกาศจากรูปสินค้า
// แพทเทิร์นเดียวกับ save/route.js: auth ฝั่ง server + เช็คแบน · เรียก Anthropic API ด้วย service key
// กติกา: AI ห้ามแตะ สภาพ/เกรด/ตำหนิ (ผู้ขายกำหนดเอง — เป็นคำประกาศความรับผิดใน escrow)
//        cat_path ต้อง resolve ผ่าน catNodeAt จริง ไม่ผ่าน = ตัดทิ้ง ให้ผู้ขายเลือกเอง
// ต้องมีใน .env.local:  ANTHROPIC_API_KEY=sk-ant-...
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_TREE, ALL_BRANDS, catNodeAt } from "@/lib/catalog";

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

const MODEL = process.env.AI_DRAFT_MODEL || "claude-sonnet-4-6"; // สลับโมเดลผ่าน .env ได้ เช่น AI_DRAFT_MODEL=claude-haiku-4-5-20251001 (ถูกกว่า ~3 เท่าแต่อ่านรูปพลาดง่าย)
const MAX_IMAGES = 5;
const MAX_B64_LEN = 6_000_000; // ~4.5MB ต่อรูป (base64 พองราว 1.33 เท่า)

// ── แปลง CATEGORY_TREE เป็นข้อความสำหรับ prompt (สร้างครั้งเดียวตอน module โหลด) ──
function treeToText(node, path = []) {
  const lines = [];
  if (Array.isArray(node)) {
    lines.push(path.join(" > ") + " > [" + node.join(", ") + "]");
  } else if (node && typeof node === "object") {
    const leaves = [];
    for (const [k, v] of Object.entries(node)) {
      if (v === null) leaves.push(k);
      else lines.push(...treeToText(v, [...path, k]));
    }
    if (leaves.length) lines.push(path.join(" > ") + " > [" + leaves.join(", ") + "]");
  }
  return lines;
}
const CATALOG_TEXT = treeToText(CATEGORY_TREE).join("\n");

const PROMPT = `คุณคือผู้ช่วยกรอกฟอร์มลงขายสินค้าตกปลามือสองของ ClubAngler วิเคราะห์รูปสินค้าทุกรูปที่แนบมา (สินค้าชิ้นเดียวกัน ถ่ายหลายมุม) แล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นหรือ markdown

ขั้นตอนวิเคราะห์ (ทำตามลำดับเคร่งครัด):
ขั้น 1 — ระบุประเภทสินค้าจาก "รูปทรงของวัตถุ" เท่านั้น ห้ามใช้ตัวหนังสือตัดสิน: เหยื่อปลอม = วัตถุทรงปลา/กุ้ง/แมลง มักมีตะขอ · รอก = มีสปูลและมือหมุน · คันเบ็ด = แท่งยาวมีไกด์ · เบ็ด = ตะขอเปล่า
ขั้น 2 — ค่อยอ่านตัวหนังสือในรูปเพื่อหา แบรนด์/รุ่น/สเปก
คำเตือน: ชื่อรุ่นและตัวเลขบนสินค้าหลอกได้ เช่น "100-215" บนเหยื่อปลอมคือรหัสรุ่น (ความยาว มม. + น้ำหนัก) ไม่ใช่ความยาวคัน 2.15 ม. — ประเภทสินค้าต้องมาจากรูปทรงในขั้น 1 เสมอ ห้ามเปลี่ยนตามตัวหนังสือ

หมวดหมู่ในระบบ (เลือกจากนี้เท่านั้น, path คั่นด้วย >):
${CATALOG_TEXT}

แบรนด์ในระบบ: ${ALL_BRANDS.join(", ")}

สเปกที่ต้องพยายามกรอก (ใส่ใน "specs" เป็น key-value ภาษาไทย เฉพาะที่รู้จริง):
- รอกตกปลา: ประเทศแบรนด์, อัตราทด, จุสาย, กำลังเบรกสูงสุด (kg), มือหมุน (ซ้าย/ขวา/สลับได้), น้ำหนัก (กรัม), จำนวนลูกปืน
- คันเบ็ด: ประเทศแบรนด์, ประเภทการใช้งาน (เช่น ป็อปปิ้ง/จิ๊กกิ้งทั่วไป/จิ๊กกิ้งน้ำลึก/ไลท์จิ๊ก/ตีเหยื่อ), ความยาว, จำนวนท่อน, เรทสาย (PE/lb), เรทเหยื่อหรือจิ๊กสูงสุด (กรัม), แอคชั่น
- เหยื่อปลอม: ประเภทเหยื่อ, ความยาว (มม.), น้ำหนัก (กรัม), ระบบ (ลอย/จม/ซัสเพนด์), เบอร์ตะขอ
- เบ็ด/ปลายสาย: ประเภทเบ็ด (หัวจิ๊ก/Assist Hook/สามทาง/เดี่ยว), เบอร์, วัสดุ
- หมวดอื่น: สเปกเด่นที่เห็นได้จากรูป

กติกาเหล็ก:
1. สเปกกรอกได้ 2 ทาง: (ก) อ่านจากตัวหนังสือในรูปจริง เช่น บนแบลงค์คัน/สปูลรอก/แพ็กเกจ (ข) มั่นใจสูงมากว่าระบุรุ่นถูกและจำสเปกโรงงานได้แม่น — ระบุที่มาใน "spec_source" ต่อ key: "รูป" หรือ "ความรู้รุ่น"
2. ไม่มั่นใจ = ไม่กรอก key นั้น ห้ามเดา สเปกผิดแย่กว่าเว้นว่าง — ห้ามใส่ค่า "ไม่ทราบ" "ไม่ระบุ" "N/A" หรือคำทำนองนี้เด็ดขาด ไม่รู้ = ตัด key ทิ้งทั้งคู่
2.1 cat_path พยายามระบุเสมอ ถ้ามั่นใจแค่หมวดหลักให้ส่ง path สั้นแค่ระดับที่มั่นใจ เช่น ["เหยื่อปลอม"] ดีกว่า null
3. แบรนด์ต้องเห็นโลโก้/ตัวอักษรในรูป ไม่เห็น = null
4. ห้ามประเมินสภาพ/เกรด/ตำหนิ — ผู้ขายกำหนดเอง
5. title เขียนแบบประกาศขายไทย กระชับ มีแบรนด์+รุ่น(ถ้ารู้)+สเปกเด่น 1 อย่าง
6. description 2-4 ประโยค เฉพาะข้อเท็จจริง ห้ามพูดถึงความใหม่เก่า

ตอบ JSON โครงนี้:
{"title": string|null, "cat_path": string[]|null, "brand": string|null, "brand_country": string|null, "model": string|null, "specs": {"ชื่อสเปก": "ค่า"}, "spec_source": {"ชื่อสเปก": "รูป"|"ความรู้รุ่น"}, "description": string|null, "confidence": 0-100, "note": string|null}`;

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("กรุณาเข้าสู่ระบบ", 401);

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles")
    .select("banned_at").eq("id", user.id).single();
  if (prof?.banned_at) return bad("บัญชีของคุณถูกระงับการใช้งาน", 403);

  // AI2: ความรู้เสริมจากแอดมิน (แท็บตั้งค่า) — ต่อท้าย prompt ทุกครั้ง มีผลทันทีไม่ต้อง deploy
  const { data: cfg } = await admin.from("platform_config").select("ai_notes").single();
  const aiNotes = String(cfg?.ai_notes || "").trim();

  if (!process.env.ANTHROPIC_API_KEY) return bad("ระบบ AI ยังไม่พร้อมใช้งาน", 503);

  const body = await req.json();
  const images = (Array.isArray(body?.images) ? body.images : []).slice(0, MAX_IMAGES);
  if (!images.length) return bad("แนบรูปอย่างน้อย 1 รูป");
  for (const im of images) {
    if (typeof im?.data !== "string" || im.data.length > MAX_B64_LEN) return bad("รูปใหญ่เกินไป (จำกัด ~4MB ต่อรูป)");
    if (!/^image\/(jpeg|png|webp|gif)$/.test(im?.media_type || "")) return bad("รองรับเฉพาะไฟล์รูปภาพ");
  }

  const content = [
    ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
    { type: "text", text: aiNotes
      ? PROMPT + "\n\nความรู้เฉพาะจากทีมงาน (ตรวจสอบแล้ว เชื่อถือได้ ให้น้ำหนักเหนือการเดาของคุณ):\n" + aiNotes
      : PROMPT },
  ];

  let draft;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: "user", content }] }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[ai/draft-listing] anthropic error", resp.status, t.slice(0, 500));
      return bad("AI ตอบกลับผิดพลาด ลองใหม่อีกครั้ง", 502);
    }
    const data = await resp.json();
    const text = (data.content || []).map(c => c.text || "").join("\n");
    draft = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("[ai/draft-listing]", e);
    return bad("อ่านผลจาก AI ไม่สำเร็จ ลองใหม่อีกครั้ง", 502);
  }

  // ── validate ฝั่ง server: cat_path ต้องมีจริงในต้นไม้ · แบรนด์ต้องอยู่ในลิสต์ · ตัดฟิลด์สภาพทิ้งถ้า AI เผลอส่งมา ──
  let catPath = Array.isArray(draft.cat_path)
    ? draft.cat_path.map(s => String(s).trim()).filter(Boolean).slice(0, 6) : null;
  if (catPath && !catNodeAt(catPath)) catPath = null;

  let brand = draft.brand ? String(draft.brand).trim().slice(0, 100) : null;
  if (brand && !ALL_BRANDS.some(b => b.toLowerCase() === brand.toLowerCase())) brand = null;

  const clean = (v, n) => (v ? String(v).trim().slice(0, n) : null);
  const specs = {};
  const specSource = {};
  if (draft.specs && typeof draft.specs === "object") {
    for (const [k, v] of Object.entries(draft.specs).slice(0, 12)) {
      const key = String(k).trim().slice(0, 60);
      const val = String(v).trim().slice(0, 120);
      if (/ไม่ทราบ|ไม่ระบุ|ไม่แน่ใจ|unknown|n\/a/i.test(val)) continue; // AI ฝ่ากติกา — ตัดทิ้งฝั่ง server
      if (key && val) {
        specs[key] = val;
        const src = draft.spec_source?.[k];
        specSource[key] = src === "รูป" ? "รูป" : "ความรู้รุ่น";
      }
    }
  }

  return NextResponse.json({
    draft: {
      title: clean(draft.title, 200),
      catPath,
      brand,
      brandCountry: clean(draft.brand_country, 60),
      model: clean(draft.model, 120),
      specs,
      specSource,
      description: clean(draft.description, 2000),
      confidence: Math.max(0, Math.min(100, Math.round(Number(draft.confidence) || 0))),
      note: clean(draft.note, 300),
    },
  });
}

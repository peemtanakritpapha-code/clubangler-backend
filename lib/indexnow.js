// lib/indexnow.js — AEO-4: ยิงบอก search engine ทันทีที่ URL เกิด/เปลี่ยน (IndexNow — Bing ใช้เป็นหลัก)
// วางที่: lib/indexnow.js
// ทำไมต้องมี: index ของ Bing คือสิ่งที่ ChatGPT/Copilot ใช้ค้นเว็บ — สินค้า C2C หมุนเร็ว
//   (ลงวันนี้ ขายพรุ่งนี้) รอ crawl ปกติไม่ทัน IndexNow ทำให้ของใหม่ค้นเจอภายในชั่วโมง
//
// เปิดใช้ (ครั้งเดียว):
//   1) สร้าง key:  openssl rand -hex 16
//   2) สร้างไฟล์ public/<key>.txt เนื้อหาข้างใน = key ตัวเดียวกัน (IndexNow ใช้ยืนยันว่าเราเป็นเจ้าของโดเมน)
//   3) .env.local:  INDEXNOW_KEY=<key>  แล้ว restart PM2
// ไม่ตั้ง INDEXNOW_KEY = ฟังก์ชันเงียบทั้งตัว (localhost/dev ไม่ยิงออก)
//
// กติกาใช้งาน: ห้าม await — fire-and-forget เท่านั้น (แนว fail-soft เดียวกับ sitemap
//   พังก็แค่ log ห้ามทำ API หลักช้าหรือล้ม)

const BASE = "https://clubangler.com";
const HOST = "clubangler.com";

export function pingIndexNow(paths) {
  const key = process.env.INDEXNOW_KEY;
  if (!key || !Array.isArray(paths) || !paths.length) return;

  const urlList = [...new Set(paths.filter(Boolean))]
    .map(p => (String(p).startsWith("http") ? p : `${BASE}${p}`));

  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `${BASE}/${key}.txt`,
      urlList,
    }),
  }).catch(err => console.error("indexnow:", err?.message || err));
}

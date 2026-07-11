// scripts/test-anthropic.js — เทสเชื่อม Anthropic API แบบไม่มีรูป (แยกปัญหา key/เน็ต ออกจากปัญหาขนาดรูป)
// วิธีใช้: node scripts/test-anthropic.js  (รันจากโฟลเดอร์โปรเจกต์)
const fs = require("fs");
const line = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find(l => l.startsWith("ANTHROPIC_API_KEY="));
const key = (line || "").slice("ANTHROPIC_API_KEY=".length).trim();
if (!key) { console.log("❌ ไม่พบ ANTHROPIC_API_KEY ใน .env.local"); process.exit(1); }
console.log("พบ key ขึ้นต้น:", key.slice(0, 10) + "... ยาว", key.length, "ตัวอักษร");
fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 50, messages: [{ role: "user", content: "ตอบคำเดียวว่า: ok" }] }),
}).then(async r => {
  console.log("HTTP", r.status, r.status === 200 ? "✅ เชื่อมได้ key ใช้ได้" : "❌");
  console.log((await r.text()).slice(0, 400));
}).catch(e => console.log("❌ ยิงไม่ถึงปลายทาง:", e.message, e.cause?.message || ""));

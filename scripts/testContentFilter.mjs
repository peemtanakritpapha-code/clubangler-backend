// scripts/testContentFilter.mjs — AUTO1: ชุดทดสอบตัวกรองเนื้อหา
// รัน: node scripts/testContentFilter.mjs  (ต้องขึ้น ALL PASS ก่อน deploy ทุกครั้งที่แก้ lib/contentFilter.js)
import { checkContent } from "../lib/contentFilter.js";

const WORDS = ["เหี้ย", "สัส", "ควย"]; // ตัวอย่างคลังคำ (ของจริงอยู่ใน DB)

// [ข้อความ, ควรโดนบล็อกไหม, คำอธิบาย]
const CASES = [
  // ── ข้อความขายของปกติ: ต้องรอดทั้งหมด (ตลาดตกปลาเลขเยอะ) ──
  ["Skagit design Pumpking ป๊อป 42g ตัวละ 500", false, "สเปค+ราคา"],
  ["รอก Daiwa รุ่น 4000 สาย PE 0.8 หนัก 140mm", false, "เลขรุ่น/สเปค"],
  ["main line 30lb ใช้ fishing line ของ Varivas", false, "line = สายเอ็น (อังกฤษเดี่ยวๆ ต้องรอด)"],
  ["ส่งของแล้วนะครับ เลขพัสดุ TH012345678901A", false, "เลขพัสดุยาวกว่า 10 หลัก"],
  ["ราคา 500 บาท ส่งฟรี ลด 10% เหลือ 450", false, "ตัวเลขราคา"],
  ["ปล่อยคัน 08 ฟุต แอคชั่น ML", false, "08 แต่ไม่ครบ 10 หลัก"],
  ["สินค้าตี 06.30 น. เปิดประมูล 09.00", false, "เวลา ไม่ใช่เบอร์"],
  ["online shopping deadline วันนี้", false, "line ในคำอื่น (online/deadline)"],

  // ── เบอร์โทร: ต้องโดนทุกแบบ ──
  ["สนใจโทร 0812345678", true, "เบอร์ติดกัน"],
  ["ทัก 081-234-5678 ได้เลย", true, "เบอร์มีขีด"],
  ["โทร 081 234 5678 นะครับ", true, "เบอร์เว้นวรรค"],
  ["เบอร์ 081.234.5678", true, "เบอร์มีจุด"],
  ["096 123 4567 รับสายตลอด", true, "เบอร์ 09"],
  ["ติดต่อ 0612345678", true, "เบอร์ 06"],

  // ── LINE: ต้องโดน ──
  ["ทักไลน์มาคุยราคา", true, "คำไทย ไลน์"],
  ["แอดไลน์ peem123", true, "แอดไลน์"],
  ["line: peem123", true, "line:"],
  ["Line ID @peemshop", true, "line id @"],
  ["add id line peemshop", true, "id line"],
  ["https://line.me/ti/p/abc123", true, "ลิงก์ line.me"],
  ["lin.ee/xyz", true, "ลิงก์ย่อ lin.ee"],
  ["ขอLine ที", true, "Line ปนประโยคไทย (บั๊กที่เจอจริง)"],
  ["แอด Line หน่อยครับ", true, "Line เว้นวรรคในประโยคไทย"],
  ["มี line ไหม", true, "line ตัวเล็กในประโยคไทย"],
  ["braided line 4 strands new in box", false, "ประโยคอังกฤษล้วน line = สายเอ็น"],
  ["ขาย PE line เบอร์ 1.5 สภาพดี", false, "ไทยปนอังกฤษแต่มีคำขยายสาย (PE) ต้องรอด"],

  // ── คลังคำ: ต้องโดนรวมถึงแบบหลบเลี่ยง ──
  ["ไอ้เหี้ยขายแพงจัง", true, "คำหยาบตรง"],
  ["เ หี้ ย จริงๆ", true, "แทรกช่องว่าง"],
  ["ค.ว.ย อะไรเนี่ย", true, "แทรกจุด"],
  ["ส*ั*ส", true, "แทรกดอกจัน"],
];

let pass = 0, fail = 0;
for (const [text, shouldBlock, desc] of CASES) {
  const r = checkContent(text, WORDS);
  const blocked = !r.ok;
  const ok = blocked === shouldBlock;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✅" : "❌ FAIL"} [${shouldBlock ? "ต้องโดน" : "ต้องรอด"}] ${desc} :: "${text}"${blocked ? ` → จับได้: ${r.hits.map(h => h.label).join(", ")}` : ""}`);
}
console.log(`\n${fail === 0 ? "🎉 ALL PASS" : "💥 มีเทสพัง"} — ผ่าน ${pass}/${CASES.length}`);
process.exit(fail === 0 ? 0 : 1);

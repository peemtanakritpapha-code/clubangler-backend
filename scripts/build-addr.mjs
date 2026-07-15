// scripts/build-addr.mjs — ADDR-1: แปลงข้อมูลที่อยู่ไทยดิบ (kongvut) → public/addr-th.json แบบกะทัดรัด
// เตรียมไฟล์ดิบก่อน (ครั้งเดียว):
//   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province_with_district_and_sub_district.json" -OutFile scripts\\raw-thai-address.json
// แล้วรัน:  node scripts/build-addr.mjs
// ผลลัพธ์: public/addr-th.json — { "10230": [{ s: "ตำบล", d: "อำเภอ", p: "จังหวัด" }, ...], ... }
import fs from "fs";

const RAW = "scripts/raw-thai-address.json";
if (!fs.existsSync(RAW)) { console.log("❌ ไม่พบ " + RAW + " — ดาวน์โหลดตามคำสั่งในคอมเมนต์หัวไฟล์ก่อน"); process.exit(1); }
const provinces = JSON.parse(fs.readFileSync(RAW, "utf8"));

const map = {};
let n = 0;
for (const pv of provinces) {
  for (const am of pv.district || pv.amphure || []) {   // รองรับโครงเก่า/ใหม่ของ kongvut
    for (const tb of am.sub_district || am.tambon || []) {
      const zip = String(tb.zip_code || "").padStart(5, "0");
      if (!/^[0-9]{5}$/.test(zip)) continue;
      (map[zip] = map[zip] || []).push({ s: tb.name_th, d: am.name_th, p: pv.name_th });
      n++;
    }
  }
}
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/addr-th.json", JSON.stringify(map));
const kb = Math.round(fs.statSync("public/addr-th.json").size / 1024);
console.log("OK: ตำบล " + n + " รายการ · รหัสไปรษณีย์ " + Object.keys(map).length + " รหัส · public/addr-th.json ~" + kb + " KB");

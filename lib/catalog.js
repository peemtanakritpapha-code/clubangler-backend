// lib/catalog.js — ยกจาก prototype ตรงๆ (หมวดหมู่/เกรดสภาพ/ตำหนิ/แบรนด์)
const CATEGORY_TREE = {
  "คันเบ็ด": {
    "คันสปินนิ่ง": { "ไลท์เกม": ["แอจจิ้ง", "เมบาริง", "ไมโครเกม"], "ตกหมึก (Eging)": null, "ชายฝั่ง / ชอร์จิ๊ก": null, "จิ๊กกิ้ง": null, "สโลว์จิ๊ก": null, "ป็อปปิ้ง": null, "ตีเหยื่อทั่วไป": null, "ทูน่า / เกมใหญ่": null, "หน้าดิน": null },
    "คันเบท (Low Profile / Round)": { "เบทฟิเนส / BFS": null, "ตีเหยื่อปลอม": null, "ฟร็อก": null, "จิ๊กกิ้ง": null, "สโลว์จิ๊ก": null, "หน้าดิน": null, "เกมใหญ่": null },
    "คันโอเวอร์เฮด": { "จิ๊กกิ้ง": null, "สโลว์จิ๊ก": null, "ดีพดรอป": null, "สำหรับรอกไฟฟ้า": null, "สแตนด์อัพ": null, "ทรอลลิ่ง": null },
    "คันฟลาย": { "Single Hand": null, "Switch": null, "Spey": null },
    "ชิงหลิว / คันทุ่น": { "ชิงหลิว": null, "คันทุ่นน้ำจืด": null },
  },
  "รอกตกปลา": { "สปินนิ่ง": null, "เบทโปรไฟล์ต่ำ": null, "รอกกลม": null, "โอเวอร์เฮด (Lever / Star Drag)": null, "รอกไฟฟ้า": null, "ฟลาย": null, "ทรอลลิ่ง": null, "สปินแคสต์": null },
  "สายตกปลา": { "สาย PE / ถัก": ["X4", "X8", "X9", "X12"], "โมโน": null, "ฟลูออโรคาร์บอน": null, "ช็อคลีดเดอร์": null, "สายฟลาย": null, "สายลวด": null, "Hollow Core": null },
  "เหยื่อปลอม": {
    "เหยื่อแข็ง": ["มินโนว์", "ครैंกเบต", "แชด", "ไวเบรชัน / ลิปเลส", "เพนซิล", "ป็อปเปอร์", "สติกเบต", "เวคเบต", "สวิมเบตแข็ง", "ไกลด์เบต", "จอยต์เบต"],
    "เหยื่อยาง": ["หนอนยาง", "แชดยาง", "กรับ", "ครีเจอร์", "กุ้ง / ปูยาง", "กบยาง", "ทูป", "สติกเวิร์ม", "สวิมเบตยาง"],
    "จิ๊ก": ["จิ๊กหัวตะกั่ว", "สเกิร์ตจิ๊ก", "ฟุตบอลจิ๊ก", "เมทัลจิ๊ก", "สโลว์จิ๊ก", "ชอร์จิ๊ก", "ไมโครจิ๊ก", "ทังสเตนจิ๊ก"],
    "สปินเนอร์ / เบลด": ["สปินเนอร์เบท", "บัซเบท", "แชตเตอร์เบท", "อินไลน์สปินเนอร์"],
    "สปูน / ใบโพ": null, "โยกุ้ง / Egi": null,
  },
  "เหยื่อจริง": { "เหยื่อสด": null, "เหยื่อเป็น": null, "เหยื่อแช่แข็ง": null, "เหยื่อหมัก": null, "หัวเชื้อ / กลิ่นล่อ": null, "เหยื่อสำเร็จ": null },
  "อุปกรณ์ปลายสาย": { "เบ็ดเดี่ยว": null, "เบ็ดสามทาง": null, "Assist Hook": null, "ตะกั่ว": null, "ลูกหมุน": null, "Solid Ring": null, "Split Ring": null, "กิ๊บ / สแน็ป": null, "ริกสำเร็จ": null, "ลูกปัด": null, "สต็อปเปอร์": null, "ทุ่น": null },
  "เครื่องมือ & อุปกรณ์เสริม": { "คีม": null, "คีมถ่างห่วง": null, "กรรไกร": null, "ที่ตัดสาย": null, "Fish Grip": null, "Hook Remover": null, "เครื่องชั่ง": null, "ที่วัดปลา": null, "ที่วางคัน": null, "Rod Pod": null, "Rod Belt": null, "Fighting Belt": null, "Fighting Harness": null, "แท่นกรอสาย": null, "UV Light": null, "สัญญาณเตือน": null },
  "กล่อง & กระเป๋า": { "กล่องเหยื่อ": null, "กล่องอุปกรณ์": null, "ซอง / กระเป๋าคัน": null, "เป้ / สะพาย": null, "กระเป๋ากันน้ำ": null, "ถังเก็บปลา": null },
  "เสื้อผ้า & เซฟตี้": { "เสื้อกันแดด": null, "หมวก": null, "แว่นโพลาไรซ์": null, "ถุงมือ / บัฟ": null, "รองเท้า / บู๊ท": null, "ชุดกันฝน": null, "เสื้อชูชีพ": null },
  "อิเล็กทรอนิกส์": { "ฟิชไฟน์เดอร์ / โซนาร์": null, "GPS": null, "กล้อง / แอคชั่นแคม": null, "แบต / พาวเวอร์แบงก์": null },
  "เรือ & คายัค": { "คายัค": null, "ซับบอร์ด (SUP)": null, "มอเตอร์โทรลิ่ง": null, "ที่ยึด / mount": null, "พาย": null, "สมอเรือ": null },
  "ชุดคอมโบ & อื่นๆ": { "ชุดคัน + รอก": null, "เซ็ตพร้อมตก": null, "ยกชุด / ยกกล่อง": null, "ของสะสม / วินเทจ": null, "อะไหล่ / DIY": null },
};
const COND_GRADES = [
  { key: "เหมือนใหม่", desc: "ใช้น้อยมาก แทบไม่มีรอย · ครบกล่อง-อุปกรณ์" },
  { key: "สภาพดี", desc: "ใช้แล้ว มีรอยเล็กน้อยตามอายุ · ทำงานเต็มระบบ" },
  { key: "พอใช้", desc: "มีร่องรอยใช้งานชัดเจน แต่ยังใช้งานได้ปกติ" },
  { key: "มีตำหนิ", desc: "มีจุดชำรุดที่กระทบการใช้งาน หรือรอซ่อม" },
  { key: "เพื่ออะไหล่", desc: "ใช้งานไม่ได้เต็มที่ ขายเป็นอะไหล่" },
];
const ISSUE_PRESETS = ["มีรอย", "สีลอก", "ไม่มีกล่อง", "อุปกรณ์ไม่ครบ", "เคยซ่อม-เปลี่ยนอะไหล่"];
const BRANDS_BY_COUNTRY = {
  "ญี่ปุ่น": ["Shimano","Daiwa","Megabass","Jackall","Evergreen","Deps","Ripple Fisher","Zenaq","MC Works","Yamaga Blanks","Shout!","Varivas","YGK","Sunline","Owner","Gamakatsu","Maria"],
  "สหรัฐอเมริกา": ["Penn","Accurate","Avet","Seeker","Calstar","G. Loomis","St. Croix","Phenix","Berkley","Abu Garcia"],
  "จีน": ["SeaKnight","KastKing","Piscifun","Tsurinoya","Kingdom","PureLure","Haibo"],
  "เกาหลีใต้": ["NS","Banax","N.S Black Hole","Dongmi"],
  "ไต้หวัน": ["Okuma","Protaiko"],
  "สวีเดน": ["Abu Garcia","Mora"],
  "นอร์เวย์": ["Mustad"],
  "ฟินแลนด์": ["Rapala","Kuusamo"],
  "ฝรั่งเศส": ["Sert"],
  "อิตาลี": ["Trabucco","Tubertini"],
  "อังกฤษ": ["Fox Rage","Korda","Nash"],
  "เยอรมนี": ["Balzer","DAM"],
  "ออสเตรเลีย": ["Nomad Design","Halco","Wilson"],
};

export const CAT_MAINS = Object.keys(CATEGORY_TREE);
export const ALL_BRANDS = Array.from(new Set(Object.values(BRANDS_BY_COUNTRY).flat())).sort();
export { CATEGORY_TREE, COND_GRADES, ISSUE_PRESETS, BRANDS_BY_COUNTRY };
// เดินไปยัง node ตาม path
export function catNodeAt(path) {
  let n = CATEGORY_TREE;
  for (const k of (path || [])) {
    if (Array.isArray(n)) return null;
    if (n && typeof n === 'object') n = n[k]; else return null;
  }
  return n;
}
export function catChildren(node) {
  if (Array.isArray(node)) return node.map(x => ({ name: x, hasKids: false }));
  if (node && typeof node === 'object') return Object.keys(node).map(k => ({ name: k, hasKids: !!node[k] && (Array.isArray(node[k]) ? node[k].length : Object.keys(node[k]).length) }));
  return [];
}

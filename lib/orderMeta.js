// lib/orderMeta.js — ป้ายสถานะ/สี/ลำดับขั้น/ลิงก์ track ยกจาก prototype ตรงๆ
export const ORDER_STATUS_LABEL = {
  pending_payment: "รอชำระเงิน",
  pending_verification: "รอแอดมินตรวจสอบ",
  payment_verified: "ชำระแล้ว · รอผู้ขายจัดส่ง",
  shipped: "จัดส่งแล้ว",
  delivered: "รับของแล้ว",
  completed: "เสร็จสิ้น",
  disputed: "ข้อพิพาท",
  return_requested: "ขอคืนสินค้า · รอแอดมินพิจารณา",
  return_approved: "อนุมัติคืนแล้ว · กรุณาส่งคืน",
  return_shipped: "ส่งคืนแล้ว · รอผู้ขายยืนยันรับของ",
  return_received: "รับของคืนแล้ว · ตรวจสอบ",
  refunded: "คืนเงินแล้ว",
};

export const ORDER_STATUS_COLOR = {
  pending_payment: "#F59E0B",
  pending_verification: "#F59E0B",
  payment_verified: "#0E7E8C",
  shipped: "#3B82F6",
  delivered: "#0E7E8C",
  completed: "#22C55E",
  disputed: "#C0392B",
  return_requested: "#C2410C",
  return_approved: "#D97706",
  return_shipped: "#7C3AED",
  return_received: "#7C3AED",
  refunded: "#22C55E",
};

export const ORDER_STEPS = {
  pending_payment: 0, pending_verification: 1, payment_verified: 2,
  shipped: 3, delivered: 4, completed: 5,
  disputed: -1, return_requested: -2, return_approved: -2,
  return_shipped: -3, return_received: -4, refunded: -5,
};

export const CARRIERS = ["Flash Express", "Kerry Express", "J&T Express", "ไปรษณีย์ไทย", "Ninja Van", "อื่นๆ"];

/* ลิงก์หน้า Track ของขนส่ง — เจ้าที่ไม่รู้จักเปิดค้นหาแทน (ยกจาก prototype) */
export const trackUrl = (carrier, no) => {
  if (!no) return null;
  const c = carrier || "";
  if (c.includes("Flash")) return `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(no)}`;
  if (c.includes("Kerry")) return `https://th.kex-express.com/th/track/?track=${encodeURIComponent(no)}`;
  if (c.includes("J&T")) return `https://www.jtexpress.co.th/service/track?billcode=${encodeURIComponent(no)}`;
  if (c.includes("ไปรษณีย์")) return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(no)}`;
  if (c.includes("Ninja")) return `https://www.ninjavan.co/th-th/tracking?id=${encodeURIComponent(no)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${c} ติดตามพัสดุ ${no}`.trim())}`;
};

export const fmtAddr = a => a ? [a.addr, a.sub && `ต.${a.sub}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`, a.zip].filter(Boolean).join(" ") : "";

/* ── สายคืนสินค้า (ยกจาก prototype) ── */
export const DISPUTE_REASONS = ["สินค้าไม่ตรงปก", "สินค้าชำรุด/เสียหาย", "ไม่ได้รับสินค้า", "อื่นๆ"];

// ตำแหน่งใน ReturnSteps 5 ขั้น: ①ขอคืน ②อนุมัติ ③ส่งคืน ④ผู้ขายรับ ⑤คืนเงิน
export const RETURN_STEP_IDX = {
  disputed: 0, return_requested: 0,
  return_approved: 1,
  return_shipped: 2,
  return_received: 3,
  refunded: 4,
};
